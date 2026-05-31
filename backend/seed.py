"""Seed SQLite database with realistic oil & gas test data."""
import random
import math
from datetime import date, timedelta
from database import engine, Base, SessionLocal
from models import Master, MonthlyProd, MonthlyInj, OOIP, CurrentCouncilPlan, WIT_Plan, WIT_Act, PPD_Plan, OTM

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
                    "Block": "Block 09-1" if fld in ("Bach Ho", "Rong") else "Block 05-1a",
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


PLAN_CASES = ["Base", "High", "Low"]
PLAN_START = date(2025, 1, 1)
PLAN_END = date(2030, 12, 1)


def generate_plan_data(model_cls, uid, start, end):
    rows = []
    qi_oil = random.uniform(20, 200)
    qi_liq = qi_oil * random.uniform(1.05, 1.4)
    di = random.uniform(0.008, 0.03)
    b = random.uniform(0.5, 1.2)
    base_gor = random.uniform(60, 250)

    for case in PLAN_CASES:
        case_mult = {"Base": 1.0, "High": 1.2, "Low": 0.8}[case]
        for i, dt in enumerate(month_range(start, end)):
            days = 28 + random.randint(0, 3)
            denom = (1 + b * di * i) ** (1 / b) if b > 0 else math.exp(di * i)
            oil_rate = max(0.3, qi_oil * case_mult / denom + random.gauss(0, 1))
            liq_rate = oil_rate * random.uniform(1.05, 1.5)
            gas_rate = oil_rate * base_gor / 1000

            qoil = oil_rate * days
            qliq = liq_rate * days
            qgas = gas_rate * days

            rows.append(model_cls(
                UniqueId=uid,
                Date=dt,
                Qoil=round(qoil, 3),
                Qgas=round(qgas, 3),
                Qliq=round(qliq, 3),
                OilRate=round(oil_rate, 3),
                LiqRate=round(liq_rate, 3),
                Case=case,
            ))
    return rows


def generate_ppd_plan(uid, start, end):
    rows = []
    qi = random.uniform(100, 500)
    for i, dt in enumerate(month_range(start, end)):
        days = 28 + random.randint(0, 3)
        day_on = max(0, days - random.randint(0, 4))
        if day_on == 0:
            continue
        rate = qi + random.gauss(0, 15)
        rows.append(PPD_Plan(
            UniqueId=uid,
            Date=dt,
            DayOn=day_on,
            QWaterInj=round(rate * day_on, 3),
            WaterInj_Rate=round(rate, 3),
            Press_WH=round(random.uniform(80, 200), 1),
            Note=None,
        ))
    return rows


def generate_otm(completions, start, end):
    rows = []
    for comp in completions:
        base_prod = random.uniform(500, 5000)
        base_inj = random.uniform(200, 3000)
        for i, dt in enumerate(month_range(start, end)):
            prod = max(0, base_prod * (1 - 0.005 * i) + random.gauss(0, 100))
            inj = max(0, base_inj + random.gauss(0, 80))
            rows.append(OTM(
                OTMID=comp,
                Date=dt,
                OTMProd=round(prod, 3),
                OTMInj=round(inj, 3),
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
                Block=w["Block"],
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

        print("Seeding OOIP data...")
        ooip_records = [
            OOIP(
                Completion="Perf",
                OOIP_value=45.6,
                RF=0.32,
                EUR=14.59,
                PVT_GOR=180.0,
                PVT_Bo=1.28,
                PVT_OilDensity=0.845,
                PVT_OilDensityRes=0.742,
                PVT_Viscosity=1.15,
                PVT_Psat=215.0,
                PVT_OilCompress=12.5e-5,
                PVT_Tini=126.0,
                PVT_Pini=310.0,
                PVT_VolExpand=1.08,
                PVT_Sample="BH-1X DST#2 (Mio-Lower)",
            ),
            OOIP(
                Completion="Gravel Pack",
                OOIP_value=28.3,
                RF=0.27,
                EUR=7.64,
                PVT_GOR=145.0,
                PVT_Bo=1.22,
                PVT_OilDensity=0.862,
                PVT_OilDensityRes=0.758,
                PVT_Viscosity=2.35,
                PVT_Psat=188.0,
                PVT_OilCompress=10.8e-5,
                PVT_Tini=118.0,
                PVT_Pini=285.0,
                PVT_VolExpand=1.05,
                PVT_Sample="RG-3P DST#1 (Oligocene)",
            ),
            OOIP(
                Completion="Open Hole",
                OOIP_value=62.1,
                RF=0.38,
                EUR=23.60,
                PVT_GOR=250.0,
                PVT_Bo=1.35,
                PVT_OilDensity=0.828,
                PVT_OilDensityRes=0.715,
                PVT_Viscosity=0.82,
                PVT_Psat=245.0,
                PVT_OilCompress=14.2e-5,
                PVT_Tini=135.0,
                PVT_Pini=340.0,
                PVT_VolExpand=1.12,
                PVT_Sample="BH-5X DST#3 (Basement)",
            ),
        ]
        db.add_all(ooip_records)

        print("Seeding CurrentCouncilPlan...")
        for w in WELLS:
            rows = generate_plan_data(CurrentCouncilPlan, w["UniqueId"], PLAN_START, PLAN_END)
            db.add_all(rows)

        print("Seeding WIT_Plan...")
        for w in WELLS:
            rows = generate_plan_data(WIT_Plan, w["UniqueId"], PLAN_START, PLAN_END)
            db.add_all(rows)

        print("Seeding WIT_Act...")
        for w in WELLS:
            wit_act_end = min(END_DATE, date(2025, 12, 1))
            rows = generate_plan_data(WIT_Act, w["UniqueId"], PLAN_START, wit_act_end)
            db.add_all(rows)

        print("Seeding PPD_Plan...")
        for uid in INJECTOR_IDS:
            rows = generate_ppd_plan(uid, PLAN_START, PLAN_END)
            db.add_all(rows)

        print("Seeding OTM...")
        completions = list({w["Completion"] for w in WELLS})
        rows = generate_otm(completions, START_DATE, END_DATE)
        db.add_all(rows)

        db.commit()

        master_count = db.query(Master).count()
        prod_count = db.query(MonthlyProd).count()
        inj_count = db.query(MonthlyInj).count()
        ooip_count = db.query(OOIP).count()
        ccp_count = db.query(CurrentCouncilPlan).count()
        wit_plan_count = db.query(WIT_Plan).count()
        wit_act_count = db.query(WIT_Act).count()
        ppd_count = db.query(PPD_Plan).count()
        otm_count = db.query(OTM).count()
        print(f"Done! Master: {master_count}, MonthlyProd: {prod_count}, MonthlyInj: {inj_count}, OOIP: {ooip_count}")
        print(f"  CurrentCouncilPlan: {ccp_count}, WIT_Plan: {wit_plan_count}, WIT_Act: {wit_act_count}, PPD_Plan: {ppd_count}, OTM: {otm_count}")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
