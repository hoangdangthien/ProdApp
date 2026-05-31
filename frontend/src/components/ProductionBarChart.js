import React, { useRef, useCallback, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Cell, Legend, ReferenceLine, LabelList,
} from "recharts";
import { downloadChartAsPng, DownloadPngButton } from "./chartDownload";
import EditableLabel from "./EditableLabel";
import EditableValueLabel from "./EditableValueLabel";

const DEFAULT_COLORS = [
  "#2e7d32", "#1976d2", "#e65100", "#6a1b9a", "#00838f",
  "#c62828", "#ef6c00", "#283593", "#00695c", "#ad1457",
  "#f57c00", "#0288d1", "#388e3c", "#7b1fa2", "#00acc1",
];

const BAR_WIDTH = 28;
const BAR_GAP = 100;
const MARGIN = { top: 24, right: 16, bottom: 80, left: 16 };

const MIN_CHART_WIDTH = 450;

function getChartWidth(barCount, grouped = false) {
  const gap = grouped ? BAR_GAP + 20 : BAR_GAP;
  return Math.max(MIN_CHART_WIDTH, barCount * (BAR_WIDTH + gap) + MARGIN.left + MARGIN.right);
}



function EditableXTick({ x, y, payload, nameOverrides, onNameChange }) {
  const original = payload.value;
  const display = nameOverrides[original] ?? original;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(display);

  if (editing) {
    return (
      <foreignObject x={x - 60} y={y + 4} width={120} height={24}>
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => { setEditing(false); onNameChange(original, draft); }}
          onKeyDown={(e) => { if (e.key === "Enter") { setEditing(false); onNameChange(original, draft); } }}
          style={{ fontSize: 10, width: 114, border: "1px solid #999", borderRadius: 2, padding: "0 3px", textAlign: "center" }}
        />
      </foreignObject>
    );
  }

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0} y={0} dy={12}
        textAnchor="end"
        fontSize={11}
        transform="rotate(-35)"
        fill="#666"
        style={{ cursor: "pointer" }}
        onClick={() => { setDraft(display); setEditing(true); }}
      >
        {display}
      </text>
    </g>
  );
}

const GROUPED_COLORS = ["#d32f2f", "#212121"];

function CustomLegend({ payload, labels, onLabelChange }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 20, fontSize: 11, marginBottom: 4 }}>
      {payload.map((entry, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <svg width={14} height={14}>
            <rect x={1} y={1} width={12} height={12}
              fill={GROUPED_COLORS[i] || "#212121"} />
          </svg>
          <EditableLabel
            value={labels[i]}
            onChange={(v) => onLabelChange(i, v)}
          />
        </span>
      ))}
    </div>
  );
}

