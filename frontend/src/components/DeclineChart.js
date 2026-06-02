import React, { useState, useCallback, useRef } from "react";
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, LabelList,
} from "recharts";
import "./ScatterPlotModule.css";
import { downloadChartAsPng, DownloadPngButton } from "./chartDownload";
import EditableLabel from "./EditableLabel";
import EditableValueLabel from "./EditableValueLabel";
import useResizable, { ResizeHandles } from "./useResizable";

/*
 * DeclineChart
 * ------------
 * A single editable + resizable line chart comparing two decline (%) series —
 * Council Plan vs Actual — on one left axis. Used twice (oil, liquid) inside
 * DeclineComparisonModule.
 *
 * Props:
 *   title         string  — header label
 *   data          array   — rows containing `Date` and the two series keys
 *   councilKey    string  — data key for the Council Plan series
 *   actualKey     string  — data key for the Actual series
 *   defaultTitle  string  — default Y-axis title (e.g. "Oil rate decline (%)")
 *   storageKey    string  — localStorage key for persisting axis settings
 *   onHorizontalResize    — parent split handler for side-by-side resizing
 *   excludeDirections     — resize handles to hide
 *   headerRight           — optional node rendered on the right of the header
 */

const FONT = "Arial, sans-serif";

const SERIES = {
  council: { color: "#1976d2", label: "Nhịp độ suy giảm theo hội đồng (%)" },
  actual: { color: "#2e7d32", label: "Nhịp độ suy giảm lưu lượng thực tế (%)" },
};

// Decline is a depletion percentage, so the axis defaults to 0–100%.
// (Editable — the user can widen it from the inspector to inspect overflow.)
const defaultAxis = (title) => ({ min: "0", max: "100", title });

