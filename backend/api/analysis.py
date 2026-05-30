from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from datetime import date
from dateutil.relativedelta import relativedelta

import pandas as pd
import numpy as np

from database import get_db
from models import Master, MonthlyProd

router = APIRouter(prefix="/api", tags=["analysis"])


@router.get("/abc")
def get_abc_rate_change(
    analyze_by: str = Query("element", description="'element' or 'well'"),
    field: Optional[str] = None,
    reservoir: Optional[str] = None,
    platform: Optional[str] = None,
    element_number: Optional[str] = None,
    well: Optional[str] = None,
    ref_date: Optional[date] = None,
    db: Session = Depends(get_db),
):
    if ref_date:
        max_date = ref_date
    else:
        max_date = db.query(func.max(MonthlyProd.Date)).scalar()
    if not max_date:
        return {"items": [], "latest_date": None}

    master_q = db.query(Master)
    if field:
        master_q = master_q.filter(Master.Field == field)
    if reservoir:
        master_q = master_q.filter(Master.Reservoir == reservoir)
    if platform:
        master_q = master_q.filter(Master.Platform == platform)
    if element_number:
        master_q = master_q.filter(Master.ElementNumber == element_number)
    if well:
        master_q = master_q.filter(Master.UniqueId == well)

    masters = {m.UniqueId: m for m in master_q.all()}
    if not masters:
        return {"items": [], "latest_date": max_date.isoformat()}

    uid_list = list(masters.keys())

    periods = [3, 6, 9, 12]
    target_months = {max_date}
    for p in periods:
        target_months.add(max_date - relativedelta(months=p))

    rows = (
        db.query(MonthlyProd)
        .filter(
            MonthlyProd.UniqueId.in_(uid_list),
            MonthlyProd.Date.in_(list(target_months)),
        )
        .all()
    )

    rate_map = {}
    for r in rows:
        oil = r.OilRate or 0
        liq = r.LiqRate or 0
        rate_map[(r.UniqueId, r.Date)] = {
            "OilRate": oil,
            "LiqRate": liq,
            "WCT": round(100.0 * (liq - oil) / liq, 2) if liq > 0 else 0,
        }

    if analyze_by == "well":
        entities = {}
        for uid, m in masters.items():
            entities[uid] = {
                "name": uid,
                "label": m.WellName or uid,
                "element": m.ElementNumber,
                "field": m.Field,
                "region": m.Region,
                "reservoir": m.Reservoir,
                "platform": m.Platform,
                "uids": [uid],
            }
    else:
        entities = {}
        for uid, m in masters.items():
            en = m.ElementNumber or "Unknown"
            if en not in entities:
                entities[en] = {
                    "name": en,
                    "label": en,
                    "element": en,
                    "field": m.Field,
                    "region": m.Region,
                    "reservoir": m.Reservoir,
                    "platform": m.Platform,
                    "uids": [],
                }
            entities[en]["uids"].append(uid)

    items = []
    for key, ent in entities.items():
        def sum_rates(dt, _uids=ent["uids"]):
            oil = 0.0
            liq = 0.0
            for uid in _uids:
                r = rate_map.get((uid, dt))
                if r:
                    oil += r["OilRate"]
                    liq += r["LiqRate"]
            wct = round(100.0 * (liq - oil) / liq, 2) if liq > 0 else 0
            return oil, liq, wct

        current_oil, current_liq, current_wct = sum_rates(max_date)

        item = {
            "name": ent["name"],
            "label": ent["label"],
            "element": ent["element"],
            "field": ent["field"],
            "region": ent["region"],
            "reservoir": ent["reservoir"],
            "region": ent["region"],
            "platform": ent["platform"],
            "well_count": len(ent["uids"]),
            "current_oil_rate": round(current_oil, 2),
            "current_liq_rate": round(current_liq, 2),
            "current_wct": current_wct,
        }

        for p in periods:
            past_date = max_date - relativedelta(months=p)
            past_oil, past_liq, past_wct = sum_rates(past_date)
            item[f"oil_rate_{p}m_ago"] = round(past_oil, 2)
            item[f"liq_rate_{p}m_ago"] = round(past_liq, 2)
            item[f"wct_{p}m_ago"] = past_wct
            item[f"delta_oil_{p}m"] = round(current_oil - past_oil, 2)
            item[f"delta_liq_{p}m"] = round(current_liq - past_liq, 2)
            item[f"delta_wct_{p}m"] = round(current_wct - past_wct, 2)
            item[f"pct_oil_{p}m"] = round(((current_oil - past_oil) / past_oil) * 100, 1) if past_oil else None
            item[f"pct_liq_{p}m"] = round(((current_liq - past_liq) / past_liq) * 100, 1) if past_liq else None
            wc_prev = past_wct
            delta_oil_total = current_oil - past_oil
            delta_oil_liq = (current_liq - past_liq) * (100 - wc_prev) / 100
            delta_oil_wct = delta_oil_total - delta_oil_liq
            item[f"decomp_liq_{p}m"] = round(delta_oil_liq, 2)
            item[f"decomp_wct_{p}m"] = round(delta_oil_wct, 2)

        items.append(item)

    items.sort(key=lambda x: x["current_oil_rate"], reverse=True)

    return {
        "items": items,
        "latest_date": max_date.isoformat(),
        "analyze_by": analyze_by,
    }


