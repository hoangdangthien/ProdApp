from sqlalchemy.orm import declarative_base
from sqlalchemy import Column, String, Date, Float, Integer, UnicodeText
from database import Base


class Master(Base):
    __tablename__ = "Master"

    UniqueId = Column(String(50), primary_key=True)
    Region = Column(String(50))
    Block = Column(String(50))
    WellBore = Column(String(50))
    WellName = Column(String(50))
    WellNumber = Column(String(50))
    X_coord = Column(Float)
    Y_coord = Column(Float)
    Z_coord = Column(Float)
    X_mid = Column(Float)
    Y_mid = Column(Float)
    Z_mid = Column(Float)
    X_bot = Column(Float)
    Y_bot = Column(Float)
    Z_bot = Column(Float)
    Field = Column(String(50))
    Platform = Column(String(50))
    Reservoir = Column(String(50))
    Completion = Column(String(50))
    WellStatus = Column(String(50))
    PercentageVSP = Column(Float)
    ElementNumber = Column(String(50))
    RegionNIRII1 = Column(String(50))
    Di_Oil = Column(Float)
    b_Oil = Column(Float)
    Starting_DCA_OilRate = Column(Float)
    Di_Liq = Column(Float)
    b_Liq = Column(Float)
    Starting_DCA_LiqRate = Column(Float)
    Starting_DCA_Date = Column(Date)


class MonthlyProd(Base):
    __tablename__ = "MonthlyProd"

    UniqueId = Column(String(50), primary_key=True)
    Date = Column(Date, primary_key=True)
    DayOn = Column(Float)
    Method = Column(String(50))
    Qoil = Column(Float)
    Qwater = Column(Float)
    Qliq = Column(Float)
    Qgas = Column(Float)
    WOR = Column(Float)
    WC = Column(Float)
    GOR = Column(Float)
    WaterRate = Column(Float)
    LiqRate = Column(Float)
    OilRate = Column(Float)
    GasRate = Column(Float)
    ChokeSize = Column(Float)
    Press_WH = Column(Float)
    Note = Column(UnicodeText)


class MonthlyInj(Base):
    __tablename__ = "MonthlyInj"

    UniqueId = Column(String(50), primary_key=True)
    Date = Column(Date, primary_key=True)
    DayOn = Column(Float)
    Qwater = Column(Float)
    WaterInj_Rate = Column(Float)
    Pb = Column(Float)
    Note = Column(UnicodeText)

class OOIP(Base):
    __tablename__ = "OOIP"

    Completion = Column(String(50), primary_key=True)
    OOIP_value = Column("OOIP", Float)
    RF = Column(Float)
    EUR = Column(Float)
    PVT_GOR = Column(Float)
    PVT_Bo = Column(Float)
    PVT_OilDensity = Column(Float)
    PVT_OilDensityRes = Column(Float)
    PVT_Viscosity = Column(Float)
    PVT_Psat = Column(Float)
    PVT_OilCompress = Column(Float)
    PVT_Tini = Column(Float)
    PVT_Pini = Column(Float)
    PVT_VolExpand = Column(Float)
    PVT_Sample = Column(UnicodeText)


class CurrentCouncilPlan(Base):
    __tablename__ = "CurrentCouncilPlan"

    UniqueId = Column(String(50), primary_key=True)
    Date = Column(Date, primary_key=True)
    Case = Column(String(50), primary_key=True)
    Qoil = Column(Float)
    Qgas = Column(Float)
    Qliq = Column(Float)
    OilRate = Column(Float)
    LiqRate = Column(Float)


class WIT_Plan(Base):
    __tablename__ = "WIT_Plan"

    UniqueId = Column(String(50), primary_key=True)
    Date = Column(Date, primary_key=True)
    Case = Column(String(50), primary_key=True)
    Qoil = Column(Float)
    Qgas = Column(Float)
    Qliq = Column(Float)
    OilRate = Column(Float)
    LiqRate = Column(Float)


class WIT_Act(Base):
    __tablename__ = "WIT_Act"

    UniqueId = Column(String(50), primary_key=True)
    Date = Column(Date, primary_key=True)
    Case = Column(String(50), primary_key=True)
    Qoil = Column(Float)
    Qgas = Column(Float)
    Qliq = Column(Float)
    OilRate = Column(Float)
    LiqRate = Column(Float)


class PPD_Plan(Base):
    __tablename__ = "PPD_Plan"

    UniqueId = Column(String(50), primary_key=True)
    Date = Column(Date, primary_key=True)
    DayOn = Column(Float)
    QWaterInj = Column(Float)
    WaterInj_Rate = Column(Float)
    Press_WH = Column(Float)
    Note = Column(UnicodeText)


class OTM(Base):
    __tablename__ = "OTM"

    OTMID = Column(String(50), primary_key=True)
    Date = Column(Date, primary_key=True)
    OTMProd = Column(Float)
    OTMInj = Column(Float)