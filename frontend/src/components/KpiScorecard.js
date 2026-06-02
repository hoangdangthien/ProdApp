import React from "react";

/*
 * KpiScorecard
 * ------------
 * Year-to-date KPI strip for the dashboard scope. Driven by the `scorecard`
 * object from /api/production/kpi-summary. Cumulative Qoil actual vs Council
 * Plan (Base) attainment, plus YTD oil/liquid throughput and WC / GOR / VRR.
 */

const fmt = (v, digits = 1) =>
  v == null || Number.isNaN(v) ? "—" : Number(v).toLocaleString(undefined, {
    minimumFractionDigits: digits, maximumFractionDigits: digits,
  });

function Card({ label, value, unit, sub, accent = "#1976d2", subColor }) {
  return (
    <div style={{
      flex: "1 1 150px", minWidth: 140, background: "#fff",
      border: "1px solid #e0e0e0", borderTop: `3px solid ${accent}`,
      borderRadius: 6, padding: "10px 14px",
      boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
    }}>
      <div style={{ fontSize: 12, color: "#666", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: "#212121", marginTop: 4, lineHeight: 1.1 }}>
        {value}
        {unit && <span style={{ fontSize: 13, fontWeight: 600, color: "#888", marginLeft: 4 }}>{unit}</span>}
      </div>
      {sub && (
        <div style={{ fontSize: 12, color: subColor || "#888", marginTop: 4 }}>{sub}</div>
      )}
    </div>
  );
}

function KpiScorecard({ scorecard, loading }) {
  if (loading) {
    return <div className="loading">Loading KPIs...</div>;
  }
  if (!scorecard || scorecard.latest_month == null) {
    return (
      <div style={{ padding: "16px", color: "#888", fontSize: 14 }}>
        No production data for the selected scope and year.
      </div>
    );
  }

  const att = scorecard.attainment_pct;
  const attColor = att == null ? "#888" : att >= 100 ? "#2e7d32" : att >= 90 ? "#ef6c00" : "#c62828";
  const attArrow = att == null ? "" : att >= 100 ? "▲" : "▼";

  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
      <Card
        label="Oil — YTD Actual"
        value={fmt(scorecard.qoil_actual_kt)}
        unit="kt"
        accent="#2e7d32"
        sub={`Plan ${fmt(scorecard.qoil_plan_kt)} kt`}
      />
      <Card
        label="Plan Attainment"
        value={att == null ? "—" : `${fmt(att)}%`}
        accent={attColor}
        subColor={attColor}
        sub={att == null ? "no plan" : `${attArrow} vs Council Plan`}
      />
      <Card
        label="Avg Oil / month"
        value={fmt(scorecard.oil_rate_avg / 1000)}
        unit="kt"
        accent="#388e3c"
      />
      <Card
        label="Avg Liquid / month"
        value={fmt(scorecard.liq_rate_avg / 1000)}
        unit="kt"
        accent="#00897b"
      />
      <Card
        label="Water Cut (YTD)"
        value={scorecard.wc_pct == null ? "—" : fmt(scorecard.wc_pct)}
        unit="%"
        accent="#1976d2"
      />
      <Card
        label="GOR (YTD)"
        value={scorecard.gor == null ? "—" : fmt(scorecard.gor)}
        unit="m³/t"
        accent="#d32f2f"
      />
      <Card
        label="VRR (latest)"
        value={scorecard.vrr_latest == null ? "—" : fmt(scorecard.vrr_latest, 2)}
        accent="#7b1fa2"
        sub={scorecard.latest_month}
      />
    </div>
  );
}

export default KpiScorecard;
