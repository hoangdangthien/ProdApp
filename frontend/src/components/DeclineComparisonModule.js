import React, { useState, useEffect, useRef, useCallback } from "react";
import { getDeclineOptions, getDeclineComparison } from "../api";
import DeclineChart from "./DeclineChart";
import { useHorizontalSplit } from "./useResizable";

/*
 * DeclineComparisonModule
 * -----------------------
 * Two side-by-side editable + resizable line charts comparing the Council Plan
 * vs Actual decline (%) of oil rate and liquid rate (Actual excludes the WIT
 * increment), for a chosen year. Filters by Year / Region (RegionNIRII1) /
 * Field / Reservoir / Platform / Completion / Element number. All decline maths
 * run server-side (vectorized); fetched results are cached client-side keyed by
 * the filter+year combination.
 */

const selectStyle = { padding: "4px 8px", fontSize: 13 };
const labelStyle = { fontWeight: 600, fontSize: 13 };

function DeclineComparisonModule({ year, availableYears = [] }) {
  const [options, setOptions] = useState({
    regions: [], fields: [], reservoirs: [], platforms: [], completions: [], element_numbers: [],
  });
  // The module owns its own year selection, seeded from the page-level year.
  const [selectedYear, setSelectedYear] = useState(year || "");
  const [region, setRegion] = useState("");
  const [field, setField] = useState("");
  const [reservoir, setReservoir] = useState("");
  const [platform, setPlatform] = useState("");
  const [completion, setCompletion] = useState("");
  const [elementNumber, setElementNumber] = useState("");

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const split = useHorizontalSplit({ initialFlex: 1 });
  const cacheRef = useRef(new Map());

  // Adopt the page-level year once it resolves, until the user picks their own.
  useEffect(() => {
    if (year && !selectedYear) setSelectedYear(year);
  }, [year, selectedYear]);

  // Cascading filter options — re-fetched as the upper selections change.
  useEffect(() => {
    getDeclineOptions({ region, field, reservoir, platform })
      .then((res) => setOptions(res.data))
      .catch(() => {});
  }, [region, field, reservoir, platform]);

  const fetchData = useCallback(() => {
    if (!selectedYear) { setData([]); return; }
    const params = { year: selectedYear };
    if (region) params.region = region;
    if (field) params.field = field;
    if (reservoir) params.reservoir = reservoir;
    if (platform) params.platform = platform;
    if (completion) params.completion = completion;
    if (elementNumber) params.element_number = elementNumber;

    const cacheKey = JSON.stringify(params);
    if (cacheRef.current.has(cacheKey)) {
      setData(cacheRef.current.get(cacheKey));
      return;
    }
    setLoading(true);
    getDeclineComparison(params)
      .then((res) => {
        const rows = res.data.data || [];
        cacheRef.current.set(cacheKey, rows);
        setData(rows);
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [selectedYear, region, field, reservoir, platform, completion, elementNumber]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const yearLabel = selectedYear ? ` — ${selectedYear}` : "";

  return (
    <div className="chart-card" style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", gap: 12, padding: "8px 16px", alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ ...labelStyle, fontSize: 15 }}>Oil &amp; Liquid Rate Decline — Council Plan vs Actual</span>
      </div>
      <div style={{ display: "flex", gap: 12, padding: "0 16px 8px", alignItems: "center", flexWrap: "wrap" }}>
        <label style={labelStyle}>Year:</label>
        <select value={selectedYear} style={selectStyle}
          onChange={(e) => setSelectedYear(e.target.value ? Number(e.target.value) : "")}>
          {availableYears.length === 0 && selectedYear && <option value={selectedYear}>{selectedYear}</option>}
          {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>

        <label style={labelStyle}>Field:</label>
        <select value={field} style={selectStyle}
          onChange={(e) => { setField(e.target.value); setReservoir(""); setPlatform(""); setCompletion(""); setElementNumber(""); }}>
          <option value="">All</option>
          {options.fields.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>

        <label style={labelStyle}>Region:</label>
        <select value={region} style={selectStyle}
          onChange={(e) => { setRegion(e.target.value); setReservoir(""); setPlatform(""); setCompletion(""); setElementNumber(""); }}>
          <option value="">All</option>
          {(options.regions || []).map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        
        <label style={labelStyle}>Reservoir:</label>
        <select value={reservoir} style={selectStyle}
          onChange={(e) => { setReservoir(e.target.value); setPlatform(""); setCompletion(""); setElementNumber(""); }}>
          <option value="">All</option>
          {options.reservoirs.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>

        <label style={labelStyle}>Platform:</label>
        <select value={platform} style={selectStyle}
          onChange={(e) => { setPlatform(e.target.value); setCompletion(""); setElementNumber(""); }}>
          <option value="">All</option>
          {options.platforms.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        <label style={labelStyle}>Completion:</label>
        <select value={completion} style={selectStyle} onChange={(e) => setCompletion(e.target.value)}>
          <option value="">All</option>
          {options.completions.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <label style={labelStyle}>Element #:</label>
        <select value={elementNumber} style={selectStyle} onChange={(e) => setElementNumber(e.target.value)}>
          <option value="">All</option>
          {options.element_numbers.map((en) => <option key={en} value={en}>{en}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="loading">Loading decline data...</div>
      ) : (
        <div className="charts-row" style={{ alignItems: "flex-start" }} ref={split.rowRef}>
          <div
            ref={split.leftRef}
            className="chart-card charts-row-item"
            style={{ overflow: "visible", position: "relative", zIndex: 1, ...split.leftStyle }}
          >
            <DeclineChart
              title={`Oil Rate Decline${yearLabel}`}
              data={data}
              councilKey="OilCouncil"
              actualKey="OilActual"
              defaultTitle="Oil rate decline (%)"
              storageKey="decline_oil_chart"
              onHorizontalResize={split.onResize}
              excludeDirections={["w", "nw", "sw"]}
            />
          </div>
          <div className="chart-card charts-row-item" style={{ overflow: "visible", flex: "1 1 0", minWidth: 0 }}>
            <DeclineChart
              title={`Liquid Rate Decline${yearLabel}`}
              data={data}
              councilKey="LiqCouncil"
              actualKey="LiqActual"
              defaultTitle="Liquid rate decline (%)"
              storageKey="decline_liq_chart"
              onHorizontalResize={split.onResize}
              excludeDirections={["e", "ne", "se"]}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default DeclineComparisonModule;