function ProductionBarChart({
  title,
  data,
  dataKey = "oil",
  compareKey,
  nameKey = "name",
  yLabel = "Oil Production (t)",
  tooltipLabel = "Oil (t)",
  compareLabel = "Council Plan Final (t)",
  colors = DEFAULT_COLORS,
  height = 300,
  cellColorFn,
  headerRight,
  referenceLineY,
  showBarLabels = true,
  barLabelFormatter = (v) => typeof v === "number" ? Math.round(v).toLocaleString() : v,
  barLabelStyle,
  yDomain,
  barRadius = [4, 4, 0, 0],
  tooltipFormatter,
}) {
  const chartRef = useRef(null);
  const grouped = !!compareKey;
  const chartWidth = getChartWidth(data.length, grouped);
  const [legendLabels, setLegendLabels] = useState([tooltipLabel, compareLabel]);
  const handleLabelChange = useCallback((idx, val) => {
    setLegendLabels((prev) => { const next = [...prev]; next[idx] = val; return next; });
  }, []);

  const [nameOverrides, setNameOverrides] = useState({});
  const handleNameChange = useCallback((original, newName) => {
    setNameOverrides((prev) => ({ ...prev, [original]: newName }));
  }, []);

  const [yMin, setYMin] = useState(yDomain && yDomain[0] != null ? String(yDomain[0]) : "");
  const [yMax, setYMax] = useState(yDomain && yDomain[1] != null ? String(yDomain[1]) : "");
  const effYDomain = (yMin !== "" || yMax !== "" || yDomain) ? [
    yMin !== "" ? Number(yMin) : (yDomain && yDomain[0] != null ? yDomain[0] : "auto"),
    yMax !== "" ? Number(yMax) : (yDomain && yDomain[1] != null ? yDomain[1] : "auto"),
  ] : undefined;

  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [editableYLabel, setEditableYLabel] = useState(yLabel);
  const [labelsVisible, setLabelsVisible] = useState(showBarLabels);
  const [valueOverrides, setValueOverrides] = useState({});
  const [compareOverrides, setCompareOverrides] = useState({});
  const handleValueOverride = useCallback((dataKeyName) => (index, val) => {
    if (dataKeyName === "compare") {
      setCompareOverrides((prev) => ({ ...prev, [index]: val }));
    } else {
      setValueOverrides((prev) => ({ ...prev, [index]: val }));
    }
  }, []);

  const handleDownload = useCallback(() => {
    const svg = chartRef.current?.querySelector("svg");
    const safeName = title.replace(/[^a-zA-Z0-9]/g, "_") + ".png";
    downloadChartAsPng(svg, safeName);
  }, [title]);

  return (
    <div className="spm">
      <div className="spm-header">
        <span className="spm-header-title">
          <span className="spm-header-icon">⠿</span> {title}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {headerRight}
          {data.length > 0 && <DownloadPngButton onClick={handleDownload} />}
        </span>
      </div>

      <div
        className={`spm-edit-tab ${inspectorOpen ? "active" : ""}`}
        onClick={() => setInspectorOpen((o) => !o)}
      >
        Edit
      </div>

      <div className="spm-plot" ref={chartRef}>
        {data.length === 0 ? (
          <div className="spm-empty" style={{ height }}>No data</div>
        ) : (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <BarChart
              width={chartWidth}
              height={height}
              data={data}
              margin={MARGIN}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis
                dataKey={nameKey}
                interval={0}
                tick={(props) => (
                  <EditableXTick
                    {...props}
                    nameOverrides={nameOverrides}
                    onNameChange={handleNameChange}
                  />
                )}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                domain={effYDomain}
                allowDataOverflow={yMin !== "" || yMax !== ""}
                label={{
                  value: editableYLabel,
                  angle: -90,
                  position: "insideLeft",
                  style: { fontSize: 11, textAnchor: "middle" },
                }}
              />
              <Tooltip
                formatter={tooltipFormatter || ((v, name) => [
                  typeof v === "number" ? v.toLocaleString() : v,
                  name,
                ])}
                labelFormatter={(label) => nameOverrides[label] ?? label}
              />
              {referenceLineY != null && (
                <ReferenceLine y={referenceLineY} stroke="#666" />
              )}
              {grouped ? (
                <Legend
                  verticalAlign="top"
                  height={30}
                  content={<CustomLegend labels={legendLabels} onLabelChange={handleLabelChange} />}
                />
              ) : (
                <Legend
                  verticalAlign="top"
                  height={30}
                  content={({ payload }) => (
                    <div style={{ display: "flex", justifyContent: "center", gap: 20, fontSize: 11, marginBottom: 4 }}>
                      {payload.map((entry, i) => (
                        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                          <svg width={14} height={14}>
                            <rect x={1} y={1} width={12} height={12} fill={entry.color} />
                          </svg>
                          <EditableLabel
                            value={legendLabels[0]}
                            onChange={(v) => handleLabelChange(0, v)}
                          />
                        </span>
                      ))}
                    </div>
                  )}
                />
              )}
              <Bar dataKey={dataKey} name={grouped ? legendLabels[0] : tooltipLabel} barSize={BAR_WIDTH} radius={barRadius}>
                {data.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={grouped ? "#d32f2f" : (
                      cellColorFn
                        ? cellColorFn(entry, i)
                        : colors[i % colors.length]
                    )}
                  />
                ))}
                {labelsVisible && (
                  <LabelList
                    dataKey={dataKey}
                    position="top"
                    content={(props) => (
                      <EditableValueLabel
                        {...props}
                        formatter={barLabelFormatter}
                        fontSize={(barLabelStyle && barLabelStyle.fontSize) || 11}
                        fontWeight={(barLabelStyle && barLabelStyle.fontWeight) || 600}
                        overrides={valueOverrides}
                        onOverride={handleValueOverride("primary")}
                      />
                    )}
                  />
                )}
              </Bar>
              {grouped && (
                <Bar dataKey={compareKey} name={legendLabels[1]} barSize={BAR_WIDTH}>
                  {data.map((entry, i) => (
                    <Cell
                      key={i}
                      fill="#212121"
                    />
                  ))}
                  {labelsVisible && (
                    <LabelList
                      dataKey={compareKey}
                      position="top"
                      content={(props) => (
                        <EditableValueLabel
                          {...props}
                          formatter={barLabelFormatter}
                          fill="#212121"
                          fontSize={(barLabelStyle && barLabelStyle.fontSize) || 11}
                          fontWeight={(barLabelStyle && barLabelStyle.fontWeight) || 600}
                          overrides={compareOverrides}
                          onOverride={handleValueOverride("compare")}
                        />
                      )}
                    />
                  )}
                </Bar>
              )}
            </BarChart>
          </div>
        )}
      </div>

      {inspectorOpen && (
        <div className="spm-inspector">
          <div className="spm-insp-header">
            <span>Property Inspector</span>
            <button className="spm-insp-close" onClick={() => setInspectorOpen(false)}>×</button>
          </div>
          <div className="spm-insp-body">
            <div className="spm-insp-section-title">Y Axis</div>
            <div className="spm-insp-row">
              <label>Minimum</label>
              <input
                type="number"
                className="spm-insp-input"
                value={yMin}
                placeholder="auto"
                onChange={(e) => setYMin(e.target.value)}
              />
            </div>
            <div className="spm-insp-row">
              <label>Maximum</label>
              <input
                type="number"
                className="spm-insp-input"
                value={yMax}
                placeholder="auto"
                onChange={(e) => setYMax(e.target.value)}
              />
            </div>
            <div className="spm-insp-section-title">Axis Title</div>
            <div className="spm-insp-row" style={{ gridTemplateColumns: "1fr" }}>
              <input
                type="text"
                className="spm-insp-text"
                value={editableYLabel}
                placeholder="Y axis title"
                onChange={(e) => setEditableYLabel(e.target.value)}
              />
            </div>

            <div className="spm-insp-section-title">Data Labels</div>
            <div className="spm-insp-row">
              <label>Show labels</label>
              <div className="spm-seg">
                <span className="spm-seg-opt" onClick={() => setLabelsVisible(true)}>
                  <span className={`spm-radio ${labelsVisible ? "on" : ""}`} />Show
                </span>
                <span className="spm-seg-opt" onClick={() => setLabelsVisible(false)}>
                  <span className={`spm-radio ${!labelsVisible ? "on" : ""}`} />Hide
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductionBarChart;
export { getChartWidth, downloadChartAsPng };
