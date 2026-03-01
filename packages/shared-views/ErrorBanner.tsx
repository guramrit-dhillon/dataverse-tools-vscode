import * as React from "react";

/**
 * Dismissible error banner. Renders nothing when `error` is falsy.
 * Shows a visible dismiss button when `onDismiss` is provided.
 */
export function ErrorBanner({
  error,
  onDismiss,
}: {
  error: string | null | undefined;
  onDismiss?: () => void;
}): React.ReactElement | null {
  if (!error) { return null; }
  return (
    <div className="error-banner" role="alert">
      <span className="error-banner-message">{error}</span>
      {onDismiss && (
        <button
          type="button"
          className="error-banner-dismiss"
          onClick={onDismiss}
          aria-label="Dismiss error"
          title="Dismiss"
        >
          <i className="codicon codicon-close" />
        </button>
      )}
    </div>
  );
}
