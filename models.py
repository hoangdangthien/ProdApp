from sqlalchemy.orm import declarative_base
from sqlalchemy import Column, String, Date, Float, Text,UnicodeText
from typing import  Dict, Any
import numpy as np
from sqlalchemy.dialects.mssql import NVARCHAR
#Declare base
Base = declarative_base()

# Model Definition
class Master(Base):
    __tablename__ = "Master"

    UniqueId = Column(String(50),primary_key=True)
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
    __tablename__ = 'MonthlyProd'
    
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
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'UniqueId': self.UniqueId,
            'Date': self.Date.isoformat() if self.Date else None,
            'DayOn': np.round(self.DayOn,2),
            'Method': self.Method,
            'Qoil': np.round(self.Qoil,3),
            'Qwater': np.round(self.Qwater,3),
            'Qliq': np.round(self.Qliq,3),
            'Qgas': np.round(self.Qgas,3),
            'WOR': np.round(self.WOR,3),
            'WC': np.round(self.WC,3),
            'GOR': np.round(self.GOR,3),
            'WaterRate': np.round(self.WaterRate,3),
            'LiqRate': np.round(self.LiqRate,3),
            'OilRate': np.round(self.OilRate,3),
            'GasRate': np.round(self.GasRate,3),
            'ChokeSize': np.round(self.ChokeSize,2),
            'Press_WH': np.round(self.Press_WH,1),
            'Note': self.Note
        }
class MonthlyInj(Base):
    __tablename__ = "MonthlyInj"

    UniqueId = Column(String(50), primary_key=True)
    Date = Column(Date, primary_key=True)
    DayOn = Column(Float)
    Qwater = Column(Float)
    WaterInj_Rate = Column(Float)
    Pb = Column(Float)
    Note = Column(UnicodeText)
    def to_dict(self):
        return {
            'UniqueId': self.UniqueId,
            'Date': self.Date.isoformat() if self.Date else None,
            'DayOn': np.round(self.DayOn,2),
            "Qwater":np.round(self.Qwater,3),
            "WaterInjRate":np.round(self.WaterInj_Rate,3),
            "Pb": np.round(self.Pb,3),
            "Note":self.Note
        }
