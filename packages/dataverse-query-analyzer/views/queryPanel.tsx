import * as React from "react";
import { useEffect, useCallback, useMemo, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import { useReducer, SplitView, ErrorBanner, ErrorBoundary } from "shared-views";
import "shared-views/panel.css";
import "shared-views/fullpage.css";
import "./styles/queryPanel.css";
import SqlEditor from "./components/SqlEditor";
import QueryToolbar from "./components/QueryToolbar";
import StatusBar from "shared-views/StatusBar";
import ResultsView from "./components/ResultsView";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ColumnInfo {
  name: string;
  type: string;
}

interface QueryResult {
  columns: ColumnInfo[];
  rows: Record<string, unknown>[];
  rowCount: number;
  durationMs: number;
  messages: string[];
}

interface SavedQuery {
  name: string;
  sql: string;
}

interface HistoryEntry {
  sql: string;
  timestamp: string;
  durationMs: number;
  rowCount: number;
}

interface TableSuggestion {
  logicalName: string;
  displayName: string;
}

interface ColumnSuggestion {
  logicalName: string;
  type: string;
  displayName: string;
}

// ── State ─────────────────────────────────────────────────────────────────────

interface State {
  envName: string | undefined;
  sql: string;
  results: QueryResult | null;
  loading: boolean;
  error: string | null;
  schema: Record<string, string[]>;
  savedQueries: SavedQuery[];
  history: HistoryEntry[];
  splitDirection: "vertical" | "horizontal";
  messages: string[];
  schemaLoading: boolean;
  filterText: string;
}

const initialState: State = {
  envName: undefined,
  sql: "SELECT TOP 50 * FROM account",
  results: null,
  loading: false,
  error: null,
  schema: {},
  savedQueries: [],
  history: [],
  splitDirection: "vertical",
  messages: [],
  schemaLoading: false,
  filterText: "",
};

// ── Actions ───────────────────────────────────────────────────────────────────

type Action =
  | { type: "ready"; meta: { toExtension: true } }
  | { type: "init"; payload: { envName?: string; initialSql?: string; savedQueries?: SavedQuery[] } }
  | { type: "setSql"; payload: string }
  | { type: "setFilter"; payload: string }
  | { type: "execute"; payload: { sql: string }; meta: { toExtension: true } }
  | { type: "execute:response"; payload: QueryResult }
  | { type: "execute:error"; payload: string }
  | { type: "loadSchema"; meta: { toExtension: true } }
  | { type: "loadSchema:response"; payload: { tables: TableSuggestion[] } }
  | { type: "loadColumnsForTable"; payload: { tableName: string }; meta: { toExtension: true } }
  | { type: "loadColumnsForTable:response"; payload: { columns: ColumnSuggestion[] } }
  | { type: "changeEnvironment"; meta: { toExtension: true } }
  | { type: "changeEnvironment:response"; payload: { envName: string } | undefined }
  | { type: "envChanged"; payload: { envName: string } }
  | { type: "triggerExecute" }
  | { type: "toggleSplitDirection" }
  | { type: "saveQuery"; payload: SavedQuery; meta: { toExtension: true } }
  | { type: "saveQuery:response"; payload: SavedQuery[] }
  | { type: "loadSavedQueries"; meta: { toExtension: true } }
  | { type: "loadSavedQueries:response"; payload: SavedQuery[] }
  | { type: "deleteSavedQuery"; payload: { name: string }; meta: { toExtension: true } }
  | { type: "deleteSavedQuery:response"; payload: SavedQuery[] }
  | { type: "exportResults"; payload: { format: "csv" | "json"; content: string }; meta: { toExtension: true } }
  | { type: "loadHistory"; meta: { toExtension: true } }
  | { type: "loadHistory:response"; payload: HistoryEntry[] }
  | { type: "clearHistory"; meta: { toExtension: true } }
  | { type: "clearHistory:response"; payload: HistoryEntry[] };

// Track the table name for column responses
let pendingColumnTable = "";

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "init": {
      const p = action.payload ?? {};
      return {
        ...state,
        envName: p.envName ?? state.envName,
        sql: p.initialSql ?? state.sql,
        savedQueries: p.savedQueries ?? state.savedQueries,
      };
    }
    case "setSql":
      return { ...state, sql: action.payload };
    case "setFilter":
      return { ...state, filterText: action.payload };
    case "execute":
      return { ...state, loading: true, error: null, messages: [], filterText: "" };
    case "execute:response":
      return {
        ...state,
        loading: false,
        results: action.payload,
        messages: action.payload.messages ?? [],
      };
    case "execute:error":
      return { ...state, loading: false, error: action.payload };
    case "loadSchema":
      return { ...state, schemaLoading: true };
    case "loadSchema:response": {
      const schema: Record<string, string[]> = {};
      for (const t of action.payload.tables) {
        schema[t.logicalName] = [];
      }
      return { ...state, schema, schemaLoading: false };
    }
    case "loadColumnsForTable:response": {
      const cols = action.payload.columns.map((c) => c.logicalName);
      return {
        ...state,
        schema: { ...state.schema, [pendingColumnTable]: cols },
      };
    }
    case "envChanged":
    case "changeEnvironment:response":
      return action.payload?.envName
        ? { ...state, envName: action.payload.envName, schema: {} }
        : state;
    case "toggleSplitDirection":
      return {
        ...state,
        splitDirection:
          state.splitDirection === "vertical" ? "horizontal" : "vertical",
      };
    case "saveQuery:response":
    case "loadSavedQueries:response":
    case "deleteSavedQuery:response":
      return { ...state, savedQueries: action.payload ?? state.savedQueries };
    case "loadHistory:response":
    case "clearHistory:response":
      return { ...state, history: action.payload ?? state.history };
    // Actions forwarded to extension — no local state change:
    case "ready":
    case "changeEnvironment":
    case "loadSavedQueries":
    case "saveQuery":
    case "deleteSavedQuery":
    case "exportResults":
    case "loadColumnsForTable":
    case "triggerExecute":
    case "loadHistory":
    case "clearHistory":
      return state;
  }
}

