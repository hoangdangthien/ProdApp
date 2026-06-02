from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import distinct
from typing import Optional

import pandas as pd

from database import get_db
from models import Master, MonthlyProd, MonthlyInj, OOIP, CurrentCouncilPlan, WIT_Act, OTM
from schemas import MasterOut, MonthlyProdOut, MonthlyInjOut, FilterOptions

from sqlalchemy import func

router = APIRouter(prefix="/api", tags=["database"])


@router.get("/filters", response_model=FilterOptions)
def get_filter_options(db: Session = Depends(get_db)):
    fields = [r[0] for r in db.query(distinct(Master.Field)).filter(Master.Field.isnot(None)).order_by(Master.Field).all()]
    reservoirs = [r[0] for r in db.query(distinct(Master.Reservoir)).filter(Master.Reservoir.isnot(None)).order_by(Master.Reservoir).all()]
    platforms = [r[0] for r in db.query(distinct(Master.Platform)).filter(Master.Platform.isnot(None)).order_by(Master.Platform).all()]
    unique_ids = [r[0] for r in db.query(distinct(Master.UniqueId)).order_by(Master.UniqueId).all()]
    return FilterOptions(fields=fields, reservoirs=reservoirs, platforms=platforms, unique_ids=unique_ids)


@router.get("/filters/cascading")
def get_cascading_filters(
    field: Optional[str] = None,
    reservoir: Optional[str] = None,
    platform: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Master)
    if field:
        query = query.filter(Master.Field == field)
    if reservoir:
        query = query.filter(Master.Reservoir == reservoir)
    if platform:
        query = query.filter(Master.Platform == platform)

    fields = [r[0] for r in db.query(distinct(Master.Field)).filter(Master.Field.isnot(None)).order_by(Master.Field).all()]

    sub = db.query(Master)
    if field:
        sub = sub.filter(Master.Field == field)
    reservoirs = [r[0] for r in sub.with_entities(distinct(Master.Reservoir)).filter(Master.Reservoir.isnot(None)).order_by(Master.Reservoir).all()]

    sub2 = db.query(Master)
    if field:
        sub2 = sub2.filter(Master.Field == field)
    if reservoir:
        sub2 = sub2.filter(Master.Reservoir == reservoir)
    platforms = [r[0] for r in sub2.with_entities(distinct(Master.Platform)).filter(Master.Platform.isnot(None)).order_by(Master.Platform).all()]

    unique_ids = [r[0] for r in query.with_entities(distinct(Master.UniqueId)).order_by(Master.UniqueId).all()]

    return {"fields": fields, "reservoirs": reservoirs, "platforms": platforms, "unique_ids": unique_ids}


@router.get("/production", response_model=list[MonthlyProdOut])
def get_production(
    unique_id: str = Query(...),
    db: Session = Depends(get_db),
):
    return (
        db.query(MonthlyProd)
        .filter(MonthlyProd.UniqueId == unique_id)
        .order_by(MonthlyProd.Date)
        .all()
    )


@router.get("/production/multi")
def get_production_multi(
    unique_ids: str = Query(..., description="Comma-separated UniqueIds"),
    db: Session = Depends(get_db),
):
    id_list = [uid.strip() for uid in unique_ids.split(",") if uid.strip()]
    rows = (
        db.query(MonthlyProd)
        .filter(MonthlyProd.UniqueId.in_(id_list))
        .order_by(MonthlyProd.UniqueId, MonthlyProd.Date)
        .all()
    )
    result = {}
    for row in rows:
        uid = row.UniqueId
        if uid not in result:
            result[uid] = []
        result[uid].append({
            "Date": row.Date.isoformat() if row.Date else None,
            "OilRate": row.OilRate,
            "LiqRate": row.LiqRate,
            "WaterRate": row.WaterRate,
            "GOR": row.GOR,
            "WC": row.WC,
            "Qoil": row.Qoil,
            "Qwater": row.Qwater,
            "Qliq": row.Qliq,
            "Qgas": row.Qgas,
        })
    return result


@router.get("/injection", response_model=list[MonthlyInjOut])
def get_injection(
    unique_id: str = Query(...),
    db: Session = Depends(get_db),
):
    return (
        db.query(MonthlyInj)
        .filter(MonthlyInj.UniqueId == unique_id)
        .order_by(MonthlyInj.Date)
        .all()
    )


