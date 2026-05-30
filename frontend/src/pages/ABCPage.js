import React, { useState, useEffect, useCallback } from "react";
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

const DEFAULT_COLOR_SETTINGS = {
  colorBy: "quadrant",
  quadrantColors: { pos: "#4caf50", mixed: "#ff9800", neg: "#f44336" },
  categoryColors: {},
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
  const [cellOverrides, setCellOverrides] = useState(() => {
    try { return JSON.parse(localStorage.getItem("abc_cell_overrides") || "{}"); } catch { return {}; }
  });
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [headerOverrides, setHeaderOverrides] = useState(() => {
    try { return JSON.parse(localStorage.getItem("abc_header_overrides") || "{}"); } catch { return {}; }
  });
  const [editingHeader, setEditingHeader] = useState(null);
  const [editHeaderValue, setEditHeaderValue] = useState("");
  const [colorSettings, setColorSettings] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("abc_color_settings"));
      return saved ? { ...DEFAULT_COLOR_SETTINGS, ...saved } : DEFAULT_COLOR_SETTINGS;
    } catch { return DEFAULT_COLOR_SETTINGS; }
  });

  const updateColorSettings = (updater) => {
    setColorSettings((prev) => {
      const next = typeof updater === "function" ? updater(prev) : { ...prev, ...updater };
      localStorage.setItem("abc_color_settings", JSON.stringify(next));
      return next;
    });
  };

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
      x: parseFloat(deltaOilBecauseLiq.toFixed(2)),
      y: parseFloat(deltaOilBecauseWC.toFixed(2)),
      label: item.label || item.name,
      name: item.label || item.name,
      category: item.element || "—",
      deltaOilBecauseLiq: parseFloat(deltaOilBecauseLiq.toFixed(2)),
      deltaOilBecauseWC: parseFloat(deltaOilBecauseWC.toFixed(2)),
      platform: item.platform || "—",
      field: item.field || "—",
      element: item.element || "—",
    };
  });

  const { colorBy, quadrantColors, categoryColors } = colorSettings;

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

  const decompQuadrantKey = (entry) => {
    if (entry.deltaOilBecauseLiq > 0 && entry.deltaOilBecauseWC > 0) return "pos";
    if (entry.deltaOilBecauseLiq < 0 && entry.deltaOilBecauseWC < 0) return "neg";
    return "mixed";
  };

  const getDecompColor = (entry) => resolveColor(entry, decompQuadrantKey);

  const LEGEND_LABELS = {
    abc: { pos: "Both increasing", mixed: "Mixed", neg: "Both declining" },
    decomp: { pos: "Both positive", mixed: "Mixed", neg: "Both negative" },
  };

  const legendItems = (chart) => {
    if (colorBy !== "quadrant") {
      return categoryValues.map((value, idx) => ({
        key: value,
        label: value,
        color: colorForCategory(value, idx),
      }));
    }
    const lg = LEGEND_LABELS[chart];
    return [
      { key: "pos", label: lg.pos, color: quadrantColors.pos },
      { key: "mixed", label: lg.mixed, color: quadrantColors.mixed },
      { key: "neg", label: lg.neg, color: quadrantColors.neg },
    ];
  };

  const categoryColorEntries = categoryValues.map((value, idx) => ({
    value,
    color: colorForCategory(value, idx),
  }));

  const handleColorByChange = (value) => updateColorSettings({ colorBy: value });
  const handleQuadrantColorChange = (key, hex) =>
    updateColorSettings((prev) => ({
      ...prev, quadrantColors: { ...prev.quadrantColors, [key]: hex },
    }));
  const handleCategoryColorChange = (value, hex) =>
    updateColorSettings((prev) => ({
      ...prev, categoryColors: { ...prev.categoryColors, [value]: hex },
    }));

  // Summary stats
  const totalItems = items.length;
  const declining = items.filter((i) => i[`delta_oil_${scatterPeriod}m`] < 0).length;
  const increasing = items.filter((i) => i[`delta_oil_${scatterPeriod}m`] > 0).length;
  const stable = totalItems - declining - increasing;

  const updateCellOverride = (itemName, colKey, value) => {
    setCellOverrides((prev) => {
      const next = { ...prev, [itemName]: { ...prev[itemName], [colKey]: value } };
      localStorage.setItem("abc_cell_overrides", JSON.stringify(next));
      return next;
    });
  };

  const startEditing = (itemName, colKey, currentValue) => {
    setEditingCell({ itemName, colKey });
    setEditValue(currentValue != null ? String(currentValue) : "");
  };

  const commitEdit = () => {
    if (!editingCell) return;
    const { itemName, colKey } = editingCell;
    updateCellOverride(itemName, colKey, editValue);
    setEditingCell(null);
    setEditValue("");
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue("");
  };

  const getCellValue = (item, colKey, originalValue) => {
    const override = cellOverrides[item.name]?.[colKey];
    return override !== undefined ? override : originalValue;
  };

  const updateHeaderOverride = (key, value) => {
    setHeaderOverrides((prev) => {
      const next = { ...prev, [key]: value };
      localStorage.setItem("abc_header_overrides", JSON.stringify(next));
      return next;
    });
  };

  const startEditingHeader = (key, currentValue) => {
    setEditingHeader(key);
    setEditHeaderValue(currentValue || "");
  };

  const commitHeaderEdit = () => {
    if (!editingHeader) return;
    updateHeaderOverride(editingHeader, editHeaderValue);
    setEditingHeader(null);
    setEditHeaderValue("");
  };

  const cancelHeaderEdit = () => {
    setEditingHeader(null);
    setEditHeaderValue("");
  };

  const getHeaderValue = (key, defaultValue) =>
    headerOverrides[key] !== undefined ? headerOverrides[key] : defaultValue;

  const renderHeader = (key, defaultValue, extraProps = {}) => {
    const { style = {}, ...rest } = extraProps;
    const displayValue = getHeaderValue(key, defaultValue);
    const hasOverride = headerOverrides[key] !== undefined;
    if (editingHeader === key) {
      return (
        <th {...rest} style={{ ...style, padding: 0 }}>
          <input
            className="abc-header-input"
            autoFocus
            value={editHeaderValue}
            onChange={(e) => setEditHeaderValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitHeaderEdit();
              if (e.key === "Escape") cancelHeaderEdit();
            }}
            onBlur={commitHeaderEdit}
          />
        </th>
      );
    }
    return (
      <th
        {...rest}
        style={{ ...style, cursor: "pointer", ...(hasOverride ? { fontStyle: "italic" } : {}) }}
        onClick={() => startEditingHeader(key, displayValue)}
      >
        {displayValue}
      </th>
    );
  };

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

    const hv = (key, def) => getHeaderValue(key, def);
    const headerRow1 = [
      hv("h_gieng", "Giếng"), hv("h_gian", "Giàn"), hv("h_doituong", "Đối tượng"), hv("h_khuvuc", "Khu vực"),
      hv("h_prev_period", previousPeriodLabel), "", "",
      hv("h_cur_period", currentPeriodLabel), "", "",
      hv("h_chenhlech", "Chênh lệch"), "", "",
      hv("h_giam_luuluong", "Giảm lưu lượng dầu, t/ng.đ"), "", "",
      hv("h_nhom_nguyennhan", "Nhóm nguyên nhân"), hv("h_ghichu", "Ghi chú"),
    ];
    const headerRow2 = [
      "", "", "", "",
      hv("h_prev_qfluid", "Q_fluid, t/ng.đ"), hv("h_prev_qoil", "Q_oil, t/ng.đ"), hv("h_prev_wct", "WCT, %"),
      hv("h_cur_qfluid", "Q_fluid, t/ng.đ"), hv("h_cur_qdau", "Q_dầu, t/ng.đ"), hv("h_cur_wct", "WCT, %"),
      hv("h_delta_qfluid", "ΔQ_fluid"), hv("h_delta_qdau", "ΔQ_dầu"), hv("h_delta_wct", "ΔWCT"),
      hv("h_decomp_qfluid", "do Q_fluid"), hv("h_decomp_wct", "do WCT"), hv("h_total_delta_qoil", "Tổng ΔQ_oil"),
      "", "",
    ];

    const dataRows = items.map((item) => {
      const cv = (colKey, orig) => getCellValue(item, colKey, orig);
      return [
        cv("label", item.label || item.name),
        cv("platform", item.platform || ""),
        cv("element", item.element || ""),
        cv("region", item.region || ""),
        cv(`liq_rate_${p}m_ago`, item[`liq_rate_${p}m_ago`]),
        cv(`oil_rate_${p}m_ago`, item[`oil_rate_${p}m_ago`]),
        cv(`wct_${p}m_ago`, item[`wct_${p}m_ago`]),
        cv("current_liq_rate", item.current_liq_rate),
        cv("current_oil_rate", item.current_oil_rate),
        cv("current_wct", item.current_wct),
        cv(`delta_liq_${p}m`, item[`delta_liq_${p}m`]),
        cv(`delta_oil_${p}m`, item[`delta_oil_${p}m`]),
        cv(`delta_wct_${p}m`, item[`delta_wct_${p}m`]),
        cv(`decomp_liq_${p}m`, item[`decomp_liq_${p}m`]),
        cv(`decomp_wct_${p}m`, item[`decomp_wct_${p}m`]),
        cv(`total_delta_oil_${p}m`, item[`delta_oil_${p}m`]),
        annotations[item.name]?.cause || "",
        annotations[item.name]?.note || "",
      ];
    });

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
                colorByOptions={CATEGORY_FIELDS}
                colorBy={colorBy}
                onColorByChange={handleColorByChange}
                quadrantColors={quadrantColors}
                onQuadrantColorChange={handleQuadrantColorChange}
                categoryColorEntries={categoryColorEntries}
                onCategoryColorChange={handleCategoryColorChange}
              />
            </div>

            {/* Decomposition Scatter Plot — ScatterPlotModule */}
            <div className="chart-card" style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 8, flexWrap: "wrap" }}>
                <h3 style={{ margin: 0 }}>Oil Rate Change Decomposition ({scatterPeriod}M)</h3>
              </div>
              <ScatterPlotModule
                title={`Decomposition ${scatterPeriod}M`}
                data={decompositionData}
                xTitle="Changing Oil Rate because of changing Liquid (t/d)"
                yTitle="Changing Oil Rate because of changing WC (t/d)"
                colorForPoint={getDecompColor}
                legend={legendItems("decomp")}
                dates={timelineDates}
                currentDate={currentTimelineDate}
                onDateChange={setRefDate}
                loading={loading}
                storageKey="abc_decomp_module"
                height={450}
                colorByOptions={CATEGORY_FIELDS}
                colorBy={colorBy}
                onColorByChange={handleColorByChange}
                quadrantColors={quadrantColors}
                onQuadrantColorChange={handleQuadrantColorChange}
                categoryColorEntries={categoryColorEntries}
                onCategoryColorChange={handleCategoryColorChange}
              />
            </div>
          </div>

          {/* Detail Table */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
            <button className="abc-btn" onClick={exportToExcel} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
              Export Excel
            </button>
          </div>
          <div className="abc-table-container" style={{ overflowX: "auto" }}>
            <table className="abc-table">
              <thead>
                <tr>
                  {renderHeader("h_gieng", "Giếng", { rowSpan: 2, style: { position: "sticky", left: 0, zIndex: 2, background: "#1a1a2e" } })}
                  {renderHeader("h_gian", "Giàn", { rowSpan: 2 })}
                  {renderHeader("h_doituong", "Đối tượng", { rowSpan: 2 })}
                  {renderHeader("h_khuvuc", "Khu vực", { rowSpan: 2 })}
                  {renderHeader("h_prev_period", previousPeriodLabel, { colSpan: 3, style: { textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.2)" } })}
                  {renderHeader("h_cur_period", currentPeriodLabel, { colSpan: 3, style: { textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.2)", background: "#2a3a5e" } })}
                  {renderHeader("h_chenhlech", "Chênh lệch", { colSpan: 3, style: { textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.2)" } })}
                  {renderHeader("h_giam_luuluong", "Giảm lưu lượng dầu, t/ng.đ", { colSpan: 3, style: { textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.2)" } })}
                  {renderHeader("h_nhom_nguyennhan", "Nhóm nguyên nhân", { rowSpan: 2, style: { minWidth: 140 } })}
                  {renderHeader("h_ghichu", "Ghi chú", { rowSpan: 2, style: { minWidth: 140 } })}
                </tr>
                <tr>
                  {renderHeader("h_prev_qfluid", "Q_fluid, t/ng.đ")}
                  {renderHeader("h_prev_qoil", "Q_oil, t/ng.đ")}
                  {renderHeader("h_prev_wct", "WCT, %")}
                  {renderHeader("h_cur_qfluid", "Q_fluid, t/ng.đ", { style: { background: "#2a3a5e" } })}
                  {renderHeader("h_cur_qdau", "Q_dầu, t/ng.đ", { style: { background: "#2a3a5e" } })}
                  {renderHeader("h_cur_wct", "WCT, %", { style: { background: "#2a3a5e" } })}
                  {renderHeader("h_delta_qfluid", "ΔQ_fluid")}
                  {renderHeader("h_delta_qdau", "ΔQ_dầu")}
                  {renderHeader("h_delta_wct", "ΔWCT")}
                  {renderHeader("h_decomp_qfluid", "do Q_fluid")}
                  {renderHeader("h_decomp_wct", "do WCT")}
                  {renderHeader("h_total_delta_qoil", "Tổng ΔQ_oil")}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const p = scatterPeriod;
                  const deltaLiq = getCellValue(item, `delta_liq_${p}m`, item[`delta_liq_${p}m`]);
                  const deltaOil = getCellValue(item, `delta_oil_${p}m`, item[`delta_oil_${p}m`]);
                  const deltaWct = getCellValue(item, `delta_wct_${p}m`, item[`delta_wct_${p}m`]);
                  const decompLiq = getCellValue(item, `decomp_liq_${p}m`, item[`decomp_liq_${p}m`]);
                  const decompWct = getCellValue(item, `decomp_wct_${p}m`, item[`decomp_wct_${p}m`]);
                  const ann = annotations[item.name] || {};
                  const deltaColor = (v) => v > 0 ? "#4caf50" : v < 0 ? "#f44336" : "#666";
                  const isEditing = (colKey) => editingCell?.itemName === item.name && editingCell?.colKey === colKey;

                  const renderCell = (colKey, originalValue, style) => {
                    const displayValue = getCellValue(item, colKey, originalValue);
                    const hasOverride = cellOverrides[item.name]?.[colKey] !== undefined;
                    if (isEditing(colKey)) {
                      return (
                        <td style={{ ...style, padding: 0 }}>
                          <input
                            className="abc-cell-input"
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitEdit();
                              if (e.key === "Escape") cancelEdit();
                            }}
                            onBlur={commitEdit}
                          />
                        </td>
                      );
                    }
                    return (
                      <td
                        style={{ ...style, cursor: "pointer", ...(hasOverride ? { fontStyle: "italic", background: style?.background || "#fffde7" } : {}) }}
                        onClick={() => startEditing(item.name, colKey, displayValue)}
                      >
                        {displayValue}
                      </td>
                    );
                  };

                  return (
                    <tr key={item.name}>
                      {renderCell("label", item.label || item.name, { position: "sticky", left: 0, background: "#fff", zIndex: 1, fontWeight: 600 })}
                      {renderCell("platform", item.platform)}
                      {renderCell("element", item.element)}
                      {renderCell("region", item.region)}
                      {renderCell(`liq_rate_${p}m_ago`, item[`liq_rate_${p}m_ago`])}
                      {renderCell(`oil_rate_${p}m_ago`, item[`oil_rate_${p}m_ago`])}
                      {renderCell(`wct_${p}m_ago`, item[`wct_${p}m_ago`])}
                      {renderCell("current_liq_rate", item.current_liq_rate, { background: "#f0f4ff" })}
                      {renderCell("current_oil_rate", item.current_oil_rate, { background: "#f0f4ff" })}
                      {renderCell("current_wct", item.current_wct, { background: "#f0f4ff" })}
                      {renderCell(`delta_liq_${p}m`, item[`delta_liq_${p}m`], { color: deltaColor(deltaLiq) })}
                      {renderCell(`delta_oil_${p}m`, item[`delta_oil_${p}m`], { color: deltaColor(deltaOil) })}
                      {renderCell(`delta_wct_${p}m`, item[`delta_wct_${p}m`], { color: deltaColor(-deltaWct) })}
                      {renderCell(`decomp_liq_${p}m`, item[`decomp_liq_${p}m`], { color: deltaColor(decompLiq) })}
                      {renderCell(`decomp_wct_${p}m`, item[`decomp_wct_${p}m`], { color: deltaColor(decompWct) })}
                      {renderCell(`total_delta_oil_${p}m`, item[`delta_oil_${p}m`], { color: deltaColor(deltaOil), fontWeight: 600 })}
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
