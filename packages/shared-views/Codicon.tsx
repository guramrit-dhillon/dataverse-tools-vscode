import * as React from "react";

/** Strip the `$(name)` wrapper if present, returning just the icon name. */
function parseName(raw: string): string {
  const match = raw.match(/^\$\((.+)\)$/);
  return match ? match[1] : raw;
}

/**
 * Renders a VS Code codicon as an `<i>` element.
 *
 * Accepts either `$(name)` (VS Code syntax) or just `name`.
 * Requires the codicon font/CSS to be loaded in the webview.
 */
export function Codicon({
  name,
  className,
  ...rest
}: { name: string; className?: string } & React.HTMLAttributes<HTMLElement>): React.ReactElement {
  const icon = parseName(name);
  const cls = ["codicon", `codicon-${icon}`, className].filter(Boolean).join(" ");
  return <i className={cls} {...rest} />;
}