@router.get("/master", response_model=list[MasterOut])
def get_master(
    field: Optional[str] = None,
    reservoir: Optional[str] = None,
    platform: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Master)
    if field:
        query = query.filter(Master.Field == field)
    if reservoir:
        query = query.filter(Master.Reservoir == reservoir)
    if platform:
        query = query.filter(Master.Platform == platform)
    return query.order_by(Master.UniqueId).all()


@router.get("/production-dates")
def get_production_dates(db: Session = Depends(get_db)):
    rows = (
        db.query(distinct(MonthlyProd.Date))
        .filter(MonthlyProd.Date.isnot(None))
        .order_by(MonthlyProd.Date.desc())
        .all()
    )
    return [r[0].isoformat() for r in rows]


@router.get("/production/yearly-summary")
def get_yearly_production_summary(
    year: int = Query(...),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(
            Master.Field,
            Master.Platform,
            func.sum(MonthlyProd.Qoil),
        )
        .join(Master, MonthlyProd.UniqueId == Master.UniqueId)
        .filter(func.extract("year", MonthlyProd.Date) == year)
        .group_by(Master.Field, Master.Platform)
        .all()
    )

    by_field = {}
    by_platform = {}
    for field_name, platform_name, total_oil in rows:
        f = field_name or "Unknown"
        p = platform_name or "Unknown"
        total = round(total_oil or 0, 2)
        by_field[f] = by_field.get(f, 0) + total
        by_platform[p] = by_platform.get(p, 0) + total

    by_field_list = sorted(
        [{"name": k, "oil": round(v, 2)} for k, v in by_field.items()],
        key=lambda x: x["oil"], reverse=True,
    )
    by_platform_list = sorted(
        [{"name": k, "oil": round(v, 2)} for k, v in by_platform.items()],
        key=lambda x: x["oil"], reverse=True,
    )

    years = [
        r[0] for r in db.query(
            distinct(func.extract("year", MonthlyProd.Date))
        )
        .filter(MonthlyProd.Date.isnot(None))
        .order_by(func.extract("year", MonthlyProd.Date).desc())
        .all()
    ]

    return {
        "year": year,
        "available_years": [int(y) for y in years],
        "by_field": by_field_list,
        "by_platform": by_platform_list,
    }


def _compute_council_plan_final_by_wells(db, year, well_ids_by_group, max_month=None):
    """Compute council_plan_final = council_plan - OTMProd (distributed proportionally by completion type).

    well_ids_by_group: dict mapping group_key -> list of UniqueIds
    max_month: when given, only Council Plan / OTM months <= max_month are summed
        (used for year-to-date attainment over a partial year).
    Returns: dict mapping group_key -> council_plan_final value
    """
    all_well_ids = []
    for ids in well_ids_by_group.values():
        all_well_ids.extend(ids)
    if not all_well_ids:
        return {}

    council_q = (
        db.query(CurrentCouncilPlan.UniqueId, func.sum(CurrentCouncilPlan.Qoil))
        .filter(
            CurrentCouncilPlan.UniqueId.in_(all_well_ids),
            func.extract("year", CurrentCouncilPlan.Date) == year,
            CurrentCouncilPlan.Case == "Base",
        )
    )
    if max_month is not None:
        council_q = council_q.filter(func.extract("month", CurrentCouncilPlan.Date) <= max_month)
    council_rows = council_q.group_by(CurrentCouncilPlan.UniqueId).all()
    council_by_well = {uid: round(qoil or 0, 2) for uid, qoil in council_rows}

    well_completion = dict(
        db.query(Master.UniqueId, Master.Completion)
        .filter(Master.UniqueId.in_(all_well_ids))
        .all()
    )

    otm_q = (
        db.query(OTM.OTMID, func.sum(OTM.OTMProd))
        .filter(func.extract("year", OTM.Date) == year)
    )
    if max_month is not None:
        otm_q = otm_q.filter(func.extract("month", OTM.Date) <= max_month)
    otm_rows = otm_q.group_by(OTM.OTMID).all()
    otm_by_completion = {otmid: round(prod or 0, 2) for otmid, prod in otm_rows}

    total_council_by_completion = {}
    for uid, qoil in council_by_well.items():
        comp = well_completion.get(uid)
        if comp:
            total_council_by_completion[comp] = total_council_by_completion.get(comp, 0) + qoil

    result = {}
    for group_key, ids in well_ids_by_group.items():
        group_council = 0
        group_otm = 0
        for uid in ids:
            c_qoil = council_by_well.get(uid, 0)
            group_council += c_qoil
            comp = well_completion.get(uid)
            if comp and comp in otm_by_completion and total_council_by_completion.get(comp, 0) > 0:
                group_otm += otm_by_completion[comp] * c_qoil / total_council_by_completion[comp]
        result[group_key] = round(group_council - group_otm, 2)
    return result


@router.get("/production/field-reservoir-breakdown")
def get_field_reservoir_breakdown(
    year: int = Query(...),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(
            Master.Field,
            Master.Reservoir,
            func.sum(MonthlyProd.Qoil),
        )
        .join(Master, MonthlyProd.UniqueId == Master.UniqueId)
        .filter(func.extract("year", MonthlyProd.Date) == year)
        .group_by(Master.Field, Master.Reservoir)
        .all()
    )

    well_rows = (
        db.query(Master.Field, Master.Reservoir, Master.UniqueId)
        .filter(Master.Field.isnot(None), Master.Reservoir.isnot(None))
        .all()
    )
    well_ids_by_group = {}
    for f, r, uid in well_rows:
        key = (f, r)
        well_ids_by_group.setdefault(key, []).append(uid)

    council_final = _compute_council_plan_final_by_wells(db, year, well_ids_by_group)

    field_well_ids = {}
    for (f, r), ids in well_ids_by_group.items():
        field_well_ids.setdefault(f, []).extend(ids)
    field_council_final = _compute_council_plan_final_by_wells(
        db, year, {f: list(set(ids)) for f, ids in field_well_ids.items()}
    )

    fields_data = {}
    for field_name, reservoir_name, total_oil in rows:
        f = field_name or "Unknown"
        r = reservoir_name or "Unknown"
        oil = round(total_oil or 0, 2)
        cpf = council_final.get((f, r), 0)
        if f not in fields_data:
            fields_data[f] = {"field": f, "reservoirs": [], "total": 0, "council_plan_final": 0}
        fields_data[f]["reservoirs"].append({"name": r, "oil": oil, "council_plan_final": cpf})
        fields_data[f]["total"] += oil

    for f in fields_data:
        fields_data[f]["council_plan_final"] = field_council_final.get(f, 0)

    result = []
    for f_data in sorted(fields_data.values(), key=lambda x: x["total"], reverse=True):
        f_data["total"] = round(f_data["total"], 2)
        f_data["reservoirs"] = sorted(f_data["reservoirs"], key=lambda x: x["oil"], reverse=True)
        result.append(f_data)

    return result


@router.get("/production/block-field-breakdown")
def get_block_field_breakdown(
    year: int = Query(...),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(
            Master.Block,
            Master.Field,
            func.sum(MonthlyProd.Qoil),
        )
        .join(Master, MonthlyProd.UniqueId == Master.UniqueId)
        .filter(func.extract("year", MonthlyProd.Date) == year)
        .filter(Master.Block.isnot(None))
        .group_by(Master.Block, Master.Field)
        .all()
    )

    well_rows = (
        db.query(Master.Block, Master.Field, Master.UniqueId)
        .filter(Master.Block.isnot(None), Master.Field.isnot(None))
        .all()
    )
    well_ids_by_group = {}
    for b, f, uid in well_rows:
        key = (b, f)
        well_ids_by_group.setdefault(key, []).append(uid)

    council_final = _compute_council_plan_final_by_wells(db, year, well_ids_by_group)

    block_well_ids = {}
    for (b, f), ids in well_ids_by_group.items():
        block_well_ids.setdefault(b, []).extend(ids)
    block_council_final = _compute_council_plan_final_by_wells(
        db, year, {b: list(set(ids)) for b, ids in block_well_ids.items()}
    )

    blocks_data = {}
    for block_name, field_name, total_oil in rows:
        b = block_name or "Unknown"
        f = field_name or "Unknown"
        oil = round(total_oil or 0, 2)
        cpf = council_final.get((b, f), 0)
        if b not in blocks_data:
            blocks_data[b] = {"block": b, "fields": [], "total": 0, "council_plan_final": 0}
        blocks_data[b]["fields"].append({"name": f, "oil": oil, "council_plan_final": cpf})
        blocks_data[b]["total"] += oil

    for b in blocks_data:
        blocks_data[b]["council_plan_final"] = block_council_final.get(b, 0)

    result = []
    for b_data in sorted(blocks_data.values(), key=lambda x: x["total"], reverse=True):
        b_data["total"] = round(b_data["total"], 2)
        b_data["fields"] = sorted(b_data["fields"], key=lambda x: x["oil"], reverse=True)
        result.append(b_data)

    return result


