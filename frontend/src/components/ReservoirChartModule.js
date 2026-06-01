import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, LabelList,
} from "recharts";
import { getCascadingFilters } from "../api";
import "./ScatterPlotModule.css";
import { downloadChartAsPng, DownloadPngButton } from "./chartDownload";
import EditableLabel from "./EditableLabel";
import EditableValueLabel from "./EditableValueLabel";
import useResizable, { ResizeHandles } from "./useResizable";

const FONT = "Arial, sans-serif";

const COLORS = {
  OilRate: "#2e7d32",
  GOR: "#d32f2f",
  WC: "#1976d2",
  VRR: "#7b1fa2",
};

function ReservoirChartModule({ fields, resField, resReservoir, onFieldChange, onReservoirChange, data, loading }) {
  const { size, style, containerRef, onResize } = useResizable(380);
  const [filteredReservoirs, setFilteredReservoirs] = useState([]);
  const [legendLabels, setLegendLabels] = useState({
    OilRate: "Sản lượng dầu",
    GOR: "Tỉ số khí dầu",
    WC: "Độ ngập nước",
    VRR: "Hệ số bù khai thác",
  });
  const [showDataLabels, setShowDataLabels] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [axisTitleSize, setAxisTitleSize] = useState(11);
  const [axisLabelSize, setAxisLabelSize] = useState(11);
  const [valueOverrides, setValueOverrides] = useState({});
  const handleValueOverride = useCallback((seriesKey) => (index, val) => {
    setValueOverrides((prev) => ({ ...prev, [seriesKey]: { ...(prev[seriesKey] || {}), [index]: val } }));
  }, []);
  const chartRef = useRef(null);

  const handleLegendChange = useCallback((key, val) => {
    setLegendLabels((prev) => ({ ...prev, [key]: val }));
  }, []);

  const handleDownload = useCallback(() => {
    downloadChartAsPng(chartRef.current, "Reservoir_Production_VRR.png");
  }, []);

  useEffect(() => {
    if (!resField) { setFilteredReservoirs([]); return; }
    getCascadingFilters({ field: resField }).then((res) => {
      setFilteredReservoirs(res.data.reservoirs || []);
    }).catch(() => {});
  }, [resField]);

  return (
    <div className="spm" ref={containerRef} style={{ ...style, marginBottom: 24 }}>
      <div className="spm-header">
        <span className="spm-header-title">
          Reservoir Production &amp; VRR
        </span>
        {data.length > 0 && resField && resReservoir && <DownloadPngButton onClick={handleDownload} />}
      </div>
      <div
        className={`spm-edit-tab ${inspectorOpen ? "active" : ""}`}
        onClick={() => setInspectorOpen((o) => !o)}
      >
        Edit
      </div>
      <div style={{ display: "flex", gap: 12, padding: "8px 16px", alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ fontWeight: 600, fontSize: 13 }}>Field:</label>
        <select value={resField} onChange={(e) => onFieldChange(e.target.value)} style={{ padding: "4px 8px", fontSize: 13 }}>
          <option value="">-- Select Field --</option>
          {fields.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <label style={{ fontWeight: 600, fontSize: 13 }}>Reservoir:</label>
        <select value={resReservoir} onChange={(e) => onReservoirChange(e.target.value)} style={{ padding: "4px 8px", fontSize: 13 }} disabled={!resField}>
          <option value="">-- Select Reservoir --</option>
          {filteredReservoirs.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div className="spm-plot spm-plot-fill" ref={chartRef}>
        {loading ? (
          <div className="spm-empty" style={{ height: size.height }}>Loading...</div>
        ) : !resField || !resReservoir ? (
          <div className="spm-empty" style={{ height: size.height }}>Select a Field and Reservoir to view chart</div>
        ) : data.length === 0 ? (
          <div className="spm-empty" style={{ height: size.height }}>No data</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 16, right: 24, bottom: 24, left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="Date" tick={{ fontSize: axisLabelSize, fontFamily: FONT, fill: "#000" }} minTickGap={24} />

              <YAxis
                yAxisId="qoil"
                orientation="left"
                tick={{ fontSize: axisLabelSize, fontFamily: FONT, fill: "#000" }}
                label={{ value: "OilRate (t)", angle: -90, position: "insideLeft", style: { fontSize: axisTitleSize, fontFamily: FONT, fill: "#000", textAnchor: "middle" } }}
              />
              <YAxis
                yAxisId="gor"
                orientation="right"
                width={60}
                tick={{ fontSize: axisLabelSize, fontFamily: FONT, fill: COLORS.GOR }}
                axisLine={{ stroke: COLORS.GOR }}
                tickLine={{ stroke: COLORS.GOR }}
                label={{ value: "GOR (m³/t)", angle: 90, position: "insideRight", style: { fontSize: axisTitleSize, fontFamily: FONT, textAnchor: "middle", fill: COLORS.GOR } }}
              />
              <YAxis
                yAxisId="wc"
                orientation="right"
                domain={[0, 100]}
                tick={false}
                axisLine={false}
                tickLine={false}
                width={1}
                hide
              />
              <YAxis
                yAxisId="vrr"
                orientation="right"
                tick={{ fontSize: axisLabelSize, fontFamily: FONT, fill: COLORS.VRR }}
                axisLine={{ stroke: COLORS.VRR }}
                tickLine={{ stroke: COLORS.VRR }}
                width={50}
                label={{ value: "VRR", angle: 90, position: "insideRight", style: { fontSize: axisTitleSize, fontFamily: FONT, textAnchor: "middle", fill: COLORS.VRR } }}
              />

              <Tooltip formatter={(value, name) => [typeof value === "number" ? value.toFixed(2) : value, name]} />
              <Legend content={({ payload }) => {
                const order = ["OilRate", "GOR", "WC", "VRR"];
                const sorted = order.map(key => payload.find(p => p.dataKey === key)).filter(Boolean);
                return (
                  <div style={{ display: "flex", justifyContent: "center", gap: 16, fontSize: 12 }}>
                    {sorted.map((entry, i) => (
                      <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 14, height: 3, backgroundColor: entry.color, display: "inline-block", borderRadius: 1 }} />
                        <EditableLabel
                          value={legendLabels[entry.dataKey] || entry.value}
                          onChange={(v) => handleLegendChange(entry.dataKey, v)}
                        />
                      </span>
                    ))}
                  </div>
                );
              }} />

              <Line yAxisId="qoil" type="monotone" dataKey="OilRate" name={legendLabels.OilRate} stroke={COLORS.OilRate} strokeWidth={2} dot={{ r: 2, fill: COLORS.OilRate }}>
                {showDataLabels && <LabelList dataKey="OilRate" position="top" content={(props) => (
                  <EditableValueLabel {...props} fontSize={9} fontWeight={500} formatter={(v) => typeof v === "number" ? v.toFixed(1) : v} overrides={valueOverrides.OilRate} onOverride={handleValueOverride("OilRate")} />
                )} />}
              </Line>
              <Line yAxisId="gor" type="monotone" dataKey="GOR" name={legendLabels.GOR} stroke={COLORS.GOR} strokeWidth={2} dot={{ r: 2, fill: COLORS.GOR }}>
                {showDataLabels && <LabelList dataKey="GOR" position="top" content={(props) => (
                  <EditableValueLabel {...props} fontSize={9} fontWeight={500} formatter={(v) => typeof v === "number" ? v.toFixed(1) : v} overrides={valueOverrides.GOR} onOverride={handleValueOverride("GOR")} />
                )} />}
              </Line>
              <Line yAxisId="wc" type="monotone" dataKey="WC" name={legendLabels.WC} stroke={COLORS.WC} strokeWidth={2} dot={{ r: 2, fill: COLORS.WC }}>
                {showDataLabels && <LabelList dataKey="WC" position="top" content={(props) => (
                  <EditableValueLabel {...props} fontSize={9} fontWeight={500} formatter={(v) => typeof v === "number" ? v.toFixed(1) : v} overrides={valueOverrides.WC} onOverride={handleValueOverride("WC")} />
                )} />}
              </Line>
              <Line yAxisId="vrr" type="monotone" dataKey="VRR" name={legendLabels.VRR} stroke={COLORS.VRR} strokeWidth={2} dot={{ r: 2, fill: COLORS.VRR }} connectNulls>
                {showDataLabels && <LabelList dataKey="VRR" position="top" content={(props) => (
                  <EditableValueLabel {...props} fontSize={9} fontWeight={500} formatter={(v) => typeof v === "number" ? v.toFixed(1) : v} overrides={valueOverrides.VRR} onOverride={handleValueOverride("VRR")} />
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
            <div className="spm-insp-section-title">Axis Title</div>
            <div className="spm-insp-row">
              <label>Title size</label>
              <input
                type="number"
                className="spm-insp-input"
                min={6}
                max={40}
                value={axisTitleSize}
                onChange={(e) => setAxisTitleSize(Number(e.target.value) || 11)}
              />
            </div>
            <div className="spm-insp-row">
              <label>Label size</label>
              <input
                type="number"
                className="spm-insp-input"
                min={6}
                max={40}
                value={axisLabelSize}
                onChange={(e) => setAxisLabelSize(Number(e.target.value) || 11)}
              />
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
          </div>
        </div>
      )}
      <ResizeHandles onResize={onResize} />
    </div>
  );
}

export default ReservoirChartModule;
