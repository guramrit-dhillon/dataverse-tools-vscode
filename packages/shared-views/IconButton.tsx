import * as React from "react";
import { Codicon } from "./Codicon";

interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: string;
  label: string;
  variant?: "default" | "danger";
}

/**
 * Icon-only button with built-in Codicon, proper aria-label, and optional danger variant.
 */
export function IconButton({
  icon,
  label,
  variant,
  className,
  ...rest
}: IconButtonProps): React.ReactElement {
  const cls = [
    "secondary",
    "icon-btn",
    variant === "danger" ? "danger" : "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <button
      type="button"
      className={cls}
      title={label}
      aria-label={label}
      {...rest}
    >
      <Codicon name={icon} />
    </button>
  );
}
