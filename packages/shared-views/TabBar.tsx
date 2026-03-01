import * as React from "react";

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface TabBarProps {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
  /** Optional content to render at the right end of the tab bar */
  trailing?: React.ReactNode;
}

/**
 * Reusable horizontal tab bar with active indicator line.
 * Uses `.tab-bar` / `.tab-btn` styles from panel.css.
 */
export function TabBar({ tabs, active, onChange, trailing }: TabBarProps): React.ReactElement {
  return (
    <div className="tab-bar">
      {tabs.map((t) => (
        <button
          key={t.id}
          className={`tab-btn${active === t.id ? " active" : ""}`}
          onClick={() => onChange(t.id)}
          type="button"
        >
          {t.icon}
          {t.label}
        </button>
      ))}
      {trailing && (
        <>
          <div style={{ flex: 1 }} />
          {trailing}
        </>
      )}
    </div>
  );
}
