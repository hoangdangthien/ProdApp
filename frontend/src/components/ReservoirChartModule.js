import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, LabelList,
} from "recharts";
import { getCascadingFilters } from "../api";
import "./ScatterPlotModule.css";
import { downloadChartAsPng, DownloadPngButton } from "./chartDownload";
import EditableLabel from "./EditableLabel";
import EditableValueLabel from "./EditableValueLabel";

const COLORS = {
  OilRate: "#2e7d32",
  GOR: "#d32f2f",
  WC: "#1976d2",
  VRR: "#7b1fa2",
};

function ReservoirChartModule({ fields, resField, resReservoir, onFieldChange, onReservoirChange, data, loading }) {
  const [filteredReservoirs, setFilteredReservoirs] = useState([]);
  const [legendLabels, setLegendLabels] = useState({
    OilRate: "Sản lượng dầu",
    GOR: "Tỉ số khí dầu",
    WC: "Độ ngập nước",
    VRR: "Hệ số bù khai thác",
  });
  const [showDataLabels, setShowDataLabels] = useState(false);
  const [valueOverrides, setValueOverrides] = useState({});
  const handleValueOverride = useCallback((seriesKey) => (index, val) => {
    setValueOverrides((prev) => ({ ...prev, [seriesKey]: { ...(prev[seriesKey] || {}), [index]: val } }));
  }, []);
  const chartRef = useRef(null);

  const handleLegendChange = useCallback((key, val) => {
    setLegendLabels((prev) => ({ ...prev, [key]: val }));
  }, []);

  const handleDownload = useCallback(() => {
    const svg = chartRef.current?.querySelector("svg");
    downloadChartAsPng(svg, "Reservoir_Production_VRR.png");
  }, []);

  useEffect(() => {
    if (!resField) { setFilteredReservoirs([]); return; }
    getCascadingFilters({ field: resField }).then((res) => {
      setFilteredReservoirs(res.data.reservoirs || []);
    }).catch(() => {});
  }, [resField]);

  return (
    <div className="spm" style={{ marginBottom: 24 }}>
      <div className="spm-header">
        <span className="spm-header-title">
          <span className="spm-header-icon">⠿</span> Reservoir Production &amp; VRR
        </span>
        {data.length > 0 && resField && resReservoir && <DownloadPngButton onClick={handleDownload} />}
      </div>
      <div
        className={`spm-edit-tab ${showDataLabels ? "active" : ""}`}
        onClick={() => setShowDataLabels((v) => !v)}
        title="Toggle data labels"
        style={{ cursor: "pointer" }}
      >
        {showDataLabels ? "Labels: ON" : "Labels: OFF"}
      </div>
      <div style={{ display: "flex", gap: 12, padding: "8px 16px", alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ fontWeight: 600, fontSize: 13 }}>Field:</label>
        <select value={resField} onChange={(e) => onFieldChange(e.target.value)} style={{ padding: "4px 8px", fontSize: 13 }}>
          <option value="">-- Select Field --</option>
          {fields.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <label style={{ fontWeight: 600, fontSize: 13 }}>Reservoir:</label>
        <select value={resReservoir} onChange={(e) => onReservoirChange(e.target.value)} style={{ padding: "4px 8px", fontSize: 13 }} disabled={!resField}>
          <option value="">-- Select Reservoir --</option>
          {filteredReservoirs.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div className="spm-plot" ref={chartRef}>
        {loading ? (
          <div className="spm-empty" style={{ height: 380 }}>Loading...</div>
        ) : !resField || !resReservoir ? (
          <div className="spm-empty" style={{ height: 380 }}>Select a Field and Reservoir to view chart</div>
        ) : data.length === 0 ? (
          <div className="spm-empty" style={{ height: 380 }}>No data</div>
        ) : (
          <ResponsiveContainer width="100%" height={380}>
            <ComposedChart data={data} margin={{ top: 16, right: 80, bottom: 24, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="Date" tick={{ fontSize: 11 }} minTickGap={24} />

              <YAxis
                yAxisId="qoil"
                orientation="left"
                tick={{ fontSize: 11 }}
                label={{ value: "OilRate (t)", angle: -90, position: "insideLeft", style: { fontSize: 11, textAnchor: "middle" } }}
              />
              <YAxis
                yAxisId="gor"
                orientation="right"
                tick={{ fontSize: 11, fill: COLORS.GOR }}
                axisLine={{ stroke: COLORS.GOR }}
                tickLine={{ stroke: COLORS.GOR }}
                label={{ value: "GOR (m³/t)", angle: 90, position: "insideRight", style: { fontSize: 11, textAnchor: "middle", fill: COLORS.GOR } }}
              />
              <YAxis
                yAxisId="wc"
                orientation="right"
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: COLORS.WC }}
                axisLine={{ stroke: COLORS.WC }}
                tickLine={{ stroke: COLORS.WC }}
                width={50}
                label={{ value: "WC (%)", angle: 90, position: "insideRight", style: { fontSize: 11, textAnchor: "middle", fill: COLORS.WC } }}
                hide
              />
              <YAxis
                yAxisId="vrr"
                orientation="right"
                tick={{ fontSize: 11, fill: COLORS.VRR }}
                axisLine={{ stroke: COLORS.VRR }}
                tickLine={{ stroke: COLORS.VRR }}
                width={50}
                label={{ value: "VRR", angle: 90, position: "insideRight", style: { fontSize: 11, textAnchor: "middle", fill: COLORS.VRR } }}
              />

              <Tooltip formatter={(value, name) => [typeof value === "number" ? value.toFixed(2) : value, name]} />
              <Legend content={({ payload }) => {
                const order = ["OilRate", "GOR", "WC", "VRR"];
                const sorted = order.map(key => payload.find(p => p.dataKey === key)).filter(Boolean);
                return (
                  <div style={{ display: "flex", justifyContent: "center", gap: 16, fontSize: 12 }}>
                    {sorted.map((entry, i) => (
                      <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 14, height: 3, backgroundColor: entry.color, display: "inline-block", borderRadius: 1 }} />
                        <EditableLabel
                          value={legendLabels[entry.dataKey] || entry.value}
                          onChange={(v) => handleLegendChange(entry.dataKey, v)}
                        />
                      </span>
                    ))}
                  </div>
                );
              }} />

              <Line yAxisId="qoil" type="monotone" dataKey="OilRate" name={legendLabels.OilRate} stroke={COLORS.OilRate} strokeWidth={2} dot={{ r: 2, fill: COLORS.OilRate }}>
                {showDataLabels && <LabelList dataKey="OilRate" position="top" content={(props) => (
                  <EditableValueLabel {...props} fontSize={9} fontWeight={500} formatter={(v) => typeof v === "number" ? v.toFixed(1) : v} overrides={valueOverrides.OilRate} onOverride={handleValueOverride("OilRate")} />
                )} />}
              </Line>
              <Line yAxisId="gor" type="monotone" dataKey="GOR" name={legendLabels.GOR} stroke={COLORS.GOR} strokeWidth={2} dot={{ r: 2, fill: COLORS.GOR }}>
                {showDataLabels && <LabelList dataKey="GOR" position="top" content={(props) => (
                  <EditableValueLabel {...props} fontSize={9} fontWeight={500} formatter={(v) => typeof v === "number" ? v.toFixed(1) : v} overrides={valueOverrides.GOR} onOverride={handleValueOverride("GOR")} />
                )} />}
              </Line>
              <Line yAxisId="wc" type="monotone" dataKey="WC" name={legendLabels.WC} stroke={COLORS.WC} strokeWidth={2} dot={{ r: 2, fill: COLORS.WC }}>
                {showDataLabels && <LabelList dataKey="WC" position="top" content={(props) => (
                  <EditableValueLabel {...props} fontSize={9} fontWeight={500} formatter={(v) => typeof v === "number" ? v.toFixed(1) : v} overrides={valueOverrides.WC} onOverride={handleValueOverride("WC")} />
                )} />}
              </Line>
              <Line yAxisId="vrr" type="monotone" dataKey="VRR" name={legendLabels.VRR} stroke={COLORS.VRR} strokeWidth={2} dot={{ r: 2, fill: COLORS.VRR }} connectNulls>
                {showDataLabels && <LabelList dataKey="VRR" position="top" content={(props) => (
                  <EditableValueLabel {...props} fontSize={9} fontWeight={500} formatter={(v) => typeof v === "number" ? v.toFixed(1) : v} overrides={valueOverrides.VRR} onOverride={handleValueOverride("VRR")} />
                )} />}
              </Line>
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export default ReservoirChartModule;
