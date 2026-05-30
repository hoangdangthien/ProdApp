from sqlalchemy.orm import declarative_base
from sqlalchemy import Column, String, Date, Float, UnicodeText
from database import Base


class Master(Base):
    __tablename__ = "Master"

    UniqueId = Column(String(50), primary_key=True)
    Region = Column(String(50))
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
