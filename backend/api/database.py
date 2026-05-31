from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import distinct
from typing import Optional

from database import get_db
from models import Master, MonthlyProd, MonthlyInj, OOIP, CurrentCouncilPlan, OTM
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


def _compute_council_plan_final_by_wells(db, year, well_ids_by_group):
    """Compute council_plan_final = council_plan - OTMProd (distributed proportionally by completion type).

    well_ids_by_group: dict mapping group_key -> list of UniqueIds
    Returns: dict mapping group_key -> council_plan_final value
    """
    all_well_ids = []
    for ids in well_ids_by_group.values():
        all_well_ids.extend(ids)
    if not all_well_ids:
        return {}

    council_rows = (
        db.query(CurrentCouncilPlan.UniqueId, func.sum(CurrentCouncilPlan.Qoil))
        .filter(
            CurrentCouncilPlan.UniqueId.in_(all_well_ids),
            func.extract("year", CurrentCouncilPlan.Date) == year,
            CurrentCouncilPlan.Case == "Base",
        )
        .group_by(CurrentCouncilPlan.UniqueId)
        .all()
    )
    council_by_well = {uid: round(qoil or 0, 2) for uid, qoil in council_rows}

    well_completion = dict(
        db.query(Master.UniqueId, Master.Completion)
        .filter(Master.UniqueId.in_(all_well_ids))
        .all()
    )

    otm_rows = (
        db.query(OTM.OTMID, func.sum(OTM.OTMProd))
        .filter(func.extract("year", OTM.Date) == year)
        .group_by(OTM.OTMID)
        .all()
    )
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
