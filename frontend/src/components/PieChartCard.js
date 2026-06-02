import React, { useRef, useCallback } from "react";
import {
  PieChart, Pie, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { downloadChartAsPng } from "./ProductionBarChart";
import useResizable, { ResizeHandles } from "./useResizable";

/*
 * PieChartCard
 * ------------
 * Resizable + downloadable share pie. `pieData` items are { name, value, fill }.
 * `totalValue` is used for the tooltip percentage. Shared by the Production page
 * (reservoir / field share) and the overview Dashboard (any-level share).
 */
function PieChartCard({
  title,
  pieData,
  totalValue,
  tooltipLabel,
  unitLabel = "kt",
  excludeDirections = [],
  onHorizontalResize,
}) {
  const plotRef = useRef(null);
  const { size, style, containerRef, onResize } = useResizable(300, 200, 150, { onHorizontalResize });
  const handleDownload = useCallback(() => {
    const safeName = title.replace(/[^a-zA-Z0-9]/g, "_") + ".png";
    downloadChartAsPng(plotRef.current, safeName);
  }, [title]);

  return (
    <div className="spm" ref={containerRef} style={style}>
      <div className="spm-header">
        <span className="spm-header-title">
          {title}
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
          <div className="spm-empty" style={{ height: size.height }}>No data</div>
        ) : (
          <ResponsiveContainer width="100%" height={size.height}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={Math.min(size.height * 0.35, 110)}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                labelLine={{ strokeWidth: 1 }}
                fontSize={12}
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => [`${v.toLocaleString()} ${unitLabel} (${totalValue > 0 ? ((v / totalValue) * 100).toFixed(1) : 0}%)`, tooltipLabel]} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
      <ResizeHandles onResize={onResize} excludeDirections={excludeDirections} />
    </div>
  );
}

export default PieChartCard;
