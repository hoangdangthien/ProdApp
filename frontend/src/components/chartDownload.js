import React, { useRef, useCallback } from "react";
import { toPng } from "html-to-image";

export function downloadChartAsPng(containerElement, filename) {
  if (!containerElement) return;
  const svg = containerElement.querySelector
    ? containerElement.tagName === "svg"
      ? containerElement.parentElement
      : containerElement
    : containerElement;

  const target = svg.querySelector(".recharts-wrapper") || svg;

  toPng(target, {
    pixelRatio: 4,
    backgroundColor: "#ffffff",
    filter: (node) => {
      if (node?.tagName === "BUTTON") return false;
      if (node?.classList?.contains?.("spm-insp-close")) return false;
      return true;
    },
  })
    .then((dataUrl) => {
      const link = document.createElement("a");
      link.download = filename;
      link.href = dataUrl;
      link.click();
    })
    .catch((err) => console.error("Chart export failed:", err));
}

export function useChartDownload(title) {
  const chartRef = useRef(null);

  const handleDownload = useCallback(() => {
    const safeName = (title || "chart").replace(/[^a-zA-Z0-9]/g, "_") + ".png";
    downloadChartAsPng(chartRef.current, safeName);
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
