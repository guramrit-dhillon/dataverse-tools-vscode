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
 * Supports `~spin` modifier (e.g. `loading~spin`) which maps to
 * `codicon-animation-spin` — the same class VS Code applies internally.
 * Requires the codicon font/CSS to be loaded in the webview.
 */
export function Codicon({
  name,
  className,
  ...rest
}: { name: string; className?: string } & React.HTMLAttributes<HTMLElement>): React.ReactElement {
  const raw = parseName(name);
  const [icon, modifier] = raw.split("~");
  const cls = [
    "codicon",
    `codicon-${icon}`,
    modifier === "spin" ? "codicon-modifier-spin" : undefined,
    className,
  ].filter(Boolean).join(" ");
  return <i className={cls} {...rest} />;
}
