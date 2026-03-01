import * as React from "react";

interface ToolbarProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Horizontal toolbar container matching VS Code toolbar patterns.
 * Children are rendered in a flex row with standard gap and border.
 */
export function Toolbar({ children, className }: ToolbarProps): React.ReactElement {
  const cls = ["toolbar", className].filter(Boolean).join(" ");
  return <div className={cls}>{children}</div>;
}

/** Visual separator between toolbar groups. */
export function ToolbarSeparator(): React.ReactElement {
  return <div className="toolbar-separator" />;
}

/** Left-aligned group of toolbar items. */
export function ToolbarGroup({ children }: { children: React.ReactNode }): React.ReactElement {
  return <div className="toolbar-group">{children}</div>;
}