function DeclineChart({
  title = "Decline",
  data = [],
  councilKey,
  actualKey,
  defaultTitle = "Decline (%)",
  storageKey,
  height = 360,
  onHorizontalResize,
  excludeDirections = [],
  headerRight = null,
}) {
  const { size, style, containerRef, onResize } = useResizable(height, 200, 150, { onHorizontalResize });
  const [seriesLabels, setSeriesLabels] = useState({
    [councilKey]: SERIES.council.label,
    [actualKey]: SERIES.actual.label,
  });
  const [showDataLabels, setShowDataLabels] = useState(false);
  const [showLegend, setShowLegend] = useState(true);
  const [valueOverrides, setValueOverrides] = useState({});
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [axisTitleSize, setAxisTitleSize] = useState(11);
  const [axisLabelSize, setAxisLabelSize] = useState(11);
  const [reverseX, setReverseX] = useState(false);
  const [reverseY, setReverseY] = useState(true);
  const chartRef = useRef(null);

  const [settings, setSettings] = useState(() => {
    const base = { decline: defaultAxis(defaultTitle) };
    if (!storageKey) return base;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved) return { decline: { ...base.decline, ...saved.decline } };
    } catch { /* ignore corrupt storage */ }
    return base;
  });

  const handleValueOverride = useCallback((seriesKey) => (index, val) => {
    setValueOverrides((prev) => ({ ...prev, [seriesKey]: { ...(prev[seriesKey] || {}), [index]: val } }));
  }, []);

  const handleLabelChange = useCallback((key, val) => {
    setSeriesLabels((prev) => ({ ...prev, [key]: val }));
  }, []);

  const update = useCallback((updater) => {
    setSettings((prev) => {
      const next = typeof updater === "function" ? updater(prev) : { ...prev, ...updater };
      if (storageKey) localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }, [storageKey]);

  const setAxis = (key, value) =>
    update((prev) => ({ ...prev, decline: { ...prev.decline, [key]: value } }));

  const s = settings.decline;
  const domain = [
    s.min !== "" && s.min != null ? Number(s.min) : "auto",
    s.max !== "" && s.max != null ? Number(s.max) : "auto",
  ];
  const allowOverflow = (s.min !== "" && s.min != null) || (s.max !== "" && s.max != null);

  const handleDownload = useCallback(() => {
    const safeName = (title || "chart").replace(/[^a-zA-Z0-9]/g, "_") + ".png";
    downloadChartAsPng(chartRef.current, safeName);
  }, [title]);

  const fmt = (v) => (typeof v === "number" ? v.toFixed(1) : v);

  return (
    <div className="spm" ref={containerRef} style={style}>
      <div className="spm-header">
        <span className="spm-header-title">{title}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {headerRight}
          {data.length > 0 && <DownloadPngButton onClick={handleDownload} />}
        </div>
      </div>

      <div
        className={`spm-edit-tab ${inspectorOpen ? "active" : ""}`}
        onClick={() => setInspectorOpen((o) => !o)}
      >
        Edit
      </div>

      <div className="spm-plot spm-plot-fill" ref={chartRef}>
        {data.length === 0 ? (
          <div className="spm-empty" style={{ height: size.height }}>No data</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 16, right: 24, bottom: 24, left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="Date" reversed={reverseX} tick={{ fontSize: axisLabelSize, fontFamily: FONT, fill: "#000" }} minTickGap={16} />
              <YAxis
                yAxisId="decline"
                orientation="left"
                reversed={reverseY}
                domain={domain}
                allowDataOverflow={allowOverflow}
                tick={{ fontSize: axisLabelSize, fontFamily: FONT, fill: "#000" }}
                label={{ value: s.title, angle: -90, position: "insideLeft", style: { fontSize: axisTitleSize, fontFamily: FONT, fill: "#000", textAnchor: "middle" } }}
              />

              <Tooltip formatter={(value, name) => [typeof value === "number" ? `${value.toFixed(1)}%` : value, seriesLabels[name] || name]} />
              {showLegend && <Legend content={({ payload }) => (
                <div style={{ display: "flex", justifyContent: "center", gap: 16, fontSize: 11, marginTop: 4 }}>
                  {payload.map((entry, i) => (
                    <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 14, height: 3, backgroundColor: entry.color, display: "inline-block", borderRadius: 1 }} />
                      <EditableLabel
                        value={seriesLabels[entry.value] || entry.value}
                        onChange={(v) => handleLabelChange(entry.value, v)}
                      />
                    </span>
                  ))}
                </div>
              )} />}

              <Line yAxisId="decline" type="monotone" dataKey={councilKey} name={councilKey}
                stroke={SERIES.council.color} strokeWidth={2} dot={{ r: 2, fill: SERIES.council.color }} connectNulls>
                {showDataLabels && <LabelList dataKey={councilKey} position="top" content={(props) => (
                  <EditableValueLabel {...props} fontSize={9} fontWeight={500} formatter={fmt} overrides={valueOverrides[councilKey]} onOverride={handleValueOverride(councilKey)} />
                )} />}
              </Line>
              <Line yAxisId="decline" type="monotone" dataKey={actualKey} name={actualKey}
                stroke={SERIES.actual.color} strokeWidth={2} dot={{ r: 2, fill: SERIES.actual.color }} connectNulls>
                {showDataLabels && <LabelList dataKey={actualKey} position="top" content={(props) => (
                  <EditableValueLabel {...props} fontSize={9} fontWeight={500} formatter={fmt} overrides={valueOverrides[actualKey]} onOverride={handleValueOverride(actualKey)} />
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
            <div className="spm-insp-section-title">Axis Limits</div>
            <div className="spm-insp-row">
              <label>Minimum</label>
              <input
                type="number"
                className="spm-insp-input"
                style={{ maxWidth: 90 }}
                value={s.min}
                placeholder="auto"
                onChange={(e) => setAxis("min", e.target.value)}
              />
            </div>
            <div className="spm-insp-row">
              <label>Maximum</label>
              <input
                type="number"
                className="spm-insp-input"
                style={{ maxWidth: 90 }}
                value={s.max}
                placeholder="auto"
                onChange={(e) => setAxis("max", e.target.value)}
              />
            </div>

            <div className="spm-insp-section-title">Axis Title</div>
            <div className="spm-insp-row" style={{ gridTemplateColumns: "1fr" }}>
              <input
                type="text"
                className="spm-insp-text"
                value={s.title}
                placeholder="Axis title"
                onChange={(e) => setAxis("title", e.target.value)}
              />
            </div>
            <div className="spm-insp-row">
              <label>Title size</label>
              <input type="number" className="spm-insp-input" min={6} max={40}
                value={axisTitleSize} onChange={(e) => setAxisTitleSize(Number(e.target.value) || 11)} />
            </div>
            <div className="spm-insp-row">
              <label>Label size</label>
              <input type="number" className="spm-insp-input" min={6} max={40}
                value={axisLabelSize} onChange={(e) => setAxisLabelSize(Number(e.target.value) || 11)} />
            </div>

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
            <div className="spm-insp-row">
              <label>Y axis (Decline)</label>
              <div className="spm-seg">
                <span className="spm-seg-opt" onClick={() => setReverseY(true)}>
                  <span className={`spm-radio ${reverseY ? "on" : ""}`} />Yes
                </span>
                <span className="spm-seg-opt" onClick={() => setReverseY(false)}>
                  <span className={`spm-radio ${!reverseY ? "on" : ""}`} />No
                </span>
              </div>
            </div>

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
      <ResizeHandles onResize={onResize} excludeDirections={excludeDirections} />
    </div>
  );
}

export default DeclineChart;
