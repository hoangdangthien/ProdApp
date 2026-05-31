import React, { useRef, useCallback } from "react";

export function downloadChartAsPng(svgElement, filename) {
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

export function useChartDownload(title) {
  const chartRef = useRef(null);

  const handleDownload = useCallback(() => {
    const svg = chartRef.current?.querySelector("svg");
    const safeName = (title || "chart").replace(/[^a-zA-Z0-9]/g, "_") + ".png";
    downloadChartAsPng(svg, safeName);
  }, [title]);

  return { chartRef, handleDownload };
}

export function DownloadPngButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      title="Download as PNG"
      style={{
        background: "#1976d2", border: "none", borderRadius: 4,
        padding: "4px 10px", cursor: "pointer", fontSize: 12, color: "#fff",
        fontWeight: 600, display: "flex", alignItems: "center", gap: 4,
      }}
    >
      PNG
    </button>
  );
}
