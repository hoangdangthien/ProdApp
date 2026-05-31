import React, { useState, useRef, useEffect } from "react";

function EditableValueLabel({ x, y, width, height, value, index, offset = 6, formatter, fontSize = 11, fontWeight = 600, fill = "#333", overrides, onOverride }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);

  const displayValue = overrides && overrides[index] != null ? overrides[index] : value;
  const formatted = formatter ? formatter(displayValue) : (typeof displayValue === "number" ? Math.round(displayValue).toLocaleString() : displayValue);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  if (value == null) return null;
  const isNegative = typeof value === "number" && value < 0;
  const cx = x + (width ? width / 2 : 0);
  const cy = isNegative ? y + offset + fontSize : y - offset;

  if (editing) {
    return (
      <foreignObject x={cx - 50} y={cy - 14} width={100} height={22}>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            setEditing(false);
            if (onOverride && draft !== String(formatted)) {
              const num = Number(draft);
              onOverride(index, isNaN(num) ? draft : num);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setEditing(false);
              if (onOverride && draft !== String(formatted)) {
                const num = Number(draft);
                onOverride(index, isNaN(num) ? draft : num);
              }
            }
            if (e.key === "Escape") setEditing(false);
          }}
          style={{
            fontSize: fontSize - 1,
            width: 94,
            border: "1px solid #999",
            borderRadius: 2,
            padding: "0 3px",
            textAlign: "center",
            background: "#fff",
          }}
        />
      </foreignObject>
    );
  }

  return (
    <text
      x={cx}
      y={cy}
      textAnchor="middle"
      fontSize={fontSize}
      fontWeight={fontWeight}
      fill={fill}
      style={{ cursor: "pointer" }}
      onClick={() => {
        setDraft(String(displayValue));
        setEditing(true);
      }}
    >
      {formatted}
    </text>
  );
}

export default EditableValueLabel;