@router.get("/abc/tracking")
def get_abc_tracking(
    period: int = Query(3, description="Sliding window size in months"),
    analyze_by: str = Query("element", description="'element' or 'well'"),
    field: Optional[str] = None,
    reservoir: Optional[str] = None,
    platform: Optional[str] = None,
    element_number: Optional[str] = None,
    well: Optional[str] = None,
    ref_date: Optional[date] = None,
    db: Session = Depends(get_db),
):
    master_q = db.query(Master)
    if field:
        master_q = master_q.filter(Master.Field == field)
    if reservoir:
        master_q = master_q.filter(Master.Reservoir == reservoir)
    if platform:
        master_q = master_q.filter(Master.Platform == platform)
    if element_number:
        master_q = master_q.filter(Master.ElementNumber == element_number)
    if well:
        master_q = master_q.filter(Master.UniqueId == well)

    masters = {m.UniqueId: m for m in master_q.all()}
    if not masters:
        return {"tracks": {}}

    uid_list = list(masters.keys())

    prod_q = (
        db.query(
            MonthlyProd.UniqueId,
            MonthlyProd.Date,
            MonthlyProd.OilRate,
            MonthlyProd.LiqRate,
        )
        .filter(MonthlyProd.UniqueId.in_(uid_list))
    )
    if ref_date:
        prod_q = prod_q.filter(MonthlyProd.Date <= ref_date)

    rows = prod_q.all()
    if not rows:
        return {"tracks": {}}

    df = pd.DataFrame(rows, columns=["UniqueId", "Date", "OilRate", "LiqRate"])
    df["OilRate"] = df["OilRate"].fillna(0.0)
    df["LiqRate"] = df["LiqRate"].fillna(0.0)

    if analyze_by == "well":
        groups = {uid: [uid] for uid in uid_list}
    else:
        groups = {}
        for uid, m in masters.items():
            en = m.ElementNumber or "Unknown"
            groups.setdefault(en, []).append(uid)

    tracks = {}
    for key, uids in groups.items():
        grp = df[df["UniqueId"].isin(uids)]
        if grp.empty:
            continue

        agg = (
            grp.groupby("Date")[["OilRate", "LiqRate"]]
            .sum()
            .sort_index()
        )

        oil = agg["OilRate"].values
        liq = agg["LiqRate"].values

        if len(oil) <= period:
            continue

        delta_oil = np.round(oil[period:] - oil[:-period], 2)
        delta_liq = np.round(liq[period:] - liq[:-period], 2)

        path = np.zeros((len(delta_oil) + 1, 2))
        path[1:, 0] = delta_oil
        path[1:, 1] = delta_liq
        tracks[key] = path.tolist()

    return {"tracks": tracks}
