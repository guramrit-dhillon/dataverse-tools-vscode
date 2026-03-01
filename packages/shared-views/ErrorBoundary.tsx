import * as React from "react";

interface State {
  error: Error | null;
}

/**
 * Catches unhandled errors in the React component tree and renders a
 * user-friendly fallback instead of a blank webview panel.
 */
export class ErrorBoundary extends React.Component<
  React.PropsWithChildren<unknown>,
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override render(): React.ReactNode {
    if (this.state.error) {
      return (
        <div style={{ padding: 16, fontFamily: "var(--vscode-font-family)" }}>
          <h3 style={{ color: "var(--vscode-errorForeground)", margin: "0 0 8px" }}>
            Something went wrong
          </h3>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              color: "var(--vscode-descriptionForeground)",
              fontSize: 12,
            }}
          >
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={() => location.reload()}
            style={{ marginTop: 12 }}
          >
            Reload panel
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
