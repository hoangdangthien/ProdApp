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

class OOIP(BaseModel):
    Completion: str
    OOIP: Optional[float] = None
    RF: Optional[float] = None
    EUR: Optional[float] = None
    PVT_GOR: Optional[float] = None
    PVT_Bo: Optional[float] = None
    PVT_OilDensity: Optional[float] = None
    PVT_OilVis: Optional[float] = None
    PVT_OilDensityRes: Optional[float] = None
    PVT_Visocsity: Optional[float] = None
    PVT_Psat: Optional[float] = None
    PVT_OilCompress: Optional[float] = None
    PVT_Tini: Optional[float] = None
    PVT_PTini: Optional[float] = None
    PVT_VolExpand: Optional[float] = None
    PVT_Sample: Optional[str] = None

    class Config:
        from_attributes = True

class CurrentCouncilPlanOut(BaseModel):
    UniqueId: str
    Date: Optional[date] = None
    Qoil: Optional[float] = None
    Qgas: Optional[float] = None
    Qliq: Optional[float] = None
    OilRate: Optional[float] = None
    LiqRate: Optional[float] = None
    Case: Optional[str] = None

    class Config:
        from_attributes = True


class WIT_PlanOut(BaseModel):
    UniqueId: str
    Date: Optional[date] = None
    Qoil: Optional[float] = None
    Qgas: Optional[float] = None
    Qliq: Optional[float] = None
    OilRate: Optional[float] = None
    LiqRate: Optional[float] = None
    Case: Optional[str] = None

    class Config:
        from_attributes = True


class WIT_ActOut(BaseModel):
    UniqueId: str
    Date: Optional[date] = None
    Qoil: Optional[float] = None
    Qgas: Optional[float] = None
    Qliq: Optional[float] = None
    OilRate: Optional[float] = None
    LiqRate: Optional[float] = None
    Case: Optional[str] = None

    class Config:
        from_attributes = True


class PPD_PlanOut(BaseModel):
    UniqueId: str
    Date: Optional[date] = None
    DayOn: Optional[float] = None
    QWaterInj: Optional[float] = None
    WaterInj_Rate: Optional[float] = None
    Press_WH: Optional[float] = None
    Note: Optional[str] = None

    class Config:
        from_attributes = True


class OTMOut(BaseModel):
    OTMID: str
    Date: Optional[date] = None
    OTMProd: Optional[float] = None
    OTMInj: Optional[float] = None

    class Config:
        from_attributes = True


class FilterOptions(BaseModel):
    fields: list[str] = []
    reservoirs: list[str] = []
    platforms: list[str] = []
    unique_ids: list[str] = []
