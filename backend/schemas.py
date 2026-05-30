from pydantic import BaseModel
from typing import Optional
from datetime import date


class MasterOut(BaseModel):
    UniqueId: str
    Region: Optional[str] = None
    WellBore: Optional[str] = None
    WellName: Optional[str] = None
    WellNumber: Optional[str] = None
    Field: Optional[str] = None
    Platform: Optional[str] = None
    Reservoir: Optional[str] = None
    Completion: Optional[str] = None
    WellStatus: Optional[str] = None
    ElementNumber: Optional[str] = None

    class Config:
        from_attributes = True


class MonthlyProdOut(BaseModel):
    UniqueId: str
    Date: Optional[date] = None
    DayOn: Optional[float] = None
    Method: Optional[str] = None
    Qoil: Optional[float] = None
    Qwater: Optional[float] = None
    Qliq: Optional[float] = None
    Qgas: Optional[float] = None
    WOR: Optional[float] = None
    WC: Optional[float] = None
    GOR: Optional[float] = None
    WaterRate: Optional[float] = None
    LiqRate: Optional[float] = None
    OilRate: Optional[float] = None
    GasRate: Optional[float] = None
    ChokeSize: Optional[float] = None
    Press_WH: Optional[float] = None
    Note: Optional[str] = None

    class Config:
        from_attributes = True


class MonthlyInjOut(BaseModel):
    UniqueId: str
    Date: Optional[date] = None
    DayOn: Optional[float] = None
    Qwater: Optional[float] = None
    WaterInj_Rate: Optional[float] = None
    Pb: Optional[float] = None
    Note: Optional[str] = None

    class Config:
        from_attributes = True


class FilterOptions(BaseModel):
    fields: list[str] = []
    reservoirs: list[str] = []
    platforms: list[str] = []
    unique_ids: list[str] = []
