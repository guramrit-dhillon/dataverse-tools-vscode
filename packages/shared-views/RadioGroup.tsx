import * as React from "react";

interface RadioOption { value: string; label: string; }

export function RadioGroup({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  options: RadioOption[];
}): React.ReactElement {
  return (
    <div className="radio-group" role="radiogroup">
      {options.map((opt) => (
        <label key={opt.value} className="radio-label">
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
          />
          {opt.label}
        </label>
      ))}
    </div>
  );
}
