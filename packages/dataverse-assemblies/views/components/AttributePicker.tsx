import * as React from "react";
import { useState } from "react";
import { Modal } from "shared-views";

export function AttributePicker({
  entity,
  attributes,
  selected,
  onConfirm,
  onCancel,
}: {
  entity: string;
  attributes: string[];
  selected: string[];
  onConfirm: (selected: string[]) => void;
  onCancel: () => void;
}): React.ReactElement {
  const [checked, setChecked] = useState<Set<string>>(new Set(selected));

  const toggle = (attr: string): void => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(attr)) { next.delete(attr); } else { next.add(attr); }
      return next;
    });
  };

  return (
    <Modal title={`Select attributes — ${entity}`} onClose={onCancel}>
      <div className="picker-list">
        {attributes.length === 0 && (
          <p style={{ opacity: 0.6, padding: "8px 0" }}>No attributes found for this entity.</p>
        )}
        {attributes.map((attr) => (
          <label key={attr} className="picker-item">
            <input
              type="checkbox"
              checked={checked.has(attr)}
              onChange={() => toggle(attr)}
            />
            {attr}
          </label>
        ))}
      </div>
      <div className="picker-actions">
        <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
        <button type="button" className="primary" onClick={() => onConfirm(Array.from(checked))}>
          OK ({checked.size} selected)
        </button>
      </div>
    </Modal>
  );
}
