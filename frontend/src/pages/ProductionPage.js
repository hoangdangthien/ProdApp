import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell,
} from "recharts";
import { getCascadingFilters, getProductionMulti, getYearlySummary } from "../api";
import ProductionChartModule from "../components/ProductionChartModule";

const FIELD_COLORS = [
  "#2e7d32", "#1976d2", "#e65100", "#6a1b9a", "#00838f",
  "#c62828", "#ef6c00", "#283593", "#00695c", "#ad1457",
];

function ProductionPage() {
  const [filters, setFilters] = useState({ fields: [], reservoirs: [], platforms: [], unique_ids: [] });
  const [field, setField] = useState("");
  const [reservoir, setReservoir] = useState("");
  const [platform, setPlatform] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [prodData, setProdData] = useState({});
  const [loading, setLoading] = useState(false);

  const [selectedYear, setSelectedYear] = useState("");
  const [availableYears, setAvailableYears] = useState([]);
  const [summaryByField, setSummaryByField] = useState([]);
  const [summaryByPlatform, setSummaryByPlatform] = useState([]);

  const loadFilters = useCallback(async () => {
    const params = {};
    if (field) params.field = field;
    if (reservoir) params.reservoir = reservoir;
    if (platform) params.platform = platform;
    const res = await getCascadingFilters(params);
    setFilters(res.data);
  }, [field, reservoir, platform]);

  useEffect(() => { loadFilters(); }, [loadFilters]);

  useEffect(() => {
    getYearlySummary(new Date().getFullYear()).then((res) => {
      const d = res.data;
      const years = d.available_years || [];
      setAvailableYears(years);
      const bestYear = years.length > 0 ? years[0] : new Date().getFullYear();
      setSelectedYear(bestYear);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedYear) return;
    getYearlySummary(selectedYear).then((res) => {
      const d = res.data;
      setSummaryByField(d.by_field || []);
      setSummaryByPlatform(d.by_platform || []);
    }).catch(() => {});
  }, [selectedYear]);

  useEffect(() => {
    if (selectedIds.length === 0) { setProdData({}); return; }
    setLoading(true);
    getProductionMulti(selectedIds)
      .then((res) => setProdData(res.data))
      .finally(() => setLoading(false));
  }, [selectedIds]);

  const toggleId = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const buildAggregatedData = () => {
    if (selectedIds.length === 0) return [];
    const dateMap = {};
    for (const uid of selectedIds) {
      const rows = prodData[uid] || [];
      for (const row of rows) {
        if (!dateMap[row.Date]) {
          dateMap[row.Date] = { Date: row.Date, sumOilRate: 0, sumLiqRate: 0, sumWaterRate: 0, sumQgas: 0, sumQoil: 0, sumQwater: 0, sumQliq: 0 };
        }
        const d = dateMap[row.Date];
        d.sumOilRate += row.OilRate || 0;
        d.sumLiqRate += row.LiqRate || 0;
        d.sumWaterRate += row.WaterRate || 0;
        d.sumQgas += row.Qgas || 0;
        d.sumQoil += row.Qoil || 0;
        d.sumQwater += row.Qwater || 0;
        d.sumQliq += row.Qliq || 0;
      }
    }
    return Object.values(dateMap)
      .sort((a, b) => a.Date.localeCompare(b.Date))
      .map((d) => ({
        Date: d.Date,
        OilRate: Math.round(d.sumOilRate * 100) / 100,
        LiqRate: Math.round(d.sumLiqRate * 100) / 100,
        WaterRate: Math.round(d.sumWaterRate * 100) / 100,
        Qoil: Math.round(d.sumQoil * 1000) / 1000,
        Qgas: Math.round(d.sumQgas * 1000) / 1000,
        Qwater: Math.round(d.sumQwater * 1000) / 1000,
        Qliq: Math.round(d.sumQliq * 1000) / 1000,
        GOR: d.sumQoil > 0 ? 1000*d.sumQgas / d.sumQoil : 0,
        WC: d.sumLiqRate > 0 ? Math.max(100 * d.sumWaterRate / d.sumLiqRate, 0.1) : null,
      }));
  };

  const aggregatedData = buildAggregatedData();
  const chartTitle = selectedIds.length === 1
    ? selectedIds[0]
    : `Aggregate (${selectedIds.length} wells)`;

  return (
    <div className="page-layout">
      <aside className="sidebar">
        <div className="sidebar-section">
          <h3>Field</h3>
          <select value={field} onChange={(e) => { setField(e.target.value); setReservoir(""); setPlatform(""); setSelectedIds([]); }}>
            <option value="">All Fields</option>
            {filters.fields.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div className="sidebar-section">
          <h3>Reservoir</h3>
          <select value={reservoir} onChange={(e) => { setReservoir(e.target.value); setPlatform(""); setSelectedIds([]); }}>
            <option value="">All Reservoirs</option>
            {filters.reservoirs.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="sidebar-section">
          <h3>Platform</h3>
          <select value={platform} onChange={(e) => { setPlatform(e.target.value); setSelectedIds([]); }}>
            <option value="">All Platforms</option>
            {filters.platforms.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="well-list">
          <div className="well-list-header">Wells ({filters.unique_ids.length})</div>
          {filters.unique_ids.map((uid) => (
            <div key={uid} className={`well-item ${selectedIds.includes(uid) ? "selected" : ""}`}
              onClick={() => toggleId(uid)}>
              <input type="checkbox" className="well-item-checkbox"
                checked={selectedIds.includes(uid)} onChange={() => {}} />
              {uid}
            </div>
          ))}
        </div>
      </aside>
      <div className="content-area">
        {/* Year selector + bar charts */}
        <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <label style={{ fontWeight: 600 }}>Year:</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            style={{ padding: "4px 8px", fontSize: 14 }}
          >
            {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
          {/* Oil Production by Field */}
          <div className="spm" style={{ flex: 1, minWidth: 400 }}>
            <div className="spm-header">
              <span className="spm-header-title">
                <span className="spm-header-icon">⠿</span> Oil Production by Field — {selectedYear}
              </span>
            </div>
            <div className="spm-plot">
              {summaryByField.length === 0 ? (
                <div className="spm-empty" style={{ height: 300 }}>No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={summaryByField} margin={{ top: 16, right: 16, bottom: 60, left: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 11 }} label={{ value: "Oil Production (t)", angle: -90, position: "insideLeft", style: { fontSize: 11, textAnchor: "middle" } }} />
                    <Tooltip formatter={(v) => [typeof v === "number" ? v.toLocaleString() : v, "Oil (t)"]} />
                    <Bar dataKey="oil" name="Oil Production">
                      {summaryByField.map((_, i) => (
                        <Cell key={i} fill={FIELD_COLORS[i % FIELD_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Oil Production by Platform */}
          <div className="spm" style={{ flex: 1, minWidth: 400 }}>
            <div className="spm-header">
              <span className="spm-header-title">
                <span className="spm-header-icon">⠿</span> Oil Production by Platform — {selectedYear}
              </span>
            </div>
            <div className="spm-plot">
              {summaryByPlatform.length === 0 ? (
                <div className="spm-empty" style={{ height: 300 }}>No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={summaryByPlatform} margin={{ top: 16, right: 16, bottom: 60, left: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 11 }} label={{ value: "Oil Production (t)", angle: -90, position: "insideLeft", style: { fontSize: 11, textAnchor: "middle" } }} />
                    <Tooltip formatter={(v) => [typeof v === "number" ? v.toLocaleString() : v, "Oil (t)"]} />
                    <Bar dataKey="oil" name="Oil Production">
                      {summaryByPlatform.map((_, i) => (
                        <Cell key={i} fill={FIELD_COLORS[i % FIELD_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Aggregated well production chart */}
        {loading ? (
          <div className="loading">Loading production data...</div>
        ) : selectedIds.length === 0 ? (
          <div className="loading">Select wells from the sidebar to view production chart</div>
        ) : (
          <ProductionChartModule
            title={chartTitle}
            data={aggregatedData}
            storageKey="prod_chart_aggregate"
          />
        )}
      </div>
    </div>
  );
}

export default ProductionPage;
