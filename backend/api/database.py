from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import distinct
from typing import Optional

from database import get_db
from models import Master, MonthlyProd, MonthlyInj
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
            "GOR": row.GOR,
            "Qoil": row.Qoil,
            "Qliq": row.Qliq,
            "Qgas": row.Qgas,
            "WC": row.WC,
            "WaterRate": row.WaterRate,
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
