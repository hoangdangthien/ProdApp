import React, { useRef, useCallback, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Cell, Legend,
} from "recharts";

const DEFAULT_COLORS = [
  "#2e7d32", "#1976d2", "#e65100", "#6a1b9a", "#00838f",
  "#c62828", "#ef6c00", "#283593", "#00695c", "#ad1457",
  "#f57c00", "#0288d1", "#388e3c", "#7b1fa2", "#00acc1",
];

const BAR_WIDTH = 28;
const BAR_GAP = 100;
const MARGIN = { top: 16, right: 16, bottom: 80, left: 16 };

const MIN_CHART_WIDTH = 450;

function getChartWidth(barCount, grouped = false) {
  const gap = grouped ? BAR_GAP + 20 : BAR_GAP;
  return Math.max(MIN_CHART_WIDTH, barCount * (BAR_WIDTH + gap) + MARGIN.left + MARGIN.right);
}

function downloadChartAsPng(svgElement, filename) {
  if (!svgElement) return;
  const svgData = new XMLSerializer().serializeToString(svgElement);
  const canvas = document.createElement("canvas");
  const scale = 2;
  canvas.width = svgElement.width.baseVal.value * scale;
  canvas.height = svgElement.height.baseVal.value * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  const img = new Image();
  img.onload = () => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    const link = document.createElement("a");
    link.download = filename;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };
  img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
}

function EditableLabel({ value, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { setEditing(false); onChange(draft); }}
        onKeyDown={(e) => { if (e.key === "Enter") { setEditing(false); onChange(draft); } }}
        style={{ fontSize: 11, width: Math.max(40, draft.length * 7), border: "1px solid #999", borderRadius: 2, padding: "0 3px" }}
      />
    );
  }
  return (
    <span
      onClick={() => setEditing(true)}
      style={{ cursor: "pointer", borderBottom: "1px dashed #aaa" }}
      title="Click to edit"
    >
      {value}
    </span>
  );
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

function CustomLegend({ payload, labels, onLabelChange }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 20, fontSize: 11, marginBottom: 4 }}>
      {payload.map((entry, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <svg width={14} height={14}>
            <rect x={1} y={1} width={12} height={12}
              fill={entry.dataKey === "oil" ? "#d32f2f" : "#212121"} />
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
          {data.length > 0 && (
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
        </span>
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
                label={{
                  value: yLabel,
                  angle: -90,
                  position: "insideLeft",
                  style: { fontSize: 11, textAnchor: "middle" },
                }}
              />
              <Tooltip
                formatter={(v, name) => [
                  typeof v === "number" ? v.toLocaleString() : v,
                  name,
                ]}
                labelFormatter={(label) => nameOverrides[label] ?? label}
              />
              {grouped && (
                <Legend
                  verticalAlign="top"
                  height={30}
                  content={<CustomLegend labels={legendLabels} onLabelChange={handleLabelChange} />}
                />
              )}
              <Bar dataKey={dataKey} name={grouped ? legendLabels[0] : tooltipLabel} barSize={BAR_WIDTH}>
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
              </Bar>
              {grouped && (
                <Bar dataKey={compareKey} name={legendLabels[1]} barSize={BAR_WIDTH}>
                  {data.map((entry, i) => (
                    <Cell
                      key={i}
                      fill="#212121"
                    />
                  ))}
                </Bar>
              )}
            </BarChart>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProductionBarChart;
export { getChartWidth, downloadChartAsPng };
