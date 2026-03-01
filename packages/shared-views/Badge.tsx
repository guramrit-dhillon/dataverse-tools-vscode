import * as React from "react";

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Small pill badge using VS Code badge tokens.
 * Use for metadata tags, counts, and status indicators.
 */
export function Badge({ children, className }: BadgeProps): React.ReactElement {
  const cls = ["badge", className].filter(Boolean).join(" ");
  return <span className={cls}>{children}</span>;
}
