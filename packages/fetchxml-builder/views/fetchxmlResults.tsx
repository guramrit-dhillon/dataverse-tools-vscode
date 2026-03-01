import * as React from "react";
import { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { useReducer, ErrorBoundary, Codicon, ResultsViewer } from "shared-views";
import "shared-views/panel.css";
import "shared-views/fullpage.css";
import "shared-views/results-viewer.css";
import "./styles/fetchxmlResults.css";
import { useFetchXmlAdapter, type QueryResults, type NameMode } from "./adapters/fetchXmlAdapter";

// ── State & Actions ───────────────────────────────────────────────────────────

interface State {
  results: QueryResults | null;
  nameMode: NameMode;
  queryId: number;
}

const initial: State = {
  results: null,
  nameMode: "logical",
  queryId: 0,
};

type Action =
  | { type: "init"; payload: QueryResults }
  | { type: "setNameMode"; payload: NameMode }
  | { type: "ready"; meta: { toExtension: true } };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "init":
      return { ...state, results: action.payload, queryId: state.queryId + 1 };
    case "setNameMode":
      return { ...state, nameMode: action.payload };
    case "ready":
      return state;
    default:
      return state;
  }
}

// ── Root component ─────────────────────────────────────────────────────────────

function ResultsApp(): React.ReactElement {
  const [state, dispatch] = useReducer(reducer, initial);
  const { results, nameMode, queryId } = state;

  useEffect(() => {
    dispatch({ type: "ready", meta: { toExtension: true } });
  }, []);

  const adapter = useFetchXmlAdapter(
    results,
    nameMode,
    (mode) => dispatch({ type: "setNameMode", payload: mode }),
  );

  if (!adapter) {
    return (
      <div className="app">
        <div className="rv-empty-state">
          <div className="rv-empty-state-icon">
            <Codicon name="database" />
          </div>
          <span className="rv-empty-state-text">Waiting for query results…</span>
          <span className="rv-empty-state-hint">Execute a FetchXML query to see results here</span>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <ResultsViewer
        key={queryId}
        {...adapter}
      />
    </div>
  );
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(<ErrorBoundary><ResultsApp /></ErrorBoundary>);
}
