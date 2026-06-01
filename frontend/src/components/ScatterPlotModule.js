import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid,
  Tooltip, ReferenceLine, Cell, LabelList, ResponsiveContainer,
} from "recharts";
import "./ScatterPlotModule.css";
import { downloadChartAsPng, DownloadPngButton } from "./chartDownload";
import EditableLabel from "./EditableLabel";
import EditableValueLabel from "./EditableValueLabel";
import useResizable, { ResizeHandles } from "./useResizable";

/*
 * ScatterPlotModule
 * -----------------
 * A reusable, Spotfire-style scatter plot with:
 *   - a dark title bar and an "Edit" tab that opens a property inspector,
 *   - a per-axis property inspector (scale type, min/max, increment,
 *     reverse, number format, grid, axis title),
 *   - an optional time-playback toolbar (first / prev / play / next / last,
 *     a date dropdown and a slider) that drives `onDateChange`,
 *   - point labels and category coloring with a legend.
 *
 * The plot is presentation-only: the parent owns the data and, for animation,
 * supplies the list of `dates` plus `currentDate` / `onDateChange`.
 *
 * Props:
 *   title         string   — header label
 *   data          array    — [{ x, y, label, category, name }]
 *   xTitle        string   — default X axis title
 *   yTitle        string   — default Y axis title
 *   referenceLines array   — [{ axis: 'x'|'y', value, color? }]
 *   colorForPoint (point)  — optional fill resolver; falls back to palette/category
 *   legend        array    — optional [{ key, label, color }] overriding the auto legend
 *   dates         array    — sorted date strings for the time slider (optional)
 *   currentDate   string   — currently selected date
 *   onDateChange  (date)   — called when the slider/playback changes the date
 *   loading       bool     — show a loading overlay (e.g. while refetching a frame)
 *   storageKey    string   — localStorage key for persisting axis settings
 *   height        number   — chart height in px (default 460)
 *   playInterval  number   — ms per animation frame (default 1500)
 *   colorByOptions   array — [{ value, label }] for the "color by" dropdown
 *   colorBy          string — active color-by field
 *   onColorByChange  fn    — (value) called when the user picks a new color-by field
 *   quadrantColors   obj   — { pos, mixed, neg } hex colors (when colorBy==='quadrant')
 *   onQuadrantColorChange fn — (key, hex)
 *   categoryColorEntries array — [{ value, color }] for per-category swatches
 *   onCategoryColorChange fn — (value, hex)
 */

const FONT = "Arial, sans-serif";

const PALETTE = [
  "#c0392b", "#1976d2", "#4caf50", "#ff9800", "#9c27b0", "#00bcd4",
  "#795548", "#607d8b", "#e91e63", "#cddc39", "#3f51b5", "#009688",
];

const defaultAxis = (title) => ({
  scaleType: "linear", // 'linear' | 'log'
  min: "",             // '' = auto
  max: "",             // '' = auto
  increment: "",       // '' = auto tick spacing
  reverse: false,
  grid: true,
  decimals: "",        // '' = default number format (2 dp)
  title,
});

const SPEEDS = [
  { label: "0.5x", value: 3000 },
  { label: "1x", value: 1500 },
  { label: "2x", value: 750 },
  { label: "4x", value: 375 },
];

