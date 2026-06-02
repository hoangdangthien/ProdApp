import React, { useState, useEffect, useCallback } from "react";
import {
  getYearlySummary, getDashboardOptions, getHierarchyBreakdown, getKpiSummary,
} from "../api";
import ProductionBarChart from "../components/ProductionBarChart";
import PieChartCard from "../components/PieChartCard";
import KpiScorecard from "../components/KpiScorecard";
import ReservoirChartModule from "../components/ReservoirChartModule";
import DeclineComparisonModule from "../components/DeclineComparisonModule";
import { useHorizontalSplit } from "../components/useResizable";

// Consistent colors for known fields / reservoirs; fallback palette otherwise.
const NAME_COLOR_MAP = {
  "Bach Ho": "#2e7d32", "Dai Hung": "#1976d2", "Rong": "#e65100",
  "Basement": "#d32f2f", "Mio-Lower": "#1976d2", "Mio-Upper": "#00838f", "Oligocene": "#6a1b9a",
};
const FALLBACK_COLORS = [
  "#c62828", "#ef6c00", "#283593", "#00695c", "#ad1457",
  "#f57c00", "#0288d1", "#388e3c", "#7b1fa2", "#00acc1",
];
const colorFor = (name, i) => NAME_COLOR_MAP[name] || FALLBACK_COLORS[i % FALLBACK_COLORS.length];

// tonnes → kilotonnes (÷1000), one decimal.
const toKt = (v) => Math.round((Number(v) || 0) / 1000 * 10) / 10;
const fmtKt = (v) => (typeof v === "number" ? v.toFixed(1) : v);

const LEVELS = [
  { key: "block", label: "Block" },
  { key: "field", label: "Field" },
  { key: "reservoir", label: "Reservoir" },
  { key: "platform", label: "Platform" },
];

const selectStyle = { padding: "4px 8px", fontSize: 13 };
const labelStyle = { fontWeight: 600, fontSize: 13 };

