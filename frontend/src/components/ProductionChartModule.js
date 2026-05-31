import React, { useState, useCallback } from "react";
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import "./ScatterPlotModule.css";

/*
 * ProductionChartModule
 * ---------------------
 * A Spotfire-style combined production chart with editable axis limits.
 *   - Left axis  ("rate"): Oil Rate (green) + Liquid Rate (blue) as lines.
 *   - Right axis ("cum") : Cumulative Oil + Cumulative Liquid as filled areas.
 *   - Right axis ("gor") : GOR (yellow) as a line.
 *
 * An "Edit" tab opens a property inspector that lets the user customize the
 * min / max limits and title of each axis. Settings persist to localStorage
 * under `storageKey`.
 *
 * Props:
 *   title     string — header label (usually the well id)
 *   data      array  — [{ Date, OilRate, LiqRate, GOR, cumOil, cumLiq }]
 *   storageKey string — localStorage key for persisting axis settings
 *   height    number — chart height in px (default 420)
 */

// Required colors: oil rate green, liquid rate blue, GOR yellow.
const SERIES = {
  OilRate: { color: "#2e7d32", label: "Oil Rate (t/d)", axis: "rate", type: "line" },
  LiqRate: { color: "#1976d2", label: "Liquid Rate (t/d)", axis: "rate", type: "line" },
  WC: { color: "#e65100", label: "WC (%)", axis: "wc", type: "line" },
  GOR: { color: "#f5c518", label: "GOR (m³/t)", axis: "gor", type: "line" },
};

const AXES = [
  { id: "rate", label: "Rate (left)", defaultTitle: "Oil / Liquid Rate (t/d)" },
  { id: "wc", label: "WC (right)", defaultTitle: "WC (%)" },
  { id: "gor", label: "GOR (right)", defaultTitle: "GOR (m³/t)" },
];

const defaultAxis = (title) => ({ min: "", max: "", title });

