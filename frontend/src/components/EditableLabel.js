import React, { useState } from "react";

function EditableLabel({ value, onChange, style = {} }) {
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
        style={{ fontSize: 11, width: Math.max(40, draft.length * 7), border: "1px solid #999", borderRadius: 2, padding: "0 3px", ...style }}
      />
    );
  }
  return (
    <span
      onClick={() => { setDraft(value); setEditing(true); }}
      style={{ cursor: "pointer", borderBottom: "1px dashed #aaa", ...style }}
      title="Click to edit"
    >
      {value}
    </span>
  );
}

export default EditableLabel;
