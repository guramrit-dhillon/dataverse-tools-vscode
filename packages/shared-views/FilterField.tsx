import * as React from "react";

interface FilterFieldProps {
  label: string;
  children: React.ReactNode;
}

/**
 * Compact filter field with an uppercase label — used in filter panels and toolbars.
 * Uses `.filter-field` / `.filter-label` styles.
 */
export function FilterField({ label, children }: FilterFieldProps): React.ReactElement {
  return (
    <div className="filter-field">
      <label className="filter-label">{label}</label>
      {children}
    </div>
  );
}
