import React, { useState, useEffect, useCallback } from "react";
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
  ScatterChart, Scatter, ZAxis, LabelList, Customized,
} from "recharts";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { getFilters, getABC, getElementNumbers, getProductionDates, getABCTracking } from "../api";

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
  const [showTracking, setShowTracking] = useState(false);
  const [trackingData, setTrackingData] = useState({});
  const [annotations, setAnnotations] = useState(() => {
    try { return JSON.parse(localStorage.getItem("abc_annotations") || "{}"); } catch { return {}; }
  });

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

  const scatterData = items.map((item) => ({
    name: item.label || item.name,
    deltaOil: item[`delta_oil_${scatterPeriod}m`],
    deltaLiq: item[`delta_liq_${scatterPeriod}m`],
  }));

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
    };
  });

  const getPointColor = (entry) => {
    if (entry.deltaOil > 0 && entry.deltaLiq > 0) return "#4caf50";
    if (entry.deltaOil < 0 && entry.deltaLiq < 0) return "#f44336";
    return "#ff9800";
  };

  useEffect(() => {
    if (!showTracking) {
      setTrackingData({});
      return;
    }
    const params = { period: scatterPeriod, analyze_by: analyzeBy };
    if (field) params.field = field;
    if (reservoir) params.reservoir = reservoir;
    if (platform) params.platform = platform;
    if (elementNumber) params.element_number = elementNumber;
    if (well) params.well = well;
    if (refDate) params.ref_date = refDate;
    getABCTracking(params).then((res) => setTrackingData(res.data.tracks || {}));
  }, [showTracking, scatterPeriod, analyzeBy, field, reservoir, platform, elementNumber, well, refDate]);

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

  const getDecompColor = (entry) => {
    if (entry.deltaOilBecauseLiq > 0 && entry.deltaOilBecauseWC > 0) return "#4caf50";
    if (entry.deltaOilBecauseLiq < 0 && entry.deltaOilBecauseWC < 0) return "#f44336";
    return "#ff9800";
  };

  const TrackingLines = (props) => {
    if (!showTracking || !Object.keys(trackingData).length) return null;
    const xAxis = props.xAxisMap && Object.values(props.xAxisMap)[0];
    const yAxis = props.yAxisMap && Object.values(props.yAxisMap)[0];
    if (!xAxis?.scale || !yAxis?.scale) return null;
    const entries = Object.entries(trackingData);
    return (
      <g>
        <defs>
          <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
            <polygon points="0 0, 6 2, 0 4" fill="rgba(100,100,100,0.6)" />
          </marker>
        </defs>
        {entries.map(([key, path]) => {
          if (path.length < 2) return null;
          const d = path
            .map(([x, y], j) => `${j === 0 ? "M" : "L"}${xAxis.scale(x)},${yAxis.scale(y)}`)
            .join(" ");
          return (
            <path
              key={key}
              d={d}
              fill="none"
              stroke="rgba(100,100,100,0.3)"
              strokeWidth={1}
              markerEnd="url(#arrowhead)"
            />
          );
        })}
      </g>
    );
  };

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
    const rows = items.map((item, i) => ({
      "#": i + 1,
      "Giếng": item.label || item.name,
      "Giàn": item.platform || "",
      "Đối tượng": item.element || "",
      "Khu vực": item.field || "",
      [`Q_fluid (${previousPeriodLabel})`]: item[`liq_rate_${p}m_ago`],
      [`Q_oil (${previousPeriodLabel})`]: item[`oil_rate_${p}m_ago`],
      [`WCT% (${previousPeriodLabel})`]: item[`wct_${p}m_ago`],
      [`Q_fluid (${currentPeriodLabel})`]: item.current_liq_rate,
      [`Q_dầu (${currentPeriodLabel})`]: item.current_oil_rate,
      [`WCT% (${currentPeriodLabel})`]: item.current_wct,
      "ΔQ_fluid": item[`delta_liq_${p}m`],
      "ΔQ_dầu": item[`delta_oil_${p}m`],
      "ΔWCT": item[`delta_wct_${p}m`],
      "Giảm do Q_fluid": item[`decomp_liq_${p}m`],
      "Giảm do WCT": item[`decomp_wct_${p}m`],
      "Tổng ΔQ_oil": item[`delta_oil_${p}m`],
      "Nhóm nguyên nhân": annotations[item.name]?.cause || "",
      "Ghi chú": annotations[item.name]?.note || "",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
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
          <label>Reference Date</label>
          <select value={refDate} onChange={(e) => setRefDate(e.target.value)}>
            <option value="">Latest</option>
            {availableDates.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
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

      {loading ? (
        <div className="loading">Analyzing...</div>
      ) : items.length === 0 ? (
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
            {/* ABC Scatter Plot */}
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
                <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, cursor: "pointer", marginLeft: 8 }}>
                  <input type="checkbox" checked={showTracking} onChange={(e) => setShowTracking(e.target.checked)} />
                  Show tracking
                </label>
              </div>
              {scatterData.length === 0 ? (
                <div className="empty-state">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={450}>
                  <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      type="number"
                      dataKey="deltaOil"
                      name={`Δ Oil Rate (${scatterPeriod}M)`}
                      unit=" t/d"
                      tick={{ fontSize: 11 }}
                      label={{ value: `Δ Oil Rate (t/d) — ${scatterPeriod}M`, position: "insideBottom", offset: -10, style: { fontSize: 12 } }}
                    />
                    <YAxis
                      type="number"
                      dataKey="deltaLiq"
                      name={`Δ Liq Rate (${scatterPeriod}M)`}
                      unit=" t/d"
                      tick={{ fontSize: 11 }}
                      label={{ value: `Δ Liquid Rate (t/d) — ${scatterPeriod}M`, angle: -90, position: "insideLeft", style: { fontSize: 12 } }}
                    />
                    <ZAxis range={[60, 60]} />
                    <ReferenceLine x={0} stroke="#666" strokeWidth={1} strokeDasharray="4 4" />
                    <ReferenceLine y={0} stroke="#666" strokeWidth={1} strokeDasharray="4 4" />
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      formatter={(value, name) => [`${value > 0 ? "+" : ""}${value.toFixed(2)} t/d`, name]}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.name || ""}
                    />
                    <Customized component={TrackingLines} />
                    <Scatter data={scatterData} name="Wells/Elements">
                      {scatterData.map((entry, i) => (
                        <Cell key={i} fill={getPointColor(entry)} />
                      ))}
                      <LabelList dataKey="name" position="top" style={{ fontSize: 9, fill: "#555" }} />
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              )}
              <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 8, fontSize: 12 }}>
                <span><span style={{ color: "#4caf50", fontWeight: "bold" }}>&bull;</span> Both increasing</span>
                <span><span style={{ color: "#ff9800", fontWeight: "bold" }}>&bull;</span> Mixed</span>
                <span><span style={{ color: "#f44336", fontWeight: "bold" }}>&bull;</span> Both declining</span>
              </div>
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
                      domain={decompDomain.x}
                      tick={{ fontSize: 11 }}
                      label={{ value: "Changing Oil Rate because of changing Liquid (t/d)", position: "insideBottom", offset: -25, style: { fontSize: 11 } }}
                    />
                    <YAxis
                      type="number"
                      dataKey="deltaOilBecauseWC"
                      name="Δ Oil due to WC"
                      unit=" t/d"
                      domain={decompDomain.y}
                      tick={{ fontSize: 11 }}
                      label={{ value: "Changing Oil Rate because of changing WC (t/d)", angle: -90, position: "insideLeft", style: { fontSize: 11 } }}
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
              <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 8, fontSize: 12 }}>
                <span><span style={{ color: "#4caf50", fontWeight: "bold" }}>&bull;</span> Both positive</span>
                <span><span style={{ color: "#ff9800", fontWeight: "bold" }}>&bull;</span> Mixed</span>
                <span><span style={{ color: "#f44336", fontWeight: "bold" }}>&bull;</span> Both negative</span>
              </div>
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