// ── App ───────────────────────────────────────────────────────────────────────

function cellToString(val: unknown): string {
  if (val === null || val === undefined) { return ""; }
  if (typeof val === "object") { return JSON.stringify(val); }
  return String(val);
}

function QueryPanelApp(): React.ReactElement {
  const [state, dispatch] = useReducer(reducer, initialState);
  const {
    envName,
    sql: sqlText,
    results,
    loading,
    error,
    schema,
    savedQueries,
    history,
    splitDirection,
    messages,
    schemaLoading,
    filterText,
  } = state;
  const [copied, setCopied] = useState(false);

  // On mount: send ready, load schema, saved queries, and history
  useEffect(() => {
    dispatch({ type: "ready", meta: { toExtension: true } });
    dispatch({ type: "loadSchema", meta: { toExtension: true } });
    dispatch({ type: "loadSavedQueries", meta: { toExtension: true } });
    dispatch({ type: "loadHistory", meta: { toExtension: true } });
  }, []);

  // Handle triggerExecute push from extension
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "triggerExecute") {
        dispatch({ type: "execute", payload: { sql: sqlText }, meta: { toExtension: true } });
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [sqlText, dispatch]);

  // When environment changes, reload schema
  useEffect(() => {
    if (envName) {
      dispatch({ type: "loadSchema", meta: { toExtension: true } });
    }
  }, [envName]);

  // Reload history after a query finishes executing
  const prevLoading = useRef(false);
  useEffect(() => {
    if (prevLoading.current && !loading) {
      dispatch({ type: "loadHistory", meta: { toExtension: true } });
    }
    prevLoading.current = loading;
  }, [loading]);

  const handleExecute = useCallback(() => {
    if (!sqlText.trim()) {
      return;
    }
    dispatch({ type: "execute", payload: { sql: sqlText }, meta: { toExtension: true } });
  }, [sqlText]);

  const handleSqlChange = useCallback((value: string) => {
    dispatch({ type: "setSql", payload: value });

    // Lazy-load columns for the table being referenced
    const tableMatch = value.match(/\bFROM\s+(\w+)/i);
    if (tableMatch) {
      const tableName = tableMatch[1].toLowerCase();
      if (schema[tableName] !== undefined && schema[tableName].length === 0) {
        pendingColumnTable = tableName;
        dispatch({
          type: "loadColumnsForTable",
          payload: { tableName },
          meta: { toExtension: true },
        });
      }
    }
  }, [schema]);

  const handleChangeEnv = useCallback(() => {
    dispatch({ type: "changeEnvironment", meta: { toExtension: true } } as Action);
  }, []);

  const handleToggleSplit = useCallback(() => {
    dispatch({ type: "toggleSplitDirection" });
  }, []);

  const handleSaveQuery = useCallback(
    (name: string) => {
      dispatch({
        type: "saveQuery",
        payload: { name, sql: sqlText },
        meta: { toExtension: true },
      });
    },
    [sqlText]
  );

  const handleLoadQuery = useCallback((query: SavedQuery) => {
    dispatch({ type: "setSql", payload: query.sql });
  }, []);

  const handleDeleteQuery = useCallback((name: string) => {
    dispatch({
      type: "deleteSavedQuery",
      payload: { name },
      meta: { toExtension: true },
    });
  }, []);

  const handleLoadHistoryQuery = useCallback((entry: HistoryEntry) => {
    dispatch({ type: "setSql", payload: entry.sql });
  }, []);

  const handleClearHistory = useCallback(() => {
    dispatch({ type: "clearHistory", meta: { toExtension: true } });
  }, []);

  const handleExport = useCallback(
    (format: "csv" | "json") => {
      if (!results) {
        return;
      }
      let content: string;
      if (format === "csv") {
        const header = results.columns.map((c) => c.name).join(",");
        const rows = results.rows
          .map((row) =>
            results.columns
              .map((c) => {
                const val = row[c.name];
                const str = val === null || val === undefined ? "" : String(val);
                return str.includes(",") || str.includes('"')
                  ? `"${str.replace(/"/g, '""')}"`
                  : str;
              })
              .join(",")
          )
          .join("\n");
        content = `${header}\n${rows}`;
      } else {
        content = JSON.stringify(results.rows, null, 2);
      }
      dispatch({
        type: "exportResults",
        payload: { format, content },
        meta: { toExtension: true },
      });
    },
    [results]
  );

  const resultColumns = useMemo(
    () => results?.columns ?? [],
    [results]
  );
  const resultRows = useMemo(
    () => results?.rows ?? [],
    [results]
  );

  const filteredRows = useMemo(() => {
    if (!filterText.trim()) { return resultRows; }
    const lower = filterText.toLowerCase();
    return resultRows.filter((row) =>
      resultColumns.some((col) =>
        cellToString(row[col.name]).toLowerCase().includes(lower)
      )
    );
  }, [resultRows, resultColumns, filterText]);

  const hasResults = resultRows.length > 0;
  const canExecute = !!sqlText.trim() && !!envName && !loading;

  const handleCopy = useCallback(() => {
    if (!results || filteredRows.length === 0) { return; }
    const headers = results.columns.map((c) => c.name).join("\t");
    const body = filteredRows.map((row) =>
      results.columns.map((c) => cellToString(row[c.name])).join("\t")
    ).join("\n");
    navigator.clipboard.writeText(`${headers}\n${body}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [results, filteredRows]);

  const handleFilter = useCallback((value: string) => {
    dispatch({ type: "setFilter", payload: value });
  }, []);

  return (
    <div className="app">
      <QueryToolbar
        envName={envName}
        loading={loading}
        canExecute={canExecute}
        hasResults={hasResults}
        splitDirection={splitDirection}
        savedQueries={savedQueries}
        history={history}
        onExecute={handleExecute}
        onChangeEnv={handleChangeEnv}
        onToggleSplit={handleToggleSplit}
        onSaveQuery={handleSaveQuery}
        onLoadQuery={handleLoadQuery}
        onDeleteQuery={handleDeleteQuery}
        onLoadHistoryQuery={handleLoadHistoryQuery}
        onClearHistory={handleClearHistory}
      />

      {loading && <div className="progress-bar" />}
      <ErrorBanner error={error} />

      <SplitView
        direction={splitDirection}
        initialRatio={0.4}
        min={120}
      >
        <div className={`editor-pane${loading ? " editor-pane-busy" : ""}`}>
          <SqlEditor
            value={sqlText}
            schema={schema}
            onChange={handleSqlChange}
            onExecute={handleExecute}
            disabled={loading}
          />
          {loading && <div className="editor-overlay" />}
        </div>

        <div className="results-pane">
          <ResultsView
            columns={resultColumns}
            rows={filteredRows}
            totalRows={resultRows.length}
            messages={messages}
            loading={loading}
            hasResults={hasResults}
            filterText={filterText}
            copied={copied}
            onExport={handleExport}
            onFilter={handleFilter}
            onCopy={handleCopy}
          />
          <StatusBar
            rowCount={results?.rowCount ?? null}
            durationMs={results?.durationMs ?? null}
            messages={messages}
            error={error}
            loading={loading}
            schemaLoading={schemaLoading}
          />
        </div>
      </SplitView>
    </div>
  );
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <ErrorBoundary>
      <QueryPanelApp />
    </ErrorBoundary>
  );
}
