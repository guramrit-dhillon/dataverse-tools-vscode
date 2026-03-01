import * as React from "react";
import { useEffect, useRef } from "react";

/**
 * Modal dialog with backdrop overlay, focus trap, and Escape key dismissal.
 *
 * Renders a `.backdrop` + `.picker-dialog` pattern used across forms.
 */
export function Modal({
  title,
  onClose,
  className,
  children,
}: {
  title: string;
  onClose: () => void;
  className?: string;
  children: React.ReactNode;
}): React.ReactElement {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus trap and Escape key
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) { return; }

    // Focus the dialog container on mount
    dialog.focus();

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }

      // Focus trap: cycle Tab within the dialog
      if (e.key === "Tab") {
        const focusable = dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) { return; }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div
        ref={dialogRef}
        className={["picker-dialog", className].filter(Boolean).join(" ")}
        role="dialog"
        aria-label={title}
        aria-modal="true"
        tabIndex={-1}
      >
        <h3>{title}</h3>
        {children}
      </div>
    </>
  );
}
