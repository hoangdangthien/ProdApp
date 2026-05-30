import React, { useState, useEffect, useCallback } from "react";
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
  ScatterChart, Scatter, ZAxis, LabelList,
} from "recharts";
import * as XLSX from "xlsx-js-style";
import { saveAs } from "file-saver";
import { getFilters, getABC, getElementNumbers, getProductionDates } from "../api";
import ScatterPlotModule from "../components/ScatterPlotModule";

// Palette used to auto-assign colors when coloring points by a category
const PALETTE = [
  "#1976d2", "#4caf50", "#ff9800", "#f44336", "#9c27b0", "#00bcd4",
  "#795548", "#607d8b", "#e91e63", "#cddc39", "#3f51b5", "#009688",
];

// Fields the user can color points by, besides the default quadrant coloring
const CATEGORY_FIELDS = [
  { value: "quadrant", label: "Quadrant (default)" },
  { value: "platform", label: "Platform (Giàn)" },
  { value: "field", label: "Field (Khu vực)" },
  { value: "element", label: "Element (Đối tượng)" },
];

const blankAxis = () => ({ label: "", min: "", max: "", ticks: "" });

const DEFAULT_PLOT_SETTINGS = {
  open: false,
  colorBy: "quadrant",
  quadrantColors: { pos: "#4caf50", mixed: "#ff9800", neg: "#f44336" },
  categoryColors: {},
  abc: {
    x: blankAxis(),
    y: blankAxis(),
    legend: { pos: "Both increasing", mixed: "Mixed", neg: "Both declining" },
  },
  decomp: {
    x: blankAxis(),
    y: blankAxis(),
    legend: { pos: "Both positive", mixed: "Mixed", neg: "Both negative" },
  },
};

