import * as React from "react";
import "./date-input.css";

export type DateInputFormat = "date" | "datetime" | "time";

interface DateInputProps {
  fieldId: string;
  value: string;
  onChange: (value: string) => void;
  format?: DateInputFormat;
  disabled?: boolean;
  min?: string;
  max?: string;
}

const inputTypeMap: Record<DateInputFormat, string> = {
  date: "date",
  datetime: "datetime-local",
  time: "time",
};

export function DateInput({
  fieldId,
  value,
  onChange,
  format = "datetime",
  disabled,
  min,
  max,
}: DateInputProps): React.ReactElement {
  return (
    <input
      id={fieldId}
      className="date-input"
      type={inputTypeMap[format]}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      min={min}
      max={max}
    />
  );
}
