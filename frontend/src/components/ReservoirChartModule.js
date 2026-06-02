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
import useResizable, { ResizeHandles } from "./useResizable";

const FONT = "Arial, sans-serif";

const COLORS = {
  OilRate: "#2e7d32",
  LiqRate: "#00897b",
  GOR: "#d32f2f",
  WC: "#1976d2",
  VRR: "#7b1fa2",
};

const DEFAULT_LIMITS = {
  qoil: { min: "", max: "" },
  gor: { min: "", max: "" },
  wc: { min: "0.01", max: "100" },
  vrr: { min: "", max: "" },
};

const DEFAULT_SCALES = {
  qoil: "linear",
  gor: "linear",
  wc: "log",
  vrr: "linear",
};

// Maps each axis key to the data series it plots, so log ticks can be
// derived from the actual data range when explicit limits aren't set.
const AXIS_DATA_KEY = {
  qoil: "OilRate",
  gor: "GOR",
  wc: "WC",
  vrr: "VRR",
};

// Powers-of-10 ticks (…, 0.1, 1, 10, 100, …) spanning the given range.
function logDecadeTicks(lo, hi) {
  if (!(lo > 0) || !(hi > 0) || hi < lo) return undefined;
  const start = Math.floor(Math.log10(lo));
  const end = Math.ceil(Math.log10(hi));
  const ticks = [];
  for (let e = start; e <= end; e++) ticks.push(Math.pow(10, e));
  return ticks;
}

