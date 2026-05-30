"""Seed SQLite database with realistic oil & gas test data."""
import random
import math
from datetime import date, timedelta
from database import engine, Base, SessionLocal
from models import Master, MonthlyProd, MonthlyInj

random.seed(42)

FIELDS = ["Bach Ho", "Rong", "Dai Hung"]
PLATFORMS = {
    "Bach Ho": ["BK-1", "BK-2", "BK-3", "BK-4"],
    "Rong": ["RP-1", "RP-2", "RP-3"],
    "Dai Hung": ["DH-1", "DH-2"],
}
RESERVOIRS = {
    "Bach Ho": ["Mio-Lower", "Mio-Upper", "Oligocene", "Basement"],
    "Rong": ["Mio-Lower", "Oligocene", "Basement"],
    "Dai Hung": ["Mio-Lower", "Mio-Upper"],
}

WELLS = []
uid_counter = 1
for fld in FIELDS:
    for plat in PLATFORMS[fld]:
        for res in RESERVOIRS[fld]:
            n_wells = random.randint(2, 4)
            for w in range(1, n_wells + 1):
                uid = f"{plat}-{res[:3]}{uid_counter:02d}"
                elem = f"E-{fld[:2].upper()}-{random.randint(1,5):02d}"
                WELLS.append({
                    "UniqueId": uid,
                    "Field": fld,
                    "Platform": plat,
                    "Reservoir": res,
                    "WellName": f"Well {plat}/{w}",
                    "WellNumber": str(uid_counter),
                    "ElementNumber": elem,
                    "WellBore": f"WB-{uid_counter}",
                    "Region": "Block 09-1" if fld == "Bach Ho" else "Block 09-3" if fld == "Rong" else "Block 05-1a",
                    "Completion": random.choice(["Perf", "Gravel Pack", "Open Hole"]),
                    "WellStatus": random.choice(["Producing", "Producing", "Producing", "Shut-in"]),
                    "X_coord": 107.0 + random.uniform(-0.5, 0.5),
                    "Y_coord": 10.0 + random.uniform(-0.5, 0.5),
                    "Z_coord": -random.uniform(2000, 4500),
                })
                uid_counter += 1

# Some wells as injectors
INJECTOR_IDS = [w["UniqueId"] for w in random.sample(WELLS, min(12, len(WELLS)))]

START_DATE = date(2018, 1, 1)
END_DATE = date(2025, 12, 1)


def month_range(start, end):
    d = start
    while d <= end:
        yield d
        m = d.month + 1
        y = d.year
        if m > 12:
            m = 1
            y += 1
        d = date(y, m, 1)


def generate_prod(uid, start, end):
    """Generate declining production profile."""
    rows = []
    qi_oil = random.uniform(30, 250)   # initial oil rate t/d
    qi_liq = qi_oil * random.uniform(1.0, 1.3)
    di = random.uniform(0.01, 0.04)    # monthly decline
    b = random.uniform(0.5, 1.5)       # hyperbolic exponent
    base_gor = random.uniform(50, 300)
    wc_init = random.uniform(0.05, 0.3)

    for i, dt in enumerate(month_range(start, end)):
        days = 28 + random.randint(0, 3)
        day_on = max(0, days - random.randint(0, 3))
        if day_on == 0:
            continue

        # Hyperbolic decline
        denom = (1 + b * di * i) ** (1 / b) if b > 0 else math.exp(di * i)
        oil_rate = max(0.5, qi_oil / denom + random.gauss(0, 2))

        # Water cut increases over time
        wc = min(0.98, wc_init + 0.003 * i + random.gauss(0, 0.01))
        liq_rate = oil_rate / max(0.02, 1 - wc)
        water_rate = liq_rate - oil_rate

        gor = base_gor * (1 + 0.005 * i) + random.gauss(0, 10)
        gas_rate = oil_rate * gor / 1000

        qoil = oil_rate * day_on
        qwater = water_rate * day_on
        qliq = liq_rate * day_on
        qgas = gas_rate * day_on

        rows.append(MonthlyProd(
            UniqueId=uid,
            Date=dt,
            DayOn=day_on,
            Method=random.choice(["ESP", "GL", "NF"]),
            Qoil=round(qoil, 3),
            Qwater=round(qwater, 3),
            Qliq=round(qliq, 3),
            Qgas=round(qgas, 3),
            WOR=round(water_rate / max(0.01, oil_rate), 3),
            WC=round(wc, 3),
            GOR=round(gor, 3),
            WaterRate=round(water_rate, 3),
            LiqRate=round(liq_rate, 3),
            OilRate=round(oil_rate, 3),
            GasRate=round(gas_rate, 3),
            ChokeSize=round(random.uniform(8, 24), 1),
            Press_WH=round(random.uniform(5, 35), 1),
            Note=None,
        ))
    return rows


