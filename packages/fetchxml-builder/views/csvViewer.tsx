import * as React from "react";
import { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary, Codicon, ResultsViewer } from "shared-views";
import "shared-views/panel.css";
import "shared-views/fullpage.css";
import "shared-views/results-viewer.css";
import { useCsvAdapter } from "./adapters/csvAdapter";

declare function acquireVsCodeApi(): { postMessage: (msg: unknown) => void };
const vscode = acquireVsCodeApi();

function CsvViewerApp(): React.ReactElement {
  const [content, setContent] = useState<string | null>(null);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const { type, payload } = event.data;
      if (type === "init" || type === "documentChanged") {
        setContent(payload.content);
      }
    };
    window.addEventListener("message", handler);
    // Signal ready
    vscode.postMessage({ type: "ready" });
    return () => window.removeEventListener("message", handler);
  }, []);

  if (content === null) {
    return (
      <div className="app">
        <div className="rv-empty-state">
          <div className="rv-empty-state-icon">
            <Codicon name="loading~spin" />
          </div>
          <span className="rv-empty-state-text">Loading CSV…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <CsvContent csvText={content} />
    </div>
  );
}

function CsvContent({ csvText }: { csvText: string }): React.ReactElement {
  const { columns, rows } = useCsvAdapter(csvText);

  return (
    <ResultsViewer
      columns={columns}
      rows={rows}
      enableFilter={true}
      enableExport={true}
      enableCopy={true}
      enableStatusBar={true}
      exportFileName="data"
      emptyMessage="No data in CSV file"
    />
  );
}

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(<ErrorBoundary><CsvViewerApp /></ErrorBoundary>);
}
