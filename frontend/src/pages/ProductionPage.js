import React, { useState, useEffect, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area,
} from "recharts";
import { getCascadingFilters, getProductionMulti } from "../api";

const COLORS = [
  "#1976d2", "#d32f2f", "#388e3c", "#f57c00", "#7b1fa2",
  "#00838f", "#c62828", "#2e7d32", "#ef6c00", "#6a1b9a",
];

function ProductionPage() {
  const [filters, setFilters] = useState({ fields: [], reservoirs: [], platforms: [], unique_ids: [] });
  const [field, setField] = useState("");
  const [reservoir, setReservoir] = useState("");
  const [platform, setPlatform] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [prodData, setProdData] = useState({});
  const [loading, setLoading] = useState(false);

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

  const buildChartData = (key) => {
    const dateMap = {};
    for (const uid of selectedIds) {
      const rows = prodData[uid] || [];
      for (const row of rows) {
        if (!dateMap[row.Date]) dateMap[row.Date] = { Date: row.Date };
        dateMap[row.Date][uid] = row[key];
      }
    }
    return Object.values(dateMap).sort((a, b) => a.Date.localeCompare(b.Date));
  };

  const buildCumulativeData = (key) => {
    const dateMap = {};
    for (const uid of selectedIds) {
      const rows = prodData[uid] || [];
      let cum = 0;
      for (const row of rows) {
        cum += row[key] || 0;
        if (!dateMap[row.Date]) dateMap[row.Date] = { Date: row.Date };
        dateMap[row.Date][uid] = cum;
      }
    }
    return Object.values(dateMap).sort((a, b) => a.Date.localeCompare(b.Date));
  };

  const renderChart = (title, data, type) => (
    <div className="chart-card">
      <h3>{title}</h3>
      {data.length === 0 ? (
        <div className="empty-state">No data</div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          {type === "area" ? (
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="Date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              {selectedIds.map((uid, i) => (
                <Area key={uid} type="monotone" dataKey={uid} stroke={COLORS[i % COLORS.length]}
                  fill={COLORS[i % COLORS.length]} fillOpacity={0.1} dot={false} />
              ))}
            </AreaChart>
          ) : (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="Date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              {selectedIds.map((uid, i) => (
                <Line key={uid} type="monotone" dataKey={uid} stroke={COLORS[i % COLORS.length]}
                  dot={false} strokeWidth={1.5} />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      )}
    </div>
  );

  const oilRateData = buildChartData("OilRate");
  const liqRateData = buildChartData("LiqRate");
  const gorData = buildChartData("GOR");
  const cumOilData = buildCumulativeData("Qoil");
  const cumLiqData = buildCumulativeData("Qliq");

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
        {loading ? (
          <div className="loading">Loading production data...</div>
        ) : selectedIds.length === 0 ? (
          <div className="loading">Select wells from the sidebar to view production charts</div>
        ) : (
          <div className="charts-grid">
            {renderChart("Oil Rate (t/d)", oilRateData, "line")}
            {renderChart("Liquid Rate (t/d)", liqRateData, "line")}
            {renderChart("GOR (m³/t)", gorData, "line")}
            {renderChart("Cumulative Oil (t)", cumOilData, "area")}
            {renderChart("Cumulative Liquid (t)", cumLiqData, "area")}
          </div>
        )}
      </div>
    </div>
  );
}

export default ProductionPage;