function ABCPage() {
  const [filters, setFilters] = useState({ fields: [], reservoirs: [], platforms: [] });
  const [field, setField] = useState("");
  const [reservoir, setReservoir] = useState("");
  const [platform, setPlatform] = useState("");
  const [elementNumbers, setElementNumbers] = useState([]);
  const [elementNumber, setElementNumber] = useState("");
  const [well, setWell] = useState("");
  const [analyzeBy, setAnalyzeBy] = useState("element");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [wells, setWells] = useState([]);
  const [availableDates, setAvailableDates] = useState([]);
  const [refDate, setRefDate] = useState("");
  const [scatterPeriod, setScatterPeriod] = useState(3);
  const [annotations, setAnnotations] = useState(() => {
    try { return JSON.parse(localStorage.getItem("abc_annotations") || "{}"); } catch { return {}; }
  });
  const [plotSettings, setPlotSettings] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("abc_plot_settings"));
      return saved ? { ...DEFAULT_PLOT_SETTINGS, ...saved } : DEFAULT_PLOT_SETTINGS;
    } catch { return DEFAULT_PLOT_SETTINGS; }
  });

  const updatePlotSettings = (updater) => {
    setPlotSettings((prev) => {
      const next = typeof updater === "function" ? updater(prev) : { ...prev, ...updater };
      localStorage.setItem("abc_plot_settings", JSON.stringify(next));
      return next;
    });
  };

  // Update a single axis property, e.g. setAxis("abc", "x", "label", "My label")
  const setAxis = (chart, axis, key, value) => {
    updatePlotSettings((prev) => ({
      ...prev,
      [chart]: { ...prev[chart], [axis]: { ...prev[chart][axis], [key]: value } },
    }));
  };

  const setLegendLabel = (chart, key, value) => {
    updatePlotSettings((prev) => ({
      ...prev,
      [chart]: { ...prev[chart], legend: { ...prev[chart].legend, [key]: value } },
    }));
  };

  const resetPlotSettings = () => updatePlotSettings({ ...DEFAULT_PLOT_SETTINGS, open: true });

  useEffect(() => {
    getFilters().then((res) => setFilters(res.data));
    getProductionDates().then((res) => setAvailableDates(res.data));
  }, []);

  useEffect(() => {
    const params = {};
    if (field) params.field = field;
    if (reservoir) params.reservoir = reservoir;
    if (platform) params.platform = platform;
    getElementNumbers(params).then((res) => setElementNumbers(res.data));
  }, [field, reservoir, platform]);

  // Load wells for the well dropdown
  useEffect(() => {
    const params = {};
    if (field) params.field = field;
    if (reservoir) params.reservoir = reservoir;
    if (platform) params.platform = platform;
    if (elementNumber) params.element_number = elementNumber;
    // Use cascading filters to get unique_ids
    const queryParams = new URLSearchParams();
    if (field) queryParams.set("field", field);
    if (reservoir) queryParams.set("reservoir", reservoir);
    if (platform) queryParams.set("platform", platform);
    import("../api").then(({ getCascadingFilters }) => {
      getCascadingFilters(params).then((res) => setWells(res.data.unique_ids || []));
    });
  }, [field, reservoir, platform, elementNumber]);

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    const params = { analyze_by: analyzeBy };
    if (field) params.field = field;
    if (reservoir) params.reservoir = reservoir;
    if (platform) params.platform = platform;
    if (elementNumber) params.element_number = elementNumber;
    if (well) params.well = well;
    if (refDate) params.ref_date = refDate;
    const res = await getABC(params);
    setData(res.data);
    setLoading(false);
  }, [analyzeBy, field, reservoir, platform, elementNumber, well, refDate]);

  useEffect(() => { runAnalysis(); }, [runAnalysis]);

  const items = data?.items || [];

  // Points for the Spotfire-style scatter module: X = Water/Liquid Rate Change,
  // Y = Oil Rate Change. The delta_* / category fields are carried through so
  // the existing color logic (getPointColor) and legend keep working.
  const abcPlotData = items.map((item) => ({
    x: item[`delta_liq_${scatterPeriod}m`],
    y: item[`delta_oil_${scatterPeriod}m`],
    label: item.label || item.name,
    name: item.label || item.name,
    category: item.element || "—",
    deltaOil: item[`delta_oil_${scatterPeriod}m`],
    deltaLiq: item[`delta_liq_${scatterPeriod}m`],
    platform: item.platform || "—",
    field: item.field || "—",
    element: item.element || "—",
  }));

  // Chronological dates that drive the module's time slider / playback.
  const timelineDates = [...availableDates].sort();
  const currentTimelineDate = refDate || data?.latest_date || timelineDates[timelineDates.length - 1] || "";

  const decompositionData = items.map((item) => {
    const oilCur = item.current_oil_rate || 0;
    const oilPrev = item[`oil_rate_${scatterPeriod}m_ago`] || 0;
    const liqCur = item.current_liq_rate || 0;
    const liqPrev = item[`liq_rate_${scatterPeriod}m_ago`] || 0;
    const deltaOilTotal = oilCur - oilPrev;
    const wcPrev = liqPrev > 0 ? 100 * (liqPrev - oilPrev) / liqPrev : 0;
    const deltaOilBecauseLiq = (liqCur - liqPrev) * (100 - wcPrev) / 100;
    const deltaOilBecauseWC = deltaOilTotal - deltaOilBecauseLiq;
    return {
      name: item.label || item.name,
      deltaOilBecauseLiq: parseFloat(deltaOilBecauseLiq.toFixed(2)),
      deltaOilBecauseWC: parseFloat(deltaOilBecauseWC.toFixed(2)),
      platform: item.platform || "—",
      field: item.field || "—",
      element: item.element || "—",
    };
  });

  const { colorBy, quadrantColors, categoryColors } = plotSettings;

  // Distinct values for the active category field (empty when coloring by quadrant)
  const categoryValues = colorBy === "quadrant"
    ? []
    : [...new Set(items.map((it) => it[colorBy] || "—"))].sort();

  const colorForCategory = (value, idx) =>
    categoryColors[value] || PALETTE[idx % PALETTE.length];

  // Resolve fill color for a point. `quadrantKey` picks pos/neg by the chart's own rule.
  const resolveColor = (entry, quadrantKey) => {
    if (colorBy !== "quadrant") {
      const value = entry[colorBy] || "—";
      const idx = categoryValues.indexOf(value);
      return colorForCategory(value, idx < 0 ? 0 : idx);
    }
    return quadrantColors[quadrantKey(entry)];
  };

  const abcQuadrantKey = (entry) => {
    if (entry.deltaOil > 0 && entry.deltaLiq > 0) return "pos";
    if (entry.deltaOil < 0 && entry.deltaLiq < 0) return "neg";
    return "mixed";
  };

  const getPointColor = (entry) => resolveColor(entry, abcQuadrantKey);

  const decompDomain = (() => {
    let xMin = 0, xMax = 0, yMin = 0, yMax = 0;
    decompositionData.forEach((d) => {
      if (d.deltaOilBecauseLiq != null) { xMin = Math.min(xMin, d.deltaOilBecauseLiq); xMax = Math.max(xMax, d.deltaOilBecauseLiq); }
      if (d.deltaOilBecauseWC != null) { yMin = Math.min(yMin, d.deltaOilBecauseWC); yMax = Math.max(yMax, d.deltaOilBecauseWC); }
    });
    const xPad = (xMax - xMin) * 0.05 || 1;
    const yPad = (yMax - yMin) * 0.05 || 1;
    return { x: [xMin - xPad, xMax + xPad], y: [yMin - yPad, yMax + yPad] };
  })();

  const decompQuadrantKey = (entry) => {
    if (entry.deltaOilBecauseLiq > 0 && entry.deltaOilBecauseWC > 0) return "pos";
    if (entry.deltaOilBecauseLiq < 0 && entry.deltaOilBecauseWC < 0) return "neg";
    return "mixed";
  };

  const getDecompColor = (entry) => resolveColor(entry, decompQuadrantKey);

  // Build axis props (domain + tickCount) from settings, falling back to a computed domain
  const axisProps = (chart, axis, fallbackDomain) => {
    const s = plotSettings[chart][axis];
    const lo = s.min === "" || s.min == null ? (fallbackDomain ? fallbackDomain[0] : "auto") : Number(s.min);
    const hi = s.max === "" || s.max == null ? (fallbackDomain ? fallbackDomain[1] : "auto") : Number(s.max);
    const props = { domain: [lo, hi] };
    // Enforce explicit limits strictly (clip data) instead of letting recharts expand
    if (s.min !== "" && s.min != null) props.allowDataOverflow = true;
    if (s.max !== "" && s.max != null) props.allowDataOverflow = true;
    if (s.ticks !== "" && s.ticks != null && Number(s.ticks) > 0) {
      props.tickCount = Number(s.ticks);
      props.allowDecimals = true;
    }
    return props;
  };

  // Resolve an axis label, using the user override when provided
  const axisLabel = (chart, axis, fallback) => {
    const v = plotSettings[chart][axis].label;
    return v && v.trim() ? v : fallback;
  };

  // Legend entries for a chart, depending on the active color mode
  const legendItems = (chart) => {
    if (colorBy !== "quadrant") {
      return categoryValues.map((value, idx) => ({
        key: value,
        label: value,
        color: colorForCategory(value, idx),
      }));
    }
    const lg = plotSettings[chart].legend;
    return [
      { key: "pos", label: lg.pos, color: quadrantColors.pos },
      { key: "mixed", label: lg.mixed, color: quadrantColors.mixed },
      { key: "neg", label: lg.neg, color: quadrantColors.neg },
    ];
  };

  const renderLegend = (chart) => (
    <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 8, fontSize: 12, flexWrap: "wrap" }}>
      {legendItems(chart).map((item) => (
        <span key={item.key}>
          <span style={{ color: item.color, fontWeight: "bold" }}>&bull;</span> {item.label}
        </span>
      ))}
    </div>
  );

  const numInput = (chart, axis, key, placeholder) => (
    <input
      type="number"
      className="ps-input"
      value={plotSettings[chart][axis][key]}
      placeholder={placeholder}
      onChange={(e) => setAxis(chart, axis, key, e.target.value)}
    />
  );

  // Axis settings block (label + min/max limits + tick count) for one chart axis
  const renderAxisSettings = (chart, axis, title) => (
    <div className="ps-axis">
      <div className="ps-axis-title">{title}</div>
      <input
        type="text"
        className="ps-input ps-input-wide"
        value={plotSettings[chart][axis].label}
        placeholder="Custom label (blank = default)"
        onChange={(e) => setAxis(chart, axis, "label", e.target.value)}
      />
      <div className="ps-row">
        <span className="ps-mini-label">Min</span>{numInput(chart, axis, "min", "auto")}
        <span className="ps-mini-label">Max</span>{numInput(chart, axis, "max", "auto")}
        <span className="ps-mini-label">Ticks</span>{numInput(chart, axis, "ticks", "auto")}
      </div>
    </div>
  );

  // Full settings card for one chart: axes + legend labels
  const renderChartSettings = (chart, title) => (
    <div className="ps-card">
      <div className="ps-card-title">{title}</div>
      {renderAxisSettings(chart, "x", "X axis")}
      {renderAxisSettings(chart, "y", "Y axis")}
      {colorBy === "quadrant" && (
        <div className="ps-axis">
          <div className="ps-axis-title">Legend labels</div>
          {["pos", "mixed", "neg"].map((k) => (
            <div className="ps-row" key={k}>
              <span style={{ color: quadrantColors[k], fontWeight: "bold" }}>&bull;</span>
              <input
                type="text"
                className="ps-input ps-input-wide"
                value={plotSettings[chart].legend[k]}
                onChange={(e) => setLegendLabel(chart, k, e.target.value)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Color configuration: quadrant colors, or per-category color pickers
  const renderColorSettings = () => (
    <div className="ps-card">
      <div className="ps-card-title">Colors</div>
      <div className="ps-axis">
        <div className="ps-axis-title">Color points by</div>
        <select
          className="ps-input ps-input-wide"
          value={colorBy}
          onChange={(e) => updatePlotSettings({ colorBy: e.target.value })}
        >
          {CATEGORY_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>
      {colorBy === "quadrant" ? (
        <div className="ps-axis">
          <div className="ps-axis-title">Quadrant colors</div>
          {[["pos", "Both positive"], ["mixed", "Mixed"], ["neg", "Both negative"]].map(([k, lbl]) => (
            <div className="ps-row" key={k}>
              <input
                type="color"
                className="ps-color"
                value={quadrantColors[k]}
                onChange={(e) => updatePlotSettings((prev) => ({
                  ...prev, quadrantColors: { ...prev.quadrantColors, [k]: e.target.value },
                }))}
              />
              <span style={{ fontSize: 12 }}>{lbl}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="ps-axis">
          <div className="ps-axis-title">{CATEGORY_FIELDS.find((f) => f.value === colorBy)?.label} colors</div>
          <div style={{ maxHeight: 180, overflowY: "auto" }}>
            {categoryValues.map((value, idx) => (
              <div className="ps-row" key={value}>
                <input
                  type="color"
                  className="ps-color"
                  value={colorForCategory(value, idx)}
                  onChange={(e) => updatePlotSettings((prev) => ({
                    ...prev, categoryColors: { ...prev.categoryColors, [value]: e.target.value },
                  }))}
                />
                <span style={{ fontSize: 12 }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Summary stats
  const totalItems = items.length;
  const declining = items.filter((i) => i[`delta_oil_${scatterPeriod}m`] < 0).length;
  const increasing = items.filter((i) => i[`delta_oil_${scatterPeriod}m`] > 0).length;
  const stable = totalItems - declining - increasing;

  const updateAnnotation = (name, field, value) => {
    setAnnotations((prev) => {
      const next = { ...prev, [name]: { ...prev[name], [field]: value } };
      localStorage.setItem("abc_annotations", JSON.stringify(next));
      return next;
    });
  };

  const formatPeriodLabel = (dt, months) => {
    if (!dt) return "";
    const d = new Date(dt);
    const past = new Date(d);
    past.setMonth(past.getMonth() - months);
    return `${String(past.getMonth() + 1).padStart(2, "0")}/${past.getFullYear()}`;
  };

  const currentPeriodLabel = data?.latest_date
    ? (() => { const d = new Date(data.latest_date); return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`; })()
    : "";
  const previousPeriodLabel = data?.latest_date ? formatPeriodLabel(data.latest_date, scatterPeriod) : "";

  const exportToExcel = () => {
    const p = scatterPeriod;

    // Two-tier grouped header matching the on-screen table
    const headerRow1 = [
      "Giếng", "Giàn", "Đối tượng", "Khu vực",
      previousPeriodLabel, "", "",
      currentPeriodLabel, "", "",
      "Chênh lệch", "", "",
      "Giảm lưu lượng dầu, t/ng.đ", "", "",
      "Nhóm nguyên nhân", "Ghi chú",
    ];
    const headerRow2 = [
      "", "", "", "",
      "Q_fluid, t/ng.đ", "Q_oil, t/ng.đ", "WCT, %",
      "Q_fluid, t/ng.đ", "Q_dầu, t/ng.đ", "WCT, %",
      "ΔQ_fluid", "ΔQ_dầu", "ΔWCT",
      "do Q_fluid", "do WCT", "Tổng ΔQ_oil",
      "", "",
    ];

    const dataRows = items.map((item) => [
      item.label || item.name,
      item.platform || "",
      item.element || "",
      item.field || "",
      item[`liq_rate_${p}m_ago`],
      item[`oil_rate_${p}m_ago`],
      item[`wct_${p}m_ago`],
      item.current_liq_rate,
      item.current_oil_rate,
      item.current_wct,
      item[`delta_liq_${p}m`],
      item[`delta_oil_${p}m`],
      item[`delta_wct_${p}m`],
      item[`decomp_liq_${p}m`],
      item[`decomp_wct_${p}m`],
      item[`delta_oil_${p}m`],
      annotations[item.name]?.cause || "",
      annotations[item.name]?.note || "",
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headerRow1, headerRow2, ...dataRows]);

    // Merge grouped header cells (r/c are 0-based)
    ws["!merges"] = [
      // Single-column headers spanning both header rows
      { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },   // Giếng
      { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },   // Giàn
      { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } },   // Đối tượng
      { s: { r: 0, c: 3 }, e: { r: 1, c: 3 } },   // Khu vực
      // Grouped column headers spanning 3 columns
      { s: { r: 0, c: 4 }, e: { r: 0, c: 6 } },   // previous period
      { s: { r: 0, c: 7 }, e: { r: 0, c: 9 } },   // current period
      { s: { r: 0, c: 10 }, e: { r: 0, c: 12 } }, // Chênh lệch
      { s: { r: 0, c: 13 }, e: { r: 0, c: 15 } }, // Giảm lưu lượng dầu
      // Trailing single-column headers spanning both rows
      { s: { r: 0, c: 16 }, e: { r: 1, c: 16 } }, // Nhóm nguyên nhân
      { s: { r: 0, c: 17 }, e: { r: 1, c: 17 } }, // Ghi chú
    ];

    // Style every cell: thin black border, centered text, Arial.
    // Header rows (0-1) are bold; data rows are not.
    const thin = { style: "thin", color: { rgb: "000000" } };
    const border = { top: thin, bottom: thin, left: thin, right: thin };
    const totalRows = 2 + dataRows.length;
    for (let r = 0; r < totalRows; r++) {
      for (let c = 0; c < headerRow1.length; c++) {
        const ref = XLSX.utils.encode_cell({ r, c });
        if (!ws[ref]) ws[ref] = { t: "s", v: "" };
        ws[ref].s = {
          font: { name: "Arial", bold: r < 2 },
          alignment: { horizontal: "center", vertical: "center", wrapText: true },
          border,
        };
      }
    }

    // Column widths
    ws["!cols"] = [
      { wch: 14 }, { wch: 8 }, { wch: 10 }, { wch: 10 },
      { wch: 12 }, { wch: 12 }, { wch: 8 },
      { wch: 12 }, { wch: 12 }, { wch: 8 },
      { wch: 10 }, { wch: 10 }, { wch: 8 },
      { wch: 10 }, { wch: 10 }, { wch: 12 },
      { wch: 18 }, { wch: 18 },
    ];

    // Filter on the second header row + data so it reads as a table
    const lastCol = XLSX.utils.encode_col(headerRow1.length - 1);
    ws["!autofilter"] = { ref: `A2:${lastCol}${2 + dataRows.length}` };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ABC Analysis");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buf], { type: "application/octet-stream" }), `ABC_Analysis_${currentPeriodLabel.replace("/", "-")}_${p}M.xlsx`);
  };

  return (
    <div style={{ flex: 1, padding: 20, overflowY: "auto" }}>
      {/* Controls */}
      <div className="abc-controls">
        <div className="control-group">
          <label>Analyze By</label>
          <div className="period-tabs">
            <button
              className={`period-tab ${analyzeBy === "element" ? "active" : ""}`}
              onClick={() => { setAnalyzeBy("element"); setWell(""); }}
            >
              Element #
            </button>
            <button
              className={`period-tab ${analyzeBy === "well" ? "active" : ""}`}
              onClick={() => { setAnalyzeBy("well"); setElementNumber(""); }}
            >
              Well
            </button>
          </div>
        </div>
        <div className="control-group">
          <label>Field</label>
          <select value={field} onChange={(e) => { setField(e.target.value); setReservoir(""); setPlatform(""); setElementNumber(""); setWell(""); }}>
            <option value="">All</option>
            {filters.fields.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div className="control-group">
          <label>Reservoir</label>
          <select value={reservoir} onChange={(e) => { setReservoir(e.target.value); setPlatform(""); setElementNumber(""); setWell(""); }}>
            <option value="">All</option>
            {filters.reservoirs.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="control-group">
          <label>Platform</label>
          <select value={platform} onChange={(e) => { setPlatform(e.target.value); setElementNumber(""); setWell(""); }}>
            <option value="">All</option>
            {filters.platforms.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        {analyzeBy === "element" ? (
          <div className="control-group">
            <label>Element #</label>
            <select value={elementNumber} onChange={(e) => setElementNumber(e.target.value)}>
              <option value="">All</option>
              {elementNumbers.map((en) => <option key={en} value={en}>{en}</option>)}
            </select>
          </div>
        ) : (
          <div className="control-group">
            <label>Well</label>
            <select value={well} onChange={(e) => setWell(e.target.value)}>
              <option value="">All</option>
              {wells.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
        )}
      </div>

      {loading && items.length === 0 ? (
        <div className="loading">Analyzing...</div>
      ) : !loading && items.length === 0 ? (
        <div className="loading">No data for selected filters</div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="abc-summary">
            <div className="summary-card">
              <div className="value">{totalItems}</div>
              <div className="label">{analyzeBy === "element" ? "Elements" : "Wells"}</div>
            </div>
            <div className="summary-card" style={{ borderTop: "4px solid #4caf50" }}>
              <div className="value" style={{ color: "#4caf50" }}>{increasing}</div>
              <div className="label">Increasing ({scatterPeriod}M)</div>
            </div>
            <div className="summary-card" style={{ borderTop: "4px solid #9e9e9e" }}>
              <div className="value">{stable}</div>
              <div className="label">Stable ({scatterPeriod}M)</div>
            </div>
            <div className="summary-card" style={{ borderTop: "4px solid #f44336" }}>
              <div className="value" style={{ color: "#f44336" }}>{declining}</div>
              <div className="label">Declining ({scatterPeriod}M)</div>
            </div>
            <div className="summary-card">
              <div className="value" style={{ fontSize: 16 }}>{data?.latest_date}</div>
              <div className="label">Latest Data</div>
            </div>
          </div>

          {/* Plot settings */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                className="period-tab"
                onClick={() => updatePlotSettings((prev) => ({ ...prev, open: !prev.open }))}
              >
                {plotSettings.open ? "▼" : "▶"} Plot Settings
              </button>
              {plotSettings.open && (
                <button className="period-tab" onClick={resetPlotSettings}>Reset to defaults</button>
              )}
            </div>
            {plotSettings.open && (
              <div className="ps-panel">
                {renderColorSettings()}
                {renderChartSettings("abc", "Δ Oil vs Δ Liquid plot")}
                {renderChartSettings("decomp", "Decomposition plot")}
              </div>
            )}
          </div>

          {/* Scatter Plots Row */}
          <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
            {/* ABC Scatter Plot — custom Spotfire-style module */}
            <div className="chart-card" style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 8, flexWrap: "wrap" }}>
                <h3 style={{ margin: 0 }}>&Delta; Oil Rate vs &Delta; Liquid Rate (t/d)</h3>
                <div className="period-tabs">
                  {[3, 6, 9, 12].map((p) => (
                    <button
                      key={p}
                      className={`period-tab ${scatterPeriod === p ? "active" : ""}`}
                      onClick={() => setScatterPeriod(p)}
                      style={{ fontSize: 12, padding: "4px 10px" }}
                    >
                      {p}M
                    </button>
                  ))}
                </div>
              </div>
              <ScatterPlotModule
                title={`${scatterPeriod}M`}
                data={abcPlotData}
                xTitle="Water Rate Change, t/d"
                yTitle="Oil Rate Change, t/d"
                colorForPoint={getPointColor}
                legend={legendItems("abc")}
                dates={timelineDates}
                currentDate={currentTimelineDate}
                onDateChange={setRefDate}
                loading={loading}
                storageKey="abc_scatter_module"
                height={450}
              />
            </div>

            {/* Decomposition Scatter Plot */}
            <div className="chart-card" style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 8, flexWrap: "wrap" }}>
                <h3 style={{ margin: 0 }}>Oil Rate Change Decomposition ({scatterPeriod}M)</h3>
              </div>
              {decompositionData.length === 0 ? (
                <div className="empty-state">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={450}>
                  <ScatterChart margin={{ top: 20, right: 30, bottom: 40, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      type="number"
                      dataKey="deltaOilBecauseLiq"
                      name="Δ Oil due to Liquid"
                      unit=" t/d"
                      tick={{ fontSize: 11 }}
                      {...axisProps("decomp", "x", decompDomain.x)}
                      label={{ value: axisLabel("decomp", "x", "Changing Oil Rate because of changing Liquid (t/d)"), position: "insideBottom", offset: -25, style: { fontSize: 11 } }}
                    />
                    <YAxis
                      type="number"
                      dataKey="deltaOilBecauseWC"
                      name="Δ Oil due to WC"
                      unit=" t/d"
                      tick={{ fontSize: 11 }}
                      {...axisProps("decomp", "y", decompDomain.y)}
                      label={{ value: axisLabel("decomp", "y", "Changing Oil Rate because of changing WC (t/d)"), angle: -90, position: "insideLeft", style: { fontSize: 11 } }}
                    />
                    <ZAxis range={[60, 60]} />
                    <ReferenceLine x={0} stroke="#666" strokeWidth={1} strokeDasharray="4 4" />
                    <ReferenceLine y={0} stroke="#666" strokeWidth={1} strokeDasharray="4 4" />
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      formatter={(value, name) => [`${value > 0 ? "+" : ""}${value.toFixed(2)} t/d`, name]}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.name || ""}
                    />
                    <Scatter data={decompositionData} name="Wells/Elements">
                      {decompositionData.map((entry, i) => (
                        <Cell key={i} fill={getDecompColor(entry)} />
                      ))}
                      <LabelList dataKey="name" position="top" style={{ fontSize: 9, fill: "#555" }} />
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              )}
              {renderLegend("decomp")}
            </div>
          </div>

          {/* Detail Table */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
            <button className="abc-btn" onClick={exportToExcel} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export Excel
            </button>
          </div>
          <div className="abc-table-container" style={{ overflowX: "auto" }}>
            <table className="abc-table">
              <thead>
                <tr>
                  <th rowSpan={2} style={{ position: "sticky", left: 0, zIndex: 2, background: "#1a1a2e" }}>Giếng</th>
                  <th rowSpan={2}>Giàn</th>
                  <th rowSpan={2}>Đối tượng</th>
                  <th rowSpan={2}>Khu vực</th>
                  <th colSpan={3} style={{ textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.2)" }}>{previousPeriodLabel}</th>
                  <th colSpan={3} style={{ textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.2)", background: "#2a3a5e" }}>{currentPeriodLabel}</th>
                  <th colSpan={3} style={{ textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.2)" }}>Chênh lệch</th>
                  <th colSpan={3} style={{ textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.2)" }}>Giảm lưu lượng dầu, t/ng.đ</th>
                  <th rowSpan={2} style={{ minWidth: 140 }}>Nhóm nguyên nhân</th>
                  <th rowSpan={2} style={{ minWidth: 140 }}>Ghi chú</th>
                </tr>
                <tr>
                  <th>Q_fluid, t/ng.đ</th>
                  <th>Q_oil, t/ng.đ</th>
                  <th>WCT, %</th>
                  <th style={{ background: "#2a3a5e" }}>Q_fluid, t/ng.đ</th>
                  <th style={{ background: "#2a3a5e" }}>Q_dầu, t/ng.đ</th>
                  <th style={{ background: "#2a3a5e" }}>WCT, %</th>
                  <th>&Delta;Q_fluid</th>
                  <th>&Delta;Q_dầu</th>
                  <th>&Delta;WCT</th>
                  <th>do Q_fluid</th>
                  <th>do WCT</th>
                  <th>Tổng &Delta;Q_oil</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const p = scatterPeriod;
                  const deltaLiq = item[`delta_liq_${p}m`];
                  const deltaOil = item[`delta_oil_${p}m`];
                  const deltaWct = item[`delta_wct_${p}m`];
                  const decompLiq = item[`decomp_liq_${p}m`];
                  const decompWct = item[`decomp_wct_${p}m`];
                  const ann = annotations[item.name] || {};
                  const deltaColor = (v) => v > 0 ? "#4caf50" : v < 0 ? "#f44336" : "#666";
                  return (
                    <tr key={item.name}>
                      <td style={{ position: "sticky", left: 0, background: "#fff", zIndex: 1, fontWeight: 600 }}>{item.label || item.name}</td>
                      <td>{item.platform}</td>
                      <td>{item.element}</td>
                      <td>{item.field}</td>
                      <td>{item[`liq_rate_${p}m_ago`]}</td>
                      <td>{item[`oil_rate_${p}m_ago`]}</td>
                      <td>{item[`wct_${p}m_ago`]}</td>
                      <td style={{ background: "#f0f4ff" }}>{item.current_liq_rate}</td>
                      <td style={{ background: "#f0f4ff" }}>{item.current_oil_rate}</td>
                      <td style={{ background: "#f0f4ff" }}>{item.current_wct}</td>
                      <td style={{ color: deltaColor(deltaLiq) }}>{deltaLiq}</td>
                      <td style={{ color: deltaColor(deltaOil) }}>{deltaOil}</td>
                      <td style={{ color: deltaColor(-deltaWct) }}>{deltaWct}</td>
                      <td style={{ color: deltaColor(decompLiq) }}>{decompLiq}</td>
                      <td style={{ color: deltaColor(decompWct) }}>{decompWct}</td>
                      <td style={{ color: deltaColor(deltaOil), fontWeight: 600 }}>{deltaOil}</td>
                      <td style={{ padding: 0 }}>
                        <input
                          className="abc-cell-input"
                          value={ann.cause || ""}
                          onChange={(e) => updateAnnotation(item.name, "cause", e.target.value)}
                          placeholder="—"
                        />
                      </td>
                      <td style={{ padding: 0 }}>
                        <input
                          className="abc-cell-input"
                          value={ann.note || ""}
                          onChange={(e) => updateAnnotation(item.name, "note", e.target.value)}
                          placeholder="—"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default ABCPage;