function DashboardPage() {
  const [availableYears, setAvailableYears] = useState([]);
  const [year, setYear] = useState("");

  const [options, setOptions] = useState({ blocks: [], fields: [], reservoirs: [], platforms: [] });
  const [block, setBlock] = useState("");
  const [field, setField] = useState("");
  const [reservoir, setReservoir] = useState("");
  const [platform, setPlatform] = useState("");
  const [level, setLevel] = useState("field");

  const [breakdown, setBreakdown] = useState(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);

  const [kpi, setKpi] = useState(null);
  const [kpiLoading, setKpiLoading] = useState(false);

  const split = useHorizontalSplit({ initialFlex: 1.6 });

  const scopeParams = useCallback(() => {
    const p = {};
    if (block) p.block = block;
    if (field) p.field = field;
    if (reservoir) p.reservoir = reservoir;
    if (platform) p.platform = platform;
    return p;
  }, [block, field, reservoir, platform]);

  const scopeLabel =
    [block, field, reservoir, platform].filter(Boolean).join(" / ") || "All wells";

  // Resolve available years once.
  useEffect(() => {
    getYearlySummary(new Date().getFullYear())
      .then((res) => {
        const years = res.data.available_years || [];
        setAvailableYears(years);
        setYear(years.length > 0 ? years[0] : new Date().getFullYear());
      })
      .catch(() => {});
  }, []);

  // Cross-filtering scope options.
  useEffect(() => {
    getDashboardOptions(scopeParams())
      .then((res) => setOptions(res.data))
      .catch(() => {});
  }, [scopeParams]);

  // Hierarchy breakdown for the chosen level + scope.
  useEffect(() => {
    if (!year) return;
    setBreakdownLoading(true);
    getHierarchyBreakdown({ year, level, ...scopeParams() })
      .then((res) => setBreakdown(res.data))
      .catch(() => setBreakdown(null))
      .finally(() => setBreakdownLoading(false));
  }, [year, level, scopeParams]);

  // KPI scorecard + indicator series for the scope.
  useEffect(() => {
    if (!year) return;
    setKpiLoading(true);
    getKpiSummary({ year, ...scopeParams() })
      .then((res) => setKpi(res.data))
      .catch(() => setKpi(null))
      .finally(() => setKpiLoading(false));
  }, [year, scopeParams]);

  // Build bar + pie data from the breakdown response.
  const children = breakdown?.children || [];
  const barData = children.length > 0
    ? [
        ...children.map((c) => ({
          name: c.name,
          oil: toKt(c.oil),
          council_plan_final: toKt(c.council_plan_final || 0),
          type: "child",
        })),
        {
          name: `${scopeLabel} (Total)`,
          oil: toKt(breakdown.total),
          council_plan_final: toKt(breakdown.council_plan_final || 0),
          type: "total",
        },
      ]
    : [];
  const pieData = children.map((c, i) => ({
    name: c.name, value: toKt(c.oil), fill: colorFor(c.name, i),
  }));
  const totalOilKt = breakdown ? toKt(breakdown.total) : 0;
  const levelLabel = LEVELS.find((l) => l.key === level)?.label || level;

  const resetBelow = (changed) => {
    if (changed === "block") { setReservoir(""); setPlatform(""); }
  };

  return (
    <div className="content-area" style={{ padding: 16 }}>
      <h2 style={{ margin: "0 0 12px" }}>Field Performance Overview</h2>

      {/* Scope picker */}
      <div style={{
        display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap",
        padding: "12px 14px", background: "#fafafa", border: "1px solid #eee",
        borderRadius: 6, marginBottom: 20,
      }}>
        <label style={labelStyle}>Year:</label>
        <select value={year} style={selectStyle} onChange={(e) => setYear(Number(e.target.value))}>
          {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>

        <span style={{ width: 1, height: 22, background: "#ddd" }} />

        <label style={labelStyle}>Block:</label>
        <select value={block} style={selectStyle}
          onChange={(e) => { setBlock(e.target.value); resetBelow("block"); }}>
          <option value="">All</option>
          {options.blocks.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>

        <label style={labelStyle}>Field:</label>
        <select value={field} style={selectStyle} onChange={(e) => setField(e.target.value)}>
          <option value="">All</option>
          {options.fields.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>

        <label style={labelStyle}>Reservoir:</label>
        <select value={reservoir} style={selectStyle} onChange={(e) => setReservoir(e.target.value)}>
          <option value="">All</option>
          {options.reservoirs.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>

        <label style={labelStyle}>Platform:</label>
        <select value={platform} style={selectStyle} onChange={(e) => setPlatform(e.target.value)}>
          <option value="">All</option>
          {options.platforms.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        {(block || field || reservoir || platform) && (
          <button
            onClick={() => { setBlock(""); setField(""); setReservoir(""); setPlatform(""); }}
            style={{ ...selectStyle, cursor: "pointer", border: "1px solid #ccc", background: "#fff", borderRadius: 4 }}
          >
            Reset scope
          </button>
        )}
      </div>

      {/* 1. KPI scorecard */}
      <KpiScorecard scorecard={kpi?.scorecard} loading={kpiLoading} />

      {/* 2. Plan vs Actual + Share */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
        <span style={{ ...labelStyle, fontSize: 15 }}>Monitoring vs Plan — break down by:</span>
        <select value={level} style={selectStyle} onChange={(e) => setLevel(e.target.value)}>
          {LEVELS.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
        </select>
      </div>

      {breakdownLoading ? (
        <div className="loading">Loading breakdown...</div>
      ) : (
        <div className="charts-row" style={{ alignItems: "flex-start" }} ref={split.rowRef}>
          <div
            ref={split.leftRef}
            className="chart-card charts-row-item"
            style={{ overflow: "visible", position: "relative", zIndex: 1, ...split.leftStyle }}
          >
            <ProductionBarChart
              title={`Qoil by ${levelLabel} — ${year}`}
              data={barData}
              compareKey="council_plan_final"
              yLabel="Sản lượng dầu (ngàn tấn)"
              tooltipLabel="Thực tế (ngàn tấn)"
              compareLabel="Kế hoạch (ngàn tấn)"
              barLabelFormatter={fmtKt}
              cellColorFn={(entry, i, isCompare) =>
                entry.type === "total" ? (isCompare ? "#78909c" : "#37474f") : colorFor(entry.name, i)
              }
              excludeDirections={["w", "nw", "sw"]}
              onHorizontalResize={split.onResize}
            />
          </div>
          <div className="chart-card charts-row-item" style={{ overflow: "visible", flex: "1 1 0", minWidth: 0 }}>
            <PieChartCard
              title={`${levelLabel} Share — ${scopeLabel} (${year})`}
              pieData={pieData}
              totalValue={totalOilKt}
              tooltipLabel="Sản lượng dầu"
              excludeDirections={["e", "ne", "se"]}
              onHorizontalResize={split.onResize}
            />
          </div>
        </div>
      )}

      {/* 3. Oil & Liquid rate decline — Council Plan vs Actual */}
      <DeclineComparisonModule year={year} availableYears={availableYears} />

      {/* 4. Performance indicators for the scope */}
      <div className="chart-card" style={{ marginBottom: 24 }}>
        <ReservoirChartModule
          title={`Performance Indicators — ${scopeLabel}`}
          scopeMode
          scopeLabel={scopeLabel}
          data={kpi?.series || []}
          loading={kpiLoading}
        />
      </div>
    </div>
  );
}

export default DashboardPage;