def generate_inj(uid, start, end):
    rows = []
    qi = random.uniform(100, 500)
    for i, dt in enumerate(month_range(start, end)):
        days = 28 + random.randint(0, 3)
        day_on = max(0, days - random.randint(0, 5))
        if day_on == 0:
            continue
        rate = qi + random.gauss(0, 20)
        rows.append(MonthlyInj(
            UniqueId=uid,
            Date=dt,
            DayOn=day_on,
            Qwater=round(rate * day_on, 3),
            WaterInj_Rate=round(rate, 3),
            Pb=round(random.uniform(100, 250), 3),
            Note=None,
        ))
    return rows


def seed():
    print("Creating tables...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        print(f"Seeding {len(WELLS)} wells...")
        for w in WELLS:
            db.add(Master(
                UniqueId=w["UniqueId"],
                Region=w["Region"],
                WellBore=w["WellBore"],
                WellName=w["WellName"],
                WellNumber=w["WellNumber"],
                X_coord=w["X_coord"],
                Y_coord=w["Y_coord"],
                Z_coord=w["Z_coord"],
                X_mid=w["X_coord"] + random.uniform(-0.01, 0.01),
                Y_mid=w["Y_coord"] + random.uniform(-0.01, 0.01),
                Z_mid=w["Z_coord"] - random.uniform(100, 300),
                X_bot=w["X_coord"] + random.uniform(-0.02, 0.02),
                Y_bot=w["Y_coord"] + random.uniform(-0.02, 0.02),
                Z_bot=w["Z_coord"] - random.uniform(300, 600),
                Field=w["Field"],
                Platform=w["Platform"],
                Reservoir=w["Reservoir"],
                Completion=w["Completion"],
                WellStatus=w["WellStatus"],
                PercentageVSP=random.uniform(0, 100),
                ElementNumber=w["ElementNumber"],
                RegionNIRII1=None,
                Di_Oil=random.uniform(0.01, 0.05),
                b_Oil=random.uniform(0.5, 1.5),
                Starting_DCA_OilRate=random.uniform(30, 200),
                Di_Liq=random.uniform(0.01, 0.05),
                b_Liq=random.uniform(0.5, 1.5),
                Starting_DCA_LiqRate=random.uniform(50, 300),
                Starting_DCA_Date=START_DATE + timedelta(days=random.randint(0, 365)),
            ))

        print("Seeding production data...")
        for w in WELLS:
            well_start = START_DATE + timedelta(days=random.randint(0, 365))
            rows = generate_prod(w["UniqueId"], well_start, END_DATE)
            db.add_all(rows)

        print("Seeding injection data...")
        for uid in INJECTOR_IDS:
            inj_start = START_DATE + timedelta(days=random.randint(180, 730))
            rows = generate_inj(uid, inj_start, END_DATE)
            db.add_all(rows)

        db.commit()

        master_count = db.query(Master).count()
        prod_count = db.query(MonthlyProd).count()
        inj_count = db.query(MonthlyInj).count()
        print(f"Done! Master: {master_count}, MonthlyProd: {prod_count}, MonthlyInj: {inj_count}")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
