import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  PieChart, Pie, Legend, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { getCascadingFilters, getProductionMulti, getYearlySummary, getReservoirSummary, getFieldReservoirBreakdown, getBlockFieldBreakdown } from "../api";
import ProductionChartModule from "../components/ProductionChartModule";
import ReservoirChartModule from "../components/ReservoirChartModule";
import ProductionBarChart, { getChartWidth, downloadChartAsPng } from "../components/ProductionBarChart";

// ── Field color dictionary (line 11) ──
const FIELD_COLOR_MAP = {
  "Bach Ho":   "#2e7d32",
  "Dai Hung":  "#1976d2",
  "Rong":      "#e65100",
};

// ── Reservoir color dictionary (line 17) ──
const RESERVOIR_COLOR_MAP = {
  "Basement":  "#d32f2f",
  "Mio-Lower": "#1976d2",
  "Mio-Upper": "#00838f",
  "Oligocene": "#6a1b9a",
};

const FALLBACK_COLORS = [
  "#c62828", "#ef6c00", "#283593", "#00695c", "#ad1457",
  "#f57c00", "#0288d1", "#388e3c", "#7b1fa2", "#00acc1",
];

function getFieldColor(name, index) {
  return FIELD_COLOR_MAP[name] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

function getReservoirColor(name, index) {
  return RESERVOIR_COLOR_MAP[name] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

function PieChartCard({ title, pieData, totalValue, tooltipLabel }) {
  const plotRef = useRef(null);
  const handleDownload = useCallback(() => {
    const svg = plotRef.current?.querySelector("svg");
    const safeName = title.replace(/[^a-zA-Z0-9]/g, "_") + ".png";
    downloadChartAsPng(svg, safeName);
  }, [title]);

  return (
    <div className="spm" style={{ width: 500 }}>
      <div className="spm-header">
        <span className="spm-header-title">
          <span className="spm-header-icon">⠿</span> {title}
        </span>
        {pieData.length > 0 && (
          <button
            onClick={handleDownload}
            title="Download as PNG"
            style={{
              background: "#1976d2", border: "none", borderRadius: 4,
              padding: "4px 10px", cursor: "pointer", fontSize: 12, color: "#fff",
              fontWeight: 600, display: "flex", alignItems: "center", gap: 4,
            }}
          >
            PNG
          </button>
        )}
      </div>
      <div className="spm-plot" ref={plotRef}>
        {pieData.length === 0 ? (
          <div className="spm-empty" style={{ height: 300 }}>No data</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={110}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                labelLine={{ strokeWidth: 1 }}
                fontSize={12}
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => [`${v.toLocaleString()} t (${totalValue > 0 ? ((v / totalValue) * 100).toFixed(1) : 0}%)`, tooltipLabel]} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

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

  const [fieldBreakdown, setFieldBreakdown] = useState([]);
  const [selectedBreakdownField, setSelectedBreakdownField] = useState("");

  const [blockBreakdown, setBlockBreakdown] = useState([]);
  const [selectedBlock, setSelectedBlock] = useState("");

  const [resField, setResField] = useState("");
  const [resReservoir, setResReservoir] = useState("");
  const [reservoirData, setReservoirData] = useState([]);
  const [reservoirLoading, setReservoirLoading] = useState(false);

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
    if (!selectedYear) return;
    getFieldReservoirBreakdown(selectedYear).then((res) => {
      setFieldBreakdown(res.data);
      if (res.data.length > 0 && !selectedBreakdownField) {
        setSelectedBreakdownField(res.data[0].field);
      }
    }).catch(() => {});
  }, [selectedYear]);

  useEffect(() => {
    if (!selectedYear) return;
    getBlockFieldBreakdown(selectedYear).then((res) => {
      setBlockBreakdown(res.data);
      if (res.data.length > 0 && !selectedBlock) {
        setSelectedBlock(res.data[0].block);
      }
    }).catch(() => {});
  }, [selectedYear]);

  useEffect(() => {
    if (selectedIds.length === 0) { setProdData({}); return; }
    setLoading(true);
    getProductionMulti(selectedIds)
      .then((res) => setProdData(res.data))
      .finally(() => setLoading(false));
  }, [selectedIds]);

  useEffect(() => {
    if (!resField || !resReservoir) { setReservoirData([]); return; }
    setReservoirLoading(true);
    getReservoirSummary(resField, resReservoir)
      .then((res) => setReservoirData(res.data))
      .finally(() => setReservoirLoading(false));
  }, [resField, resReservoir]);

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

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24, justifyContent: "center" }}>
          {/* Oil Production by Field */}
          <div style={{ width: getChartWidth(summaryByField.length) }}>
            <ProductionBarChart
              title={`Oil Production by Field — ${selectedYear}`}
              data={summaryByField}
              cellColorFn={(entry, i) => getFieldColor(entry.name, i)}
            />
          </div>

          {/* Oil Production by Platform */}
          <div style={{ width: getChartWidth(summaryByPlatform.length) }}>
            <ProductionBarChart
              title={`Oil Production by Platform — ${selectedYear}`}
              data={summaryByPlatform}
              cellColorFn={(entry, i) => getFieldColor(entry.name, i)}
            />
          </div>
        </div>

        {/* Field-Reservoir Qoil Breakdown */}
        {fieldBreakdown.length > 0 && (() => {
          const selectedData = fieldBreakdown.find((f) => f.field === selectedBreakdownField);
          const barData = selectedData
            ? [...selectedData.reservoirs.map((r) => ({
                name: r.name, oil: r.oil,
                council_plan_final: r.council_plan_final || 0,
                type: "reservoir",
              })),
               {
                name: `${selectedData.field} (Total)`, oil: selectedData.total,
                council_plan_final: selectedData.council_plan_final || 0,
                type: "total",
               }]
            : [];
          const pieData = selectedData
            ? selectedData.reservoirs.map((r, i) => ({
                name: r.name,
                value: r.oil,
                fill: getReservoirColor(r.name, i),
              }))
            : [];
          const totalOil = selectedData ? selectedData.total : 0;

          return (
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24, justifyContent: "center" }}>
              <div style={{ width: getChartWidth(barData.length, true) }}>
                <ProductionBarChart
                  title={`Qoil by Reservoir in Field — ${selectedYear}`}
                  data={barData}
                  compareKey="council_plan_final"
                  yLabel="Qoil (t)"
                  tooltipLabel="Thực tế (t)"
                  compareLabel="Kế hoạch (t)"
                  cellColorFn={(entry, i, isCompare) =>
                    entry.type === "total" ? (isCompare ? "#78909c" : "#37474f") : getReservoirColor(entry.name, i)
                  }
                  headerRight={
                    <select
                      value={selectedBreakdownField}
                      onChange={(e) => setSelectedBreakdownField(e.target.value)}
                      style={{ marginLeft: 12, padding: "3px 8px", fontSize: 13 }}
                    >
                      {fieldBreakdown.map((f) => (
                        <option key={f.field} value={f.field}>{f.field}</option>
                      ))}
                    </select>
                  }
                />
              </div>

              <PieChartCard
                title={`Reservoir Share — ${selectedBreakdownField} (${selectedYear})`}
                pieData={pieData}
                totalValue={totalOil}
                tooltipLabel="Qoil"
              />
            </div>
          );
        })()}

        {/* Block-Field Qoil Breakdown */}
        {blockBreakdown.length > 0 && (() => {
          const selectedData = blockBreakdown.find((b) => b.block === selectedBlock);
          const blockBarData = selectedData
            ? [...selectedData.fields.map((f) => ({
                name: f.name, oil: f.oil,
                council_plan_final: f.council_plan_final || 0,
                type: "field",
              })),
               {
                name: `${selectedData.block} (Total)`, oil: selectedData.total,
                council_plan_final: selectedData.council_plan_final || 0,
                type: "total",
               }]
            : [];
          const blockPieData = selectedData
            ? selectedData.fields.map((f, i) => ({
                name: f.name,
                value: f.oil,
                fill: getFieldColor(f.name, i),
              }))
            : [];
          const blockTotalOil = selectedData ? selectedData.total : 0;

          return (
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24, justifyContent: "center" }}>
              <div style={{ width: getChartWidth(blockBarData.length, true) }}>
                <ProductionBarChart
                  title={`Qoil by Field in Block — ${selectedYear}`}
                  data={blockBarData}
                  compareKey="council_plan_final"
                  yLabel="Qoil (t)"
                  tooltipLabel="Thực tế (t)"
                  compareLabel="Kế hoạch (t)"
                  cellColorFn={(entry, i, isCompare) =>
                    entry.type === "total" ? (isCompare ? "#78909c" : "#37474f") : getFieldColor(entry.name, i)
                  }
                  headerRight={
                    <select
                      value={selectedBlock}
                      onChange={(e) => setSelectedBlock(e.target.value)}
                      style={{ marginLeft: 12, padding: "3px 8px", fontSize: 13 }}
                    >
                      {blockBreakdown.map((b) => (
                        <option key={b.block} value={b.block}>{b.block}</option>
                      ))}
                    </select>
                  }
                />
              </div>

              <PieChartCard
                title={`Field Share — ${selectedBlock} (${selectedYear})`}
                pieData={blockPieData}
                totalValue={blockTotalOil}
                tooltipLabel="Qoil"
              />
            </div>
          );
        })()}

        {/* Reservoir-level chart with VRR */}
        <ReservoirChartModule
          fields={filters.fields}
          reservoirs={filters.reservoirs}
          resField={resField}
          resReservoir={resReservoir}
          onFieldChange={(v) => { setResField(v); setResReservoir(""); }}
          onReservoirChange={setResReservoir}
          data={reservoirData}
          loading={reservoirLoading}
          allFilters={filters}
        />

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