function ProductionChartModule({ title = "Production", data = [], storageKey, height = 420 }) {
  const [settings, setSettings] = useState(() => {
    const base = {
      rate: defaultAxis("Oil / Liquid Rate (t/d)"),
      wc: defaultAxis("WC (%)"),
      gor: defaultAxis("GOR (m³/t)"),
    };
    if (!storageKey) return base;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved) {
        return {
          rate: { ...base.rate, ...saved.rate },
          wc: { ...base.wc, ...saved.wc },
          gor: { ...base.gor, ...saved.gor },
        };
      }
    } catch { /* ignore corrupt storage */ }
    return base;
  });

  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorAxis, setInspectorAxis] = useState("rate");
  // Tracks which Default/Custom fields the user has explicitly switched to
  // "Custom", so clearing the input mid-edit doesn't snap back to Default.
  const [customMode, setCustomMode] = useState({});

  const update = useCallback((updater) => {
    setSettings((prev) => {
      const next = typeof updater === "function" ? updater(prev) : { ...prev, ...updater };
      if (storageKey) localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }, [storageKey]);

  const setAxis = (axis, key, value) =>
    update((prev) => ({ ...prev, [axis]: { ...prev[axis], [key]: value } }));

  const domainFor = (axis) => {
    const s = settings[axis];
    const lo = s.min !== "" && s.min != null ? Number(s.min) : "auto";
    const hi = s.max !== "" && s.max != null ? Number(s.max) : "auto";
    return [lo, hi];
  };
  const overflowFor = (axis) => {
    const s = settings[axis];
    return (s.min !== "" && s.min != null) || (s.max !== "" && s.max != null);
  };

  // Default/Custom number field: empty string means "default" (auto).
  const customField = (axis, key, placeholder) => {
    const value = settings[axis][key];
    const modeKey = `${axis}.${key}`;
    const isCustom = !!customMode[modeKey] || (value !== "" && value != null);
    const setMode = (on) => setCustomMode((m) => ({ ...m, [modeKey]: on }));
    return (
      <div className="spm-seg" style={{ width: "100%" }}>
        <span className="spm-seg-opt" onClick={() => { setMode(false); setAxis(axis, key, ""); }}>
          <span className={`spm-radio ${!isCustom ? "on" : ""}`} />Default
        </span>
        <span className="spm-seg-opt" onClick={() => setMode(true)}>
          <span className={`spm-radio ${isCustom ? "on" : ""}`} />Custom
        </span>
        <input
          type="number"
          className="spm-insp-input"
          style={{ maxWidth: 90 }}
          value={value}
          placeholder={placeholder}
          disabled={!isCustom}
          onChange={(e) => { setMode(true); setAxis(axis, key, e.target.value); }}
        />
      </div>
    );
  };

  const renderInspector = () => {
    const axis = inspectorAxis;
    return (
      <div className="spm-inspector">
        <div className="spm-insp-header">
          <span>Property Inspector</span>
          <button className="spm-insp-close" onClick={() => setInspectorOpen(false)}>×</button>
        </div>
        <div className="spm-insp-axis-picker">
          {AXES.map((a) => (
            <button
              key={a.id}
              className={axis === a.id ? "active" : ""}
              onClick={() => setInspectorAxis(a.id)}
            >
              {a.label}
            </button>
          ))}
        </div>
        <div className="spm-insp-body">
          <div className="spm-insp-section-title">Axis Limits</div>
          <div className="spm-insp-row">
            <label>Minimum</label>
            {customField(axis, "min", "auto")}
          </div>
          <div className="spm-insp-row">
            <label>Maximum</label>
            {customField(axis, "max", "auto")}
          </div>

          <div className="spm-insp-section-title">Axis Title</div>
          <div className="spm-insp-row" style={{ gridTemplateColumns: "1fr" }}>
            <input
              type="text"
              className="spm-insp-text"
              value={settings[axis].title}
              placeholder="Axis title"
              onChange={(e) => setAxis(axis, "title", e.target.value)}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="spm">
      <div className="spm-header">
        <span className="spm-header-title">
          <span className="spm-header-icon">⠿</span> {title}
        </span>
      </div>

      <div
        className={`spm-edit-tab ${inspectorOpen ? "active" : ""}`}
        onClick={() => setInspectorOpen((o) => !o)}
      >
        Edit
      </div>

      <div className="spm-plot">
        {data.length === 0 ? (
          <div className="spm-empty" style={{ height }}>No data</div>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            <ComposedChart data={data} margin={{ top: 16, right: 78, bottom: 24, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="Date" tick={{ fontSize: 11 }} minTickGap={24} />

              <YAxis
                yAxisId="rate"
                orientation="left"
                domain={domainFor("rate")}
                allowDataOverflow={overflowFor("rate")}
                tick={{ fontSize: 11 }}
                label={{ value: settings.rate.title, angle: -90, position: "insideLeft", style: { fontSize: 11, textAnchor: "middle" } }}
              />
              <YAxis
                yAxisId="wc"
                orientation="right"
                scale="log"
                domain={[0.1, 100]}
                allowDataOverflow
                ticks={[0.1, 1, 10, 100]}
                tick={{ fontSize: 11, fill: SERIES.WC.color }}
                axisLine={{ stroke: SERIES.WC.color }}
                tickLine={{ stroke: SERIES.WC.color }}
                label={{ value: settings.wc.title, angle: 90, position: "insideRight", style: { fontSize: 11, textAnchor: "middle", fill: SERIES.WC.color } }}
              />
              <YAxis
                yAxisId="gor"
                orientation="right"
                domain={domainFor("gor")}
                allowDataOverflow={overflowFor("gor")}
                tick={{ fontSize: 11, fill: SERIES.GOR.color }}
                axisLine={{ stroke: SERIES.GOR.color }}
                tickLine={{ stroke: SERIES.GOR.color }}
                width={58}
                label={{ value: settings.gor.title, angle: 90, position: "insideRight", style: { fontSize: 11, textAnchor: "middle", fill: SERIES.GOR.color } }}
              />

              <Tooltip
                formatter={(value, name) => [
                  typeof value === "number" ? value.toFixed(2) : value,
                  SERIES[name]?.label || name,
                ]}
              />
              <Legend formatter={(name) => SERIES[name]?.label || name} />

              <Line yAxisId="rate" type="monotone" dataKey="OilRate" name="OilRate"
                stroke={SERIES.OilRate.color} strokeWidth={2} dot={false} />
              <Line yAxisId="rate" type="monotone" dataKey="LiqRate" name="LiqRate"
                stroke={SERIES.LiqRate.color} strokeWidth={2} dot={false} />
              <Line yAxisId="wc" type="monotone" dataKey="WC" name="WC"
                stroke={SERIES.WC.color} strokeWidth={2} dot={false} connectNulls />
              <Line yAxisId="gor" type="monotone" dataKey="GOR" name="GOR"
                stroke={SERIES.GOR.color} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {inspectorOpen && renderInspector()}
    </div>
  );
}

export default ProductionChartModule;