function ScatterPlotModule({
  title = "Scatter",
  data = [],
  xTitle = "X",
  yTitle = "Y",
  referenceLines = [{ axis: "x", value: 0 }, { axis: "y", value: 0 }],
  colorForPoint,
  legend,
  dates,
  currentDate,
  onDateChange,
  loading = false,
  storageKey,
  height = 460,
  playInterval = 1500,
  colorByOptions,
  colorBy,
  onColorByChange,
  quadrantColors,
  onQuadrantColorChange,
  categoryColorEntries,
  onCategoryColorChange,
}) {
  const { style, containerRef, onResize } = useResizable(height);
  const [settings, setSettings] = useState(() => {
    const base = { x: defaultAxis(xTitle), y: defaultAxis(yTitle), showLabels: true, titleSize: 12, labelSize: 11 };
    if (!storageKey) return base;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved) {
        return {
          ...base,
          ...saved,
          x: { ...base.x, ...saved.x },
          y: { ...base.y, ...saved.y },
        };
      }
    } catch { /* ignore corrupt storage */ }
    return base;
  });

  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState("axes");
  const [inspectorAxis, setInspectorAxis] = useState("y");
  // Tracks which Default/Custom fields the user has put into "Custom" mode.
  // Without this, clearing the input (e.g. via backspace) would make the value
  // empty and snap the control back to Default mid-edit.
  const [customMode, setCustomMode] = useState({});
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(playInterval);
  const [legendOverrides, setLegendOverrides] = useState({});
  const [showLegend, setShowLegend] = useState(true);
  const [valueOverrides, setValueOverrides] = useState({});
  const handleValueOverride = useCallback((index, val) => {
    setValueOverrides((prev) => ({ ...prev, [index]: val }));
  }, []);
  const chartRef = useRef(null);

  const handleDownload = useCallback(() => {
    const safeName = (title || "chart").replace(/[^a-zA-Z0-9]/g, "_") + ".png";
    downloadChartAsPng(chartRef.current, safeName);
  }, [title]);

  const update = useCallback((updater) => {
    setSettings((prev) => {
      const next = typeof updater === "function" ? updater(prev) : { ...prev, ...updater };
      if (storageKey) localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }, [storageKey]);

  const setAxis = (axis, key, value) =>
    update((prev) => ({ ...prev, [axis]: { ...prev[axis], [key]: value } }));

  // --- Time playback ---------------------------------------------------------
  const hasTimeline = Array.isArray(dates) && dates.length > 1 && !!onDateChange;
  const curIndex = hasTimeline
    ? Math.max(0, dates.indexOf(currentDate))
    : 0;
  const lastIndex = hasTimeline ? dates.length - 1 : 0;

  const goto = useCallback((idx) => {
    if (!hasTimeline) return;
    const clamped = Math.min(lastIndex, Math.max(0, idx));
    onDateChange(dates[clamped]);
  }, [hasTimeline, lastIndex, onDateChange, dates]);

  // Step forward on a timer while playing; stop when the last frame is reached.
  useEffect(() => {
    if (!playing || !hasTimeline) return;
    if (curIndex >= lastIndex) { setPlaying(false); return; }
    const t = setTimeout(() => goto(curIndex + 1), speed);
    return () => clearTimeout(t);
  }, [playing, hasTimeline, curIndex, lastIndex, speed, goto]);

  // --- Category colors -------------------------------------------------------
  const categories = useMemo(
    () => [...new Set(data.map((d) => d.category ?? "—"))],
    [data]
  );
  const categoryColor = useCallback(
    (cat) => PALETTE[Math.max(0, categories.indexOf(cat)) % PALETTE.length],
    [categories]
  );
  const fillFor = (point) =>
    (colorForPoint ? colorForPoint(point) : categoryColor(point.category ?? "—"));

  const legendItems = useMemo(() => {
    if (legend) return legend;
    if (categories.length <= 1) return [];
    return categories.map((c) => ({ key: c, label: c, color: categoryColor(c) }));
  }, [legend, categories, categoryColor]);

  // --- Axis props ------------------------------------------------------------
  const extentOf = (key) => {
    let lo = Infinity, hi = -Infinity;
    data.forEach((d) => {
      const v = d[key];
      if (v != null && isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    });
    if (!isFinite(lo)) return [0, 1];
    if (lo === hi) return [lo - 1, hi + 1];
    return [lo, hi];
  };

  const numFmt = (axis) => {
    const d = settings[axis].decimals;
    const dp = d === "" || d == null ? 2 : Number(d);
    return (v) => (typeof v === "number" ? v.toFixed(dp) : v);
  };

  const axisProps = (axis, dataKey) => {
    const s = settings[axis];
    const extent = extentOf(dataKey);
    const props = {
      type: "number",
      dataKey,
      reversed: !!s.reverse,
      tick: { fontSize: settings.labelSize, fontFamily: FONT, fill: "#000" },
      tickFormatter: numFmt(axis),
    };
    if (s.scaleType === "log") props.scale = "log";

    const lo = s.min !== "" && s.min != null ? Number(s.min) : "auto";
    const hi = s.max !== "" && s.max != null ? Number(s.max) : "auto";
    props.domain = [lo, hi];
    if (lo !== "auto" || hi !== "auto") props.allowDataOverflow = true;

    // Explicit tick spacing via "Increment"
    const inc = s.increment === "" || s.increment == null ? null : Number(s.increment);
    if (inc && inc > 0 && s.scaleType !== "log") {
      const emin = lo !== "auto" ? lo : extent[0];
      const emax = hi !== "auto" ? hi : extent[1];
      if (isFinite(emin) && isFinite(emax) && emax > emin) {
        const ticks = [];
        for (let v = emin; v <= emax + inc * 1e-6 && ticks.length < 1000; v += inc) {
          ticks.push(Number(v.toFixed(10)));
        }
        if (ticks.length > 1) props.ticks = ticks;
      }
    }
    return props;
  };

  // --- Property inspector UI -------------------------------------------------
  const seg = (axis, key, options) => (
    <div className="spm-seg">
      {options.map((opt) => {
        const on = settings[axis][key] === opt.value;
        return (
          <span
            key={String(opt.value)}
            className="spm-seg-opt"
            onClick={() => setAxis(axis, key, opt.value)}
          >
            <span className={`spm-radio ${on ? "on" : ""}`} />
            {opt.label}
          </span>
        );
      })}
    </div>
  );

  // Default/Custom number field: empty string means "default".
  const customField = (axis, key, placeholder) => {
    const value = settings[axis][key];
    const modeKey = `${axis}.${key}`;
    // "Custom" is on when the user explicitly selected it, or when a value is
    // already set. Deriving it from the value alone would reset the control to
    // Default the moment the input is cleared while editing.
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
          onChange={(e) => {
            setMode(true);
            setAxis(axis, key, e.target.value);
          }}
        />
      </div>
    );
  };

  const hasColorSettings = !!colorByOptions && !!onColorByChange;

  const renderAxesBody = () => {
    const axis = inspectorAxis;
    return (
      <>
        <div className="spm-insp-axis-picker">
          <button className={axis === "x" ? "active" : ""} onClick={() => setInspectorAxis("x")}>X Axis</button>
          <button className={axis === "y" ? "active" : ""} onClick={() => setInspectorAxis("y")}>Y Axis</button>
        </div>
        <div className="spm-insp-body">
          <div className="spm-insp-section-title">Scale</div>
          <div className="spm-insp-row">
            <label>Scale Type</label>
            {seg(axis, "scaleType", [
              { value: "linear", label: "Linear" },
              { value: "log", label: "Logarithmic" },
            ])}
          </div>
          <div className="spm-insp-row">
            <label>Minimum</label>
            {customField(axis, "min", "auto")}
          </div>
          <div className="spm-insp-row">
            <label>Maximum</label>
            {customField(axis, "max", "auto")}
          </div>
          <div className="spm-insp-row">
            <label>Increment</label>
            {customField(axis, "increment", "auto")}
          </div>
          <div className="spm-insp-row">
            <label>Reverse</label>
            {seg(axis, "reverse", [
              { value: true, label: "Yes" },
              { value: false, label: "No" },
            ])}
          </div>
          <div className="spm-insp-row">
            <label>Number Format</label>
            {customField(axis, "decimals", "2 dp")}
          </div>
          <div className="spm-insp-row">
            <label>Grid</label>
            {seg(axis, "grid", [
              { value: true, label: "Show" },
              { value: false, label: "Hide" },
            ])}
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
          <div className="spm-insp-row">
            <label>Title size</label>
            <input
              type="number"
              className="spm-insp-input"
              min={6}
              max={40}
              value={settings.titleSize}
              onChange={(e) => update({ titleSize: Number(e.target.value) || 12 })}
            />
          </div>
          <div className="spm-insp-row">
            <label>Label size</label>
            <input
              type="number"
              className="spm-insp-input"
              min={6}
              max={40}
              value={settings.labelSize}
              onChange={(e) => update({ labelSize: Number(e.target.value) || 11 })}
            />
          </div>

          <div className="spm-insp-section-title">Labels</div>
          <div className="spm-insp-row">
            <label>Point labels</label>
            <div className="spm-seg">
              <span className="spm-seg-opt" onClick={() => update({ showLabels: true })}>
                <span className={`spm-radio ${settings.showLabels ? "on" : ""}`} />Show
              </span>
              <span className="spm-seg-opt" onClick={() => update({ showLabels: false })}>
                <span className={`spm-radio ${!settings.showLabels ? "on" : ""}`} />Hide
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
      </>
    );
  };

  const renderColorsBody = () => {
    if (!hasColorSettings) return null;
    const isQuadrant = colorBy === "quadrant";
    return (
      <div className="spm-insp-body">
        <div className="spm-insp-section-title">Color By</div>
        <div className="spm-insp-row" style={{ gridTemplateColumns: "1fr" }}>
          <select
            className="spm-insp-input"
            value={colorBy}
            onChange={(e) => onColorByChange(e.target.value)}
          >
            {colorByOptions.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>

        {isQuadrant && quadrantColors && onQuadrantColorChange && (
          <>
            <div className="spm-insp-section-title">Quadrant Colors</div>
            {[["pos", "Both positive"], ["mixed", "Mixed"], ["neg", "Both negative"]].map(([k, lbl]) => (
              <div className="spm-insp-row" key={k}>
                <label>{lbl}</label>
                <input
                  type="color"
                  className="spm-insp-color"
                  value={quadrantColors[k]}
                  onChange={(e) => onQuadrantColorChange(k, e.target.value)}
                />
              </div>
            ))}
          </>
        )}

        {!isQuadrant && categoryColorEntries && onCategoryColorChange && (
          <>
            <div className="spm-insp-section-title">Category Colors</div>
            <div style={{ maxHeight: 200, overflowY: "auto" }}>
              {categoryColorEntries.map(({ value, color }) => (
                <div className="spm-insp-row" key={value}>
                  <label style={{ fontSize: 11 }}>{value}</label>
                  <input
                    type="color"
                    className="spm-insp-color"
                    value={color}
                    onChange={(e) => onCategoryColorChange(value, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  const renderInspector = () => (
    <div className="spm-inspector">
      <div className="spm-insp-header">
        <span>Property Inspector</span>
        <button className="spm-insp-close" onClick={() => setInspectorOpen(false)}>×</button>
      </div>
      {hasColorSettings && (
        <div className="spm-insp-axis-picker">
          <button className={inspectorTab === "axes" ? "active" : ""} onClick={() => setInspectorTab("axes")}>Axes</button>
          <button className={inspectorTab === "colors" ? "active" : ""} onClick={() => setInspectorTab("colors")}>Colors</button>
        </div>
      )}
      {inspectorTab === "axes" ? renderAxesBody() : renderColorsBody()}
    </div>
  );

  // --- Toolbar ---------------------------------------------------------------
  const renderToolbar = () => {
    if (!hasTimeline) return null;
    const Btn = ({ children, onClick, disabled, className = "" }) => (
      <button className={`spm-btn ${className}`} onClick={onClick} disabled={disabled}>{children}</button>
    );
    return (
      <div className="spm-toolbar">
        <div className="spm-btn-group">
          <Btn onClick={() => goto(0)} disabled={curIndex === 0}>⏮</Btn>
          <Btn onClick={() => goto(curIndex - 1)} disabled={curIndex === 0}>◀</Btn>
          <Btn onClick={() => setPlaying(false)} className="">⏹</Btn>
          <Btn
            onClick={() => { setPlaying(false); goto(curIndex + 1); }}
            className="play"
            disabled={curIndex >= lastIndex}
          >▶</Btn>
          <Btn
            onClick={() => setPlaying((p) => !p)}
            className={`${playing ? "active" : ""}`}
            disabled={curIndex >= lastIndex && !playing}
          >▶▶</Btn>
          <Btn onClick={() => goto(lastIndex)} disabled={curIndex >= lastIndex}>⏭</Btn>
        </div>
        <select
          className="spm-date-select"
          value={dates[curIndex]}
          onChange={(e) => goto(dates.indexOf(e.target.value))}
        >
          {dates.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <input
          type="range"
          className="spm-slider"
          min={0}
          max={lastIndex}
          value={curIndex}
          onChange={(e) => goto(Number(e.target.value))}
        />
        <div className="spm-speed">
          <span>Speed</span>
          <select
            className="spm-date-select"
            style={{ minWidth: 60 }}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
          >
            {SPEEDS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>
    );
  };

  const fmtTooltip = (value, name) => {
    const dp = (axis) => {
      const d = settings[axis].decimals;
      return d === "" || d == null ? 2 : Number(d);
    };
    const axis = name === settings.x.title ? "x" : "y";
    return [typeof value === "number" ? value.toFixed(dp(axis)) : value, name];
  };

  return (
    <div className="spm" ref={containerRef} style={style}>
      <div className="spm-header">
        <span className="spm-header-title">
          {title}
        </span>
        {data.length > 0 && <DownloadPngButton onClick={handleDownload} />}
      </div>

      <div
        className={`spm-edit-tab ${inspectorOpen ? "active" : ""}`}
        onClick={() => setInspectorOpen((o) => !o)}
      >
        Edit
      </div>

      {renderToolbar()}

      <div className="spm-plot spm-plot-fill" ref={chartRef}>
        {loading && <div className="spm-loading">Loading…</div>}
        {data.length === 0 ? (
          <div className="spm-empty" style={{ height: "100%" }}>No data</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 30, bottom: 30, left: 20 }}>
              {(settings.x.grid || settings.y.grid) && (
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e5e5e5"
                  horizontal={settings.y.grid}
                  vertical={settings.x.grid}
                />
              )}
              <XAxis
                {...axisProps("x", "x")}
                name={settings.x.title}
                label={{ value: settings.x.title, position: "insideBottom", offset: -15, style: { fontSize: settings.titleSize, fontFamily: FONT, fill: "#000" } }}
              />
              <YAxis
                {...axisProps("y", "y")}
                name={settings.y.title}
                label={{ value: settings.y.title, angle: -90, position: "insideLeft", offset: 10, style: { fontSize: settings.titleSize, fontFamily: FONT, textAnchor: "middle", fill: "#000" } }}
              />
              <ZAxis range={[70, 70]} />
              {referenceLines.map((rl, i) =>
                rl.axis === "x"
                  ? <ReferenceLine key={i} x={rl.value} stroke={rl.color || "#1f4e8c"} strokeWidth={1.5} />
                  : <ReferenceLine key={i} y={rl.value} stroke={rl.color || "#1f4e8c"} strokeWidth={1.5} />
              )}
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                formatter={fmtTooltip}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.label || ""}
              />
              <Scatter data={data} isAnimationActive={false}>
                {data.map((entry, i) => (
                  <Cell key={i} fill={fillFor(entry)} />
                ))}
                {settings.showLabels && (
                  <LabelList dataKey="label" position="top" content={(props) => (
                    <EditableValueLabel {...props} fontSize={9} fontWeight={600} fill="#000" formatter={(v) => v} overrides={valueOverrides} onOverride={handleValueOverride} />
                  )} />
                )}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </div>

      {showLegend && legendItems.length > 0 && (
        <div className="spm-legend">
          {legendItems.map((item) => (
            <span key={item.key}>
              <span className="spm-legend-dot" style={{ color: item.color }}>&bull;</span>
              <EditableLabel
                value={legendOverrides[item.key] || item.label}
                onChange={(v) => setLegendOverrides((prev) => ({ ...prev, [item.key]: v }))}
              />
            </span>
          ))}
        </div>
      )}

      {inspectorOpen && renderInspector()}
      <ResizeHandles onResize={onResize} />
    </div>
  );
}

export default ScatterPlotModule;