@router.get("/element-numbers")
def get_element_numbers(
    field: Optional[str] = None,
    reservoir: Optional[str] = None,
    platform: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(distinct(Master.ElementNumber)).filter(Master.ElementNumber.isnot(None))
    if field:
        query = query.filter(Master.Field == field)
    if reservoir:
        query = query.filter(Master.Reservoir == reservoir)
    if platform:
        query = query.filter(Master.Platform == platform)
    return [r[0] for r in query.order_by(Master.ElementNumber).all()]


@router.get("/production/reservoir-summary")
def get_reservoir_production_summary(
    field: str = Query(...),
    reservoir: str = Query(...),
    db: Session = Depends(get_db),
):
    """
    Returns monthly OilRate, GOR, WC, and VRR for a specific reservoir in a field.
    VRR = Qinj / Qprod
    Qprod = sum(OilRate)*PVT_Bo/PVT_OilDensity + sum(Qwater)
    """
    well_ids = [
        r[0] for r in db.query(Master.UniqueId)
        .filter(Master.Field == field, Master.Reservoir == reservoir)
        .all()
    ]
    if not well_ids:
        return []

    completions = [
        r[0] for r in db.query(distinct(Master.Completion))
        .filter(Master.Field == field, Master.Reservoir == reservoir, Master.Completion.isnot(None))
        .all()
    ]

    pvt_bo = 1.0
    pvt_oil_density = 1.0
    if completions:
        ooip_row = db.query(OOIP).filter(OOIP.Completion.in_(completions)).first()
        if ooip_row:
            if ooip_row.PVT_Bo:
                pvt_bo = ooip_row.PVT_Bo
            if ooip_row.PVT_OilDensity:
                pvt_oil_density = ooip_row.PVT_OilDensity

    prod_rows = (
        db.query(
            func.extract("year", MonthlyProd.Date).label("yr"),
            func.extract("month", MonthlyProd.Date).label("mn"),
            func.sum(MonthlyProd.Qoil),
            func.sum(MonthlyProd.Qwater),
            func.sum(MonthlyProd.Qgas),
            func.sum(MonthlyProd.Qliq),
        )
        .filter(MonthlyProd.UniqueId.in_(well_ids))
        .group_by(
            func.extract("year", MonthlyProd.Date),
            func.extract("month", MonthlyProd.Date),
        )
        .order_by(
            func.extract("year", MonthlyProd.Date),
            func.extract("month", MonthlyProd.Date),
        )
        .all()
    )

    inj_rows = (
        db.query(
            func.extract("year", MonthlyInj.Date).label("yr"),
            func.extract("month", MonthlyInj.Date).label("mn"),
            func.sum(MonthlyInj.Qwater),
        )
        .filter(MonthlyInj.UniqueId.in_(well_ids))
        .group_by(
            func.extract("year", MonthlyInj.Date),
            func.extract("month", MonthlyInj.Date),
        )
        .all()
    )

    inj_map = {}
    for yr, mn, qinj in inj_rows:
        inj_map[(int(yr), int(mn))] = qinj or 0

    result = []
    for yr, mn, sum_qoil, sum_qwater, sum_qgas, sum_qliq in prod_rows:
        yr, mn = int(yr), int(mn)
        sum_qoil = sum_qoil or 0
        sum_qwater = sum_qwater or 0
        sum_qgas = sum_qgas or 0
        sum_qliq = sum_qliq or 0

        gor = (1000 * sum_qgas / sum_qoil) if sum_qoil > 0 else 0
        wc = (100 * sum_qwater / sum_qliq) if sum_qliq > 0 else 0

        qprod = sum_qoil * pvt_bo / pvt_oil_density + sum_qwater
        qinj = inj_map.get((yr, mn), 0)
        vrr = (qinj / qprod) if qprod > 0 else None

        result.append({
            "Date": f"{yr:04d}-{mn:02d}",
            "OilRate": round(sum_qoil, 2),
            "GOR": round(gor, 2),
            "WC": round(wc, 2),
            "VRR": round(vrr, 3) if vrr is not None else None,
        })

    return result


@router.get("/production/decline-options")
def get_decline_filter_options(
    region: Optional[str] = None,
    field: Optional[str] = None,
    reservoir: Optional[str] = None,
    platform: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Cascading filter options for the decline-comparison charts.

    Regions (RegionNIRII1) and fields are always the full set; reservoirs/
    platforms/completions/elements narrow according to the selections made
    above them (including the chosen region).
    """
    regions = [r[0] for r in db.query(distinct(Master.RegionNIRII1)).filter(Master.RegionNIRII1.isnot(None)).order_by(Master.RegionNIRII1).all()]
    fields = [r[0] for r in db.query(distinct(Master.Field)).filter(Master.Field.isnot(None)).order_by(Master.Field).all()]

    sub = db.query(Master)
    if region:
        sub = sub.filter(Master.RegionNIRII1 == region)
    if field:
        sub = sub.filter(Master.Field == field)
    reservoirs = [r[0] for r in sub.with_entities(distinct(Master.Reservoir)).filter(Master.Reservoir.isnot(None)).order_by(Master.Reservoir).all()]

    sub2 = db.query(Master)
    if region:
        sub2 = sub2.filter(Master.RegionNIRII1 == region)
    if field:
        sub2 = sub2.filter(Master.Field == field)
    if reservoir:
        sub2 = sub2.filter(Master.Reservoir == reservoir)
    platforms = [r[0] for r in sub2.with_entities(distinct(Master.Platform)).filter(Master.Platform.isnot(None)).order_by(Master.Platform).all()]

    sub3 = db.query(Master)
    if region:
        sub3 = sub3.filter(Master.RegionNIRII1 == region)
    if field:
        sub3 = sub3.filter(Master.Field == field)
    if reservoir:
        sub3 = sub3.filter(Master.Reservoir == reservoir)
    if platform:
        sub3 = sub3.filter(Master.Platform == platform)
    completions = [r[0] for r in sub3.with_entities(distinct(Master.Completion)).filter(Master.Completion.isnot(None)).order_by(Master.Completion).all()]
    element_numbers = [r[0] for r in sub3.with_entities(distinct(Master.ElementNumber)).filter(Master.ElementNumber.isnot(None)).order_by(Master.ElementNumber).all()]

    return {
        "regions": regions,
        "fields": fields,
        "reservoirs": reservoirs,
        "platforms": platforms,
        "completions": completions,
        "element_numbers": element_numbers,
    }


def _monthly_rate_lookup(rows):
    """Vectorized monthly sum of OilRate/LiqRate over a set of wells.

    rows: iterable of (Date, OilRate, LiqRate). Returns a dict keyed by
    (year, month) -> {"oil": float, "liq": float}. Uses pandas groupby so the
    per-month aggregation runs in vectorized C rather than a Python loop.
    """
    if not rows:
        return {}
    df = pd.DataFrame(rows, columns=["Date", "OilRate", "LiqRate"])
    df = df[df["Date"].notna()]
    if df.empty:
        return {}
    df["OilRate"] = pd.to_numeric(df["OilRate"], errors="coerce").fillna(0.0)
    df["LiqRate"] = pd.to_numeric(df["LiqRate"], errors="coerce").fillna(0.0)
    dates = pd.to_datetime(df["Date"])
    df["year"] = dates.dt.year
    df["month"] = dates.dt.month
    agg = df.groupby(["year", "month"], as_index=False)[["OilRate", "LiqRate"]].sum()
    return {
        (int(r.year), int(r.month)): {"oil": float(r.OilRate), "liq": float(r.LiqRate)}
        for r in agg.itertuples()
    }


@router.get("/production/decline-comparison")
def get_decline_comparison(
    year: int = Query(...),
    region: Optional[str] = None,
    field: Optional[str] = None,
    reservoir: Optional[str] = None,
    platform: Optional[str] = None,
    completion: Optional[str] = None,
    element_number: Optional[str] = None,
    council_case: str = Query("Base"),
    db: Session = Depends(get_db),
):
    """Monthly decline (%) of Council Plan vs Actual for the selected year.

    Each series declines from December of the previous year, measured against
    its OWN baseline:

        council_decl_i = round(100 * (1 - CouncilPlan.rate_i / CouncilPlan.rate_dec_prev), 1)
        actual_decl_i  = round(100 * (1 - actual_rate_i / actual_rate_dec_prev), 1)
        where  actual_rate = MonthlyProd.rate - WIT_Act.rate

    The actual rate excludes the WIT (well-intervention) increment. Council Plan
    and WIT_Act are both read for the single scenario `council_case` (e.g.
    "Base") — never summed across the High/Low/Base scenarios.
    """
    master_q = db.query(Master.UniqueId)
    if region:
        master_q = master_q.filter(Master.RegionNIRII1 == region)
    if field:
        master_q = master_q.filter(Master.Field == field)
    if reservoir:
        master_q = master_q.filter(Master.Reservoir == reservoir)
    if platform:
        master_q = master_q.filter(Master.Platform == platform)
    if completion:
        master_q = master_q.filter(Master.Completion == completion)
    if element_number:
        master_q = master_q.filter(Master.ElementNumber == element_number)

    well_ids = [r[0] for r in master_q.all()]
    if not well_ids:
        return {"year": year, "baseline": f"{year - 1:04d}-12", "data": []}

    years = [year - 1, year]

    council_rows = (
        db.query(CurrentCouncilPlan.Date, CurrentCouncilPlan.OilRate, CurrentCouncilPlan.LiqRate)
        .filter(
            CurrentCouncilPlan.UniqueId.in_(well_ids),
            CurrentCouncilPlan.Case == council_case,
            func.extract("year", CurrentCouncilPlan.Date).in_(years),
        )
        .all()
    )
    prod_rows = (
        db.query(MonthlyProd.Date, MonthlyProd.OilRate, MonthlyProd.LiqRate)
        .filter(
            MonthlyProd.UniqueId.in_(well_ids),
            func.extract("year", MonthlyProd.Date).in_(years),
        )
        .all()
    )
    wit_rows = (
        db.query(WIT_Act.Date, WIT_Act.OilRate, WIT_Act.LiqRate)
        .filter(
            WIT_Act.UniqueId.in_(well_ids),
            WIT_Act.Case == council_case,
            func.extract("year", WIT_Act.Date).in_(years),
        )
        .all()
    )

    council = _monthly_rate_lookup(council_rows)
    prod = _monthly_rate_lookup(prod_rows)
    wit = _monthly_rate_lookup(wit_rows)

    def actual_at(key):
        p = prod.get(key)
        if p is None:
            return None
        w = wit.get(key, {"oil": 0.0, "liq": 0.0})
        return {"oil": p["oil"] - w["oil"], "liq": p["liq"] - w["liq"]}

    # Each series uses its own December-of-previous-year baseline.
    base_key = (year - 1, 12)
    council_base = council.get(base_key)
    actual_base = actual_at(base_key)

    def decline(rate, base, axis):
        if rate is None or base is None or base[axis] == 0:
            return None
        return round(100.0 * (1.0 - rate / base[axis]), 1)

    months = sorted({m for (y, m) in set(council) | set(prod) if y == year})
    data = []
    for m in months:
        key = (year, m)
        c = council.get(key)
        a = actual_at(key)
        data.append({
            "Date": f"{year:04d}-{m:02d}",
            "OilCouncil": decline(c["oil"] if c else None, council_base, "oil"),
            "LiqCouncil": decline(c["liq"] if c else None, council_base, "liq"),
            "OilActual": decline(a["oil"] if a else None, actual_base, "oil"),
            "LiqActual": decline(a["liq"] if a else None, actual_base, "liq"),
        })

    return {"year": year, "baseline": f"{year - 1:04d}-12", "data": data}


# ── Overview Dashboard endpoints ────────────────────────────────────────────
#
# A flexible "pick any level" scope: the caller supplies any combination of
# block / field / reservoir / platform, and the dashboard aggregates the wells
# matching that scope. The hierarchy is not a strict tree (a platform spans many
# reservoirs and vice-versa), so scope is expressed as a set of Master filters
# rather than a parent→child walk.

def _scoped_master_query(db, block=None, field=None, reservoir=None, platform=None):
    """db.query(Master) narrowed by whichever scope filters are provided."""
    q = db.query(Master)
    if block:
        q = q.filter(Master.Block == block)
    if field:
        q = q.filter(Master.Field == field)
    if reservoir:
        q = q.filter(Master.Reservoir == reservoir)
    if platform:
        q = q.filter(Master.Platform == platform)
    return q


@router.get("/production/dashboard-options")
def get_dashboard_options(
    block: Optional[str] = None,
    field: Optional[str] = None,
    reservoir: Optional[str] = None,
    platform: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Cross-filtering scope options for the dashboard picker.

    Each dimension's list is narrowed by every *other* selected dimension, so any
    of block/field/reservoir/platform can be chosen first and the rest react.
    """
    def options_for(col, skip):
        q = db.query(distinct(col)).filter(col.isnot(None))
        if block and skip != "block":
            q = q.filter(Master.Block == block)
        if field and skip != "field":
            q = q.filter(Master.Field == field)
        if reservoir and skip != "reservoir":
            q = q.filter(Master.Reservoir == reservoir)
        if platform and skip != "platform":
            q = q.filter(Master.Platform == platform)
        return [r[0] for r in q.order_by(col).all()]

    return {
        "blocks": options_for(Master.Block, "block"),
        "fields": options_for(Master.Field, "field"),
        "reservoirs": options_for(Master.Reservoir, "reservoir"),
        "platforms": options_for(Master.Platform, "platform"),
    }


_LEVEL_COLUMN = {
    "block": Master.Block,
    "field": Master.Field,
    "reservoir": Master.Reservoir,
    "platform": Master.Platform,
}


@router.get("/production/hierarchy-breakdown")
def get_hierarchy_breakdown(
    year: int = Query(...),
    level: str = Query(..., description="block | field | reservoir | platform"),
    block: Optional[str] = None,
    field: Optional[str] = None,
    reservoir: Optional[str] = None,
    platform: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Actual Qoil vs Council-Plan-final for each child of the selected scope.

    Children are the distinct values of `level` among the scoped wells. Each
    carries actual oil, council_plan_final (= council Base − OTM), and its share
    of the scope total. Mirrors the maths of the block/field breakdown endpoints
    but for any level under any scope.
    """
    level_col = _LEVEL_COLUMN.get(level)
    if level_col is None:
        return {"level": level, "total": 0, "council_plan_final": 0, "children": []}

    scope = _scoped_master_query(db, block, field, reservoir, platform)
    well_rows = (
        scope.with_entities(level_col, Master.UniqueId)
        .filter(level_col.isnot(None))
        .all()
    )
    well_ids_by_group = {}
    for g, uid in well_rows:
        well_ids_by_group.setdefault(g, []).append(uid)
    all_ids = [uid for ids in well_ids_by_group.values() for uid in ids]
    if not all_ids:
        return {"level": level, "total": 0, "council_plan_final": 0, "children": []}

    prod_rows = (
        db.query(level_col, func.sum(MonthlyProd.Qoil))
        .join(Master, MonthlyProd.UniqueId == Master.UniqueId)
        .filter(
            MonthlyProd.UniqueId.in_(all_ids),
            func.extract("year", MonthlyProd.Date) == year,
        )
        .group_by(level_col)
        .all()
    )
    actual_by_group = {g: round(v or 0, 2) for g, v in prod_rows}

    council_final = _compute_council_plan_final_by_wells(db, year, well_ids_by_group)

    total = round(sum(actual_by_group.values()), 2)
    children = []
    for g in well_ids_by_group:
        oil = actual_by_group.get(g, 0)
        children.append({
            "name": g,
            "oil": oil,
            "council_plan_final": council_final.get(g, 0),
            "share_pct": round(100 * oil / total, 2) if total > 0 else 0,
        })
    children.sort(key=lambda x: x["oil"], reverse=True)
    total_cpf = round(sum(c["council_plan_final"] for c in children), 2)

    return {
        "level": level,
        "total": total,
        "council_plan_final": total_cpf,
        "children": children,
    }


@router.get("/production/kpi-summary")
def get_kpi_summary(
    year: int = Query(...),
    block: Optional[str] = None,
    field: Optional[str] = None,
    reservoir: Optional[str] = None,
    platform: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Year-to-date KPI scorecard + monthly indicator series for a scope.

    Monthly series mirror the reservoir-summary shape (OilRate=ΣQoil, GOR, WC,
    VRR) plus LiqRate=ΣQliq, so the ReservoirChartModule can render it directly.
    The scorecard sums YTD actual vs council_plan_final (restricted to the same
    months) for plan attainment.
    """
    well_ids = [r[0] for r in _scoped_master_query(db, block, field, reservoir, platform)
                .with_entities(Master.UniqueId).all()]
    empty = {
        "scorecard": {
            "qoil_actual_kt": 0, "qoil_plan_kt": 0, "attainment_pct": None,
            "oil_rate_avg": 0, "liq_rate_avg": 0, "wc_pct": None,
            "gor": None, "vrr_latest": None, "latest_month": None,
        },
        "series": [],
    }
    if not well_ids:
        return empty

    completions = [
        r[0] for r in db.query(distinct(Master.Completion))
        .filter(Master.UniqueId.in_(well_ids), Master.Completion.isnot(None)).all()
    ]
    pvt_bo, pvt_oil_density = 1.0, 1.0
    if completions:
        ooip_row = db.query(OOIP).filter(OOIP.Completion.in_(completions)).first()
        if ooip_row:
            if ooip_row.PVT_Bo:
                pvt_bo = ooip_row.PVT_Bo
            if ooip_row.PVT_OilDensity:
                pvt_oil_density = ooip_row.PVT_OilDensity

    prod_rows = (
        db.query(
            func.extract("month", MonthlyProd.Date).label("mn"),
            func.sum(MonthlyProd.Qoil),
            func.sum(MonthlyProd.Qwater),
            func.sum(MonthlyProd.Qgas),
            func.sum(MonthlyProd.Qliq),
        )
        .filter(
            MonthlyProd.UniqueId.in_(well_ids),
            func.extract("year", MonthlyProd.Date) == year,
        )
        .group_by(func.extract("month", MonthlyProd.Date))
        .order_by(func.extract("month", MonthlyProd.Date))
        .all()
    )
    if not prod_rows:
        return empty

    inj_rows = (
        db.query(func.extract("month", MonthlyInj.Date), func.sum(MonthlyInj.Qwater))
        .filter(
            MonthlyInj.UniqueId.in_(well_ids),
            func.extract("year", MonthlyInj.Date) == year,
        )
        .group_by(func.extract("month", MonthlyInj.Date))
        .all()
    )
    inj_map = {int(mn): (q or 0) for mn, q in inj_rows}

    series = []
    tot_oil = tot_water = tot_gas = tot_liq = 0.0
    latest_vrr = None
    for mn, s_qoil, s_qwater, s_qgas, s_qliq in prod_rows:
        mn = int(mn)
        s_qoil = s_qoil or 0
        s_qwater = s_qwater or 0
        s_qgas = s_qgas or 0
        s_qliq = s_qliq or 0
        tot_oil += s_qoil
        tot_water += s_qwater
        tot_gas += s_qgas
        tot_liq += s_qliq

        gor = (1000 * s_qgas / s_qoil) if s_qoil > 0 else 0
        wc = (100 * s_qwater / s_qliq) if s_qliq > 0 else 0
        qprod = s_qoil * pvt_bo / pvt_oil_density + s_qwater
        qinj = inj_map.get(mn, 0)
        vrr = (qinj / qprod) if qprod > 0 else None
        if vrr is not None:
            latest_vrr = round(vrr, 3)

        series.append({
            "Date": f"{year:04d}-{mn:02d}",
            "OilRate": round(s_qoil, 2),
            "LiqRate": round(s_qliq, 2),
            "GOR": round(gor, 2),
            "WC": round(wc, 2),
            "VRR": round(vrr, 3) if vrr is not None else None,
        })

    latest_month = max(int(r[0]) for r in prod_rows)
    n_months = len(prod_rows)
    plan_final = _compute_council_plan_final_by_wells(
        db, year, {"__scope__": well_ids}, max_month=latest_month
    ).get("__scope__", 0)

    qoil_actual_kt = round(tot_oil / 1000, 2)
    qoil_plan_kt = round(plan_final / 1000, 2)
    attainment = round(100 * tot_oil / plan_final, 1) if plan_final > 0 else None

    scorecard = {
        "qoil_actual_kt": qoil_actual_kt,
        "qoil_plan_kt": qoil_plan_kt,
        "attainment_pct": attainment,
        "oil_rate_avg": round(tot_oil / n_months, 2) if n_months else 0,
        "liq_rate_avg": round(tot_liq / n_months, 2) if n_months else 0,
        "wc_pct": round(100 * tot_water / tot_liq, 1) if tot_liq > 0 else None,
        "gor": round(1000 * tot_gas / tot_oil, 1) if tot_oil > 0 else None,
        "vrr_latest": latest_vrr,
        "latest_month": f"{year:04d}-{latest_month:02d}",
    }
    return {"scorecard": scorecard, "series": series}