function ReservoirChartModule({
  fields, resField, resReservoir, onFieldChange, onReservoirChange, data, loading,
  title = "Reservoir Production & VRR",
  scopeMode = false, scopeLabel = "",
}) {
  const { size, style, containerRef, onResize } = useResizable(380);
  const [filteredReservoirs, setFilteredReservoirs] = useState([]);
  const [legendLabels, setLegendLabels] = useState({
    OilRate: "Lưu lượng dầu",
    LiqRate: "Lưu lượng chất lỏng",
    GOR: "Tỉ số khí dầu",
    WC: "Độ ngập nước",
    VRR: "Hệ số bù khai thác",
  });
  const [showDataLabels, setShowDataLabels] = useState(false);
  const [showLegend, setShowLegend] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [axisTitleSize, setAxisTitleSize] = useState(11);
  const [axisLabelSize, setAxisLabelSize] = useState(11);
  const [axisLimits, setAxisLimits] = useState(DEFAULT_LIMITS);
  const [axisScales, setAxisScales] = useState(DEFAULT_SCALES);
  const [reverseX, setReverseX] = useState(false);
  const [axisReverse, setAxisReverse] = useState({ qoil: false, wc: false, gor: false, vrr: false });
  const handleAxisReverse = useCallback((axisKey, val) => {
    setAxisReverse((prev) => ({ ...prev, [axisKey]: val }));
  }, []);
  const [valueOverrides, setValueOverrides] = useState({});
  const handleValueOverride = useCallback((seriesKey) => (index, val) => {
    setValueOverrides((prev) => ({ ...prev, [seriesKey]: { ...(prev[seriesKey] || {}), [index]: val } }));
  }, []);
  const chartRef = useRef(null);

  const getDomain = useCallback((axisKey) => {
    const l = axisLimits[axisKey];
    if (!l) return undefined;
    const lo = l.min !== "" ? Number(l.min) : "auto";
    const hi = l.max !== "" ? Number(l.max) : "auto";
    return [lo, hi];
  }, [axisLimits]);

  // Decade ticks for a log axis; uses explicit limits when set, else the
  // positive data range. Returns undefined for linear axes (auto ticks).
  const getTicks = useCallback((axisKey) => {
    if (axisScales[axisKey] !== "log") return undefined;
    const l = axisLimits[axisKey] || {};
    const dataKey = AXIS_DATA_KEY[axisKey];
    const vals = data
      .map((d) => Number(d[dataKey]))
      .filter((v) => Number.isFinite(v) && v > 0);
    const lo = l.min !== "" ? Number(l.min) : Math.min(...vals);
    const hi = l.max !== "" ? Number(l.max) : Math.max(...vals);
    return logDecadeTicks(lo, hi);
  }, [axisScales, axisLimits, data]);

  const handleAxisLimit = useCallback((axisKey, bound, val) => {
    setAxisLimits((prev) => ({ ...prev, [axisKey]: { ...prev[axisKey], [bound]: val } }));
  }, []);

  const handleAxisScale = useCallback((axisKey, val) => {
    setAxisScales((prev) => ({ ...prev, [axisKey]: val }));
  }, []);

  const handleLegendChange = useCallback((key, val) => {
    setLegendLabels((prev) => ({ ...prev, [key]: val }));
  }, []);

  const handleDownload = useCallback(() => {
    downloadChartAsPng(chartRef.current, "Reservoir_Production_VRR.png");
  }, []);

  useEffect(() => {
    if (!resField) { setFilteredReservoirs([]); return; }
    getCascadingFilters({ field: resField }).then((res) => {
      setFilteredReservoirs(res.data.reservoirs || []);
    }).catch(() => {});
  }, [resField]);

  return (
    <div className="spm" ref={containerRef} style={{ ...style, marginBottom: 24 }}>
      <div className="spm-header">
        <span className="spm-header-title">
          {title}
        </span>
        {data.length > 0 && (scopeMode || (resField && resReservoir)) && <DownloadPngButton onClick={handleDownload} />}
      </div>
      <div
        className={`spm-edit-tab ${inspectorOpen ? "active" : ""}`}
        onClick={() => setInspectorOpen((o) => !o)}
      >
        Edit
      </div>
      {scopeMode ? (
        scopeLabel && (
          <div style={{ display: "flex", gap: 8, padding: "8px 16px", alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: "#555" }}>Scope:</span>
            <span style={{ fontSize: 13 }}>{scopeLabel}</span>
          </div>
        )
      ) : (
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
      )}
      <div className="spm-plot spm-plot-fill" ref={chartRef}>
        {loading ? (
          <div className="spm-empty" style={{ height: size.height }}>Loading...</div>
        ) : !scopeMode && (!resField || !resReservoir) ? (
          <div className="spm-empty" style={{ height: size.height }}>Select a Field and Reservoir to view chart</div>
        ) : data.length === 0 ? (
          <div className="spm-empty" style={{ height: size.height }}>No data</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 16, right: 16, bottom: 24, left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="Date" reversed={reverseX} tick={{ fontSize: axisLabelSize, fontFamily: FONT, fill: "#000" }} minTickGap={24} />

              <YAxis
                yAxisId="qoil"
                orientation="left"
                reversed={axisReverse.qoil}
                scale={axisScales.qoil}
                domain={getDomain("qoil")}
                ticks={getTicks("qoil")}
                allowDataOverflow
                tick={{ fontSize: axisLabelSize, fontFamily: FONT, fill: COLORS.OilRate }}
                axisLine={{ stroke: COLORS.OilRate }}
                tickLine={{ stroke: COLORS.OilRate }}
                label={{ value: "OilRate (t)", angle: -90, position: "insideLeft", style: { fontSize: axisTitleSize, fontFamily: FONT, fill: COLORS.OilRate, textAnchor: "middle" } }}
              />
              <YAxis
                yAxisId="wc"
                orientation="left"
                reversed={axisReverse.wc}
                scale={axisScales.wc}
                domain={getDomain("wc")}
                ticks={getTicks("wc")}
                allowDataOverflow
                tick={{ fontSize: axisLabelSize, fontFamily: FONT, fill: COLORS.WC }}
                axisLine={{ stroke: COLORS.WC }}
                tickLine={{ stroke: COLORS.WC }}
                width={50}
                label={{ value: "WC", angle: -90, position: "insideLeft", style: { fontSize: axisTitleSize, fontFamily: FONT, textAnchor: "middle", fill: COLORS.WC } }}
              />
              <YAxis
                yAxisId="gor"
                orientation="right"
                reversed={axisReverse.gor}
                scale={axisScales.gor}
                domain={getDomain("gor")}
                ticks={getTicks("gor")}
                allowDataOverflow
                width={60}
                tick={{ fontSize: axisLabelSize, fontFamily: FONT, fill: COLORS.GOR }}
                axisLine={{ stroke: COLORS.GOR }}
                tickLine={{ stroke: COLORS.GOR }}
                label={{ value: "GOR (m³/t)", angle: 90, position: "insideRight", style: { fontSize: axisTitleSize, fontFamily: FONT, textAnchor: "middle", fill: COLORS.GOR } }}
              />
              <YAxis
                yAxisId="vrr"
                orientation="right"
                reversed={axisReverse.vrr}
                scale={axisScales.vrr}
                domain={getDomain("vrr")}
                ticks={getTicks("vrr")}
                allowDataOverflow
                tick={{ fontSize: axisLabelSize, fontFamily: FONT, fill: COLORS.VRR }}
                axisLine={{ stroke: COLORS.VRR }}
                tickLine={{ stroke: COLORS.VRR }}
                width={50}
                label={{ value: "VRR", angle: 90, position: "insideRight", style: { fontSize: axisTitleSize, fontFamily: FONT, textAnchor: "middle", fill: COLORS.VRR } }}
              />

              <Tooltip formatter={(value, name) => [typeof value === "number" ? value.toFixed(2) : value, name]} />
              {showLegend && <Legend content={({ payload }) => {
                const order = ["OilRate", "LiqRate", "GOR", "WC", "VRR"];
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
              }} />}

              <Line yAxisId="qoil" type="monotone" dataKey="OilRate" name={legendLabels.OilRate} stroke={COLORS.OilRate} strokeWidth={2} dot={{ r: 2, fill: COLORS.OilRate }}>
                {showDataLabels && <LabelList dataKey="OilRate" position="top" content={(props) => (
                  <EditableValueLabel {...props} fontSize={9} fontWeight={500} formatter={(v) => typeof v === "number" ? v.toFixed(1) : v} overrides={valueOverrides.OilRate} onOverride={handleValueOverride("OilRate")} />
                )} />}
              </Line>
              <Line yAxisId="qoil" type="monotone" dataKey="LiqRate" name={legendLabels.LiqRate} stroke={COLORS.LiqRate} strokeWidth={2} strokeDasharray="5 3" dot={{ r: 2, fill: COLORS.LiqRate }} connectNulls>
                {showDataLabels && <LabelList dataKey="LiqRate" position="top" content={(props) => (
                  <EditableValueLabel {...props} fontSize={9} fontWeight={500} formatter={(v) => typeof v === "number" ? v.toFixed(1) : v} overrides={valueOverrides.LiqRate} onOverride={handleValueOverride("LiqRate")} />
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

      {inspectorOpen && (
        <div className="spm-inspector">
          <div className="spm-insp-header">
            <span>Property Inspector</span>
            <button className="spm-insp-close" onClick={() => setInspectorOpen(false)}>×</button>
          </div>
          <div className="spm-insp-body">
            <div className="spm-insp-section-title">Axis Title</div>
            <div className="spm-insp-row">
              <label>Title size</label>
              <input
                type="number"
                className="spm-insp-input"
                min={6}
                max={40}
                value={axisTitleSize}
                onChange={(e) => setAxisTitleSize(Number(e.target.value) || 11)}
              />
            </div>
            <div className="spm-insp-row">
              <label>Label size</label>
              <input
                type="number"
                className="spm-insp-input"
                min={6}
                max={40}
                value={axisLabelSize}
                onChange={(e) => setAxisLabelSize(Number(e.target.value) || 11)}
              />
            </div>

            <div className="spm-insp-section-title">Axis Limits</div>
            {[
              { key: "qoil", label: "OilRate", color: COLORS.OilRate },
              { key: "wc", label: "WC", color: COLORS.WC },
              { key: "gor", label: "GOR", color: COLORS.GOR },
              { key: "vrr", label: "VRR", color: COLORS.VRR },
            ].map(({ key, label, color }) => (
              <div key={key} className="spm-insp-row" style={{ flexWrap: "wrap" }}>
                <label style={{ color, fontWeight: 600, minWidth: 60 }}>{label}</label>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <input
                    type="number"
                    className="spm-insp-input"
                    style={{ width: 60 }}
                    placeholder="Min"
                    value={axisLimits[key]?.min ?? ""}
                    onChange={(e) => handleAxisLimit(key, "min", e.target.value)}
                  />
                  <span style={{ fontSize: 11 }}>–</span>
                  <input
                    type="number"
                    className="spm-insp-input"
                    style={{ width: 60 }}
                    placeholder="Max"
                    value={axisLimits[key]?.max ?? ""}
                    onChange={(e) => handleAxisLimit(key, "max", e.target.value)}
                  />
                  <select
                    className="spm-insp-input"
                    style={{ width: 70 }}
                    value={axisScales[key] ?? "linear"}
                    onChange={(e) => handleAxisScale(key, e.target.value)}
                  >
                    <option value="linear">Linear</option>
                    <option value="log">Log</option>
                  </select>
                </div>
              </div>
            ))}

            <div className="spm-insp-section-title">Reverse Order</div>
            <div className="spm-insp-row">
              <label>X axis (Date)</label>
              <div className="spm-seg">
                <span className="spm-seg-opt" onClick={() => setReverseX(true)}>
                  <span className={`spm-radio ${reverseX ? "on" : ""}`} />Yes
                </span>
                <span className="spm-seg-opt" onClick={() => setReverseX(false)}>
                  <span className={`spm-radio ${!reverseX ? "on" : ""}`} />No
                </span>
              </div>
            </div>
            {[
              { key: "qoil", label: "OilRate", color: COLORS.OilRate },
              { key: "wc", label: "WC", color: COLORS.WC },
              { key: "gor", label: "GOR", color: COLORS.GOR },
              { key: "vrr", label: "VRR", color: COLORS.VRR },
            ].map(({ key, label, color }) => (
              <div className="spm-insp-row" key={key}>
                <label style={{ color, fontWeight: 600 }}>{label}</label>
                <div className="spm-seg">
                  <span className="spm-seg-opt" onClick={() => handleAxisReverse(key, true)}>
                    <span className={`spm-radio ${axisReverse[key] ? "on" : ""}`} />Yes
                  </span>
                  <span className="spm-seg-opt" onClick={() => handleAxisReverse(key, false)}>
                    <span className={`spm-radio ${!axisReverse[key] ? "on" : ""}`} />No
                  </span>
                </div>
              </div>
            ))}

            <div className="spm-insp-section-title">Data Labels</div>
            <div className="spm-insp-row">
              <label>Show labels</label>
              <div className="spm-seg">
                <span className="spm-seg-opt" onClick={() => setShowDataLabels(true)}>
                  <span className={`spm-radio ${showDataLabels ? "on" : ""}`} />Show
                </span>
                <span className="spm-seg-opt" onClick={() => setShowDataLabels(false)}>
                  <span className={`spm-radio ${!showDataLabels ? "on" : ""}`} />Hide
                </span>
              </div>
            </div>

            <div className="spm-insp-section-title">Legend</div>
            <div className="spm-insp-row">
              <label>Show legend</label>
              <div className="spm-seg">
                <span className="spm-seg-opt" onClick={() => setShowLegend(true)}>
                  <span className={`spm-radio ${showLegend ? "on" : ""}`} />Show
                </span>
                <span className="spm-seg-opt" onClick={() => setShowLegend(false)}>
                  <span className={`spm-radio ${!showLegend ? "on" : ""}`} />Hide
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
      <ResizeHandles onResize={onResize} />
    </div>
  );
}

export default ReservoirChartModule;
