import React, { useState, useRef, useEffect, useCallback } from "react";
import { Codicon, EnvironmentBar } from "shared-views";
import "shared-views/environment-bar.css";

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

interface QueryToolbarProps {
  envName: string | undefined;
  loading: boolean;
  canExecute: boolean;
  hasResults: boolean;
  splitDirection: "vertical" | "horizontal";
  savedQueries: SavedQuery[];
  history: HistoryEntry[];
  onExecute: () => void;
  onChangeEnv: () => void;
  onToggleSplit: () => void;
  onSaveQuery: (name: string) => void;
  onLoadQuery: (query: SavedQuery) => void;
  onDeleteQuery: (name: string) => void;
  onLoadHistoryQuery: (entry: HistoryEntry) => void;
  onClearHistory: () => void;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (isToday) { return time; }
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
}

function truncateSql(sql: string, max = 60): string {
  const oneLine = sql.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? oneLine.slice(0, max) + "\u2026" : oneLine;
}

export default function QueryToolbar({
  envName,
  loading,
  canExecute,
  hasResults,
  splitDirection,
  savedQueries,
  history,
  onExecute,
  onChangeEnv,
  onToggleSplit,
  onSaveQuery,
  onLoadQuery,
  onDeleteQuery,
  onLoadHistoryQuery,
  onClearHistory,
}: QueryToolbarProps): React.ReactElement {
  const [showSaved, setShowSaved] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const savedRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const saveInputRef = useRef<HTMLInputElement>(null);

  // Close saved queries dropdown on outside click
  useEffect(() => {
    if (!showSaved) { return; }
    const handler = (e: MouseEvent) => {
      if (savedRef.current && !savedRef.current.contains(e.target as Node)) {
        setShowSaved(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showSaved]);

  // Close history dropdown on outside click
  useEffect(() => {
    if (!showHistory) { return; }
    const handler = (e: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showHistory]);

  // Focus save input when it appears
  useEffect(() => {
    if (showSaveInput && saveInputRef.current) {
      saveInputRef.current.focus();
    }
  }, [showSaveInput]);

  const handleSave = useCallback((): void => {
    const name = saveName.trim();
    if (name) {
      onSaveQuery(name);
      setSaveName("");
      setShowSaveInput(false);
    }
  }, [saveName, onSaveQuery]);

  const handleToggleSaveInput = useCallback(() => {
    setShowSaveInput((prev) => !prev);
    if (showSaveInput) {
      setSaveName("");
    }
  }, [showSaveInput]);

  return (
    <div className="query-toolbar">
      <div className="toolbar-left">
        <button
          className="toolbar-btn primary"
          onClick={onExecute}
          disabled={!canExecute}
          title={!envName ? "Select an environment first" : !canExecute && !loading ? "Enter a SQL query" : "Execute (Ctrl+Enter)"}
        >
          <Codicon name={loading ? "loading~spin" : "run"} />
          <span>{loading ? "Executing\u2026" : "Execute"}</span>
        </button>

        <div className="toolbar-separator" />

        <div className="saved-queries-group" ref={savedRef}>
          <button
            className="toolbar-btn secondary"
            onClick={() => setShowSaved(!showSaved)}
            title="Saved Queries"
            disabled={loading}
          >
            <Codicon name="bookmark" />
            <span>Saved</span>
            {savedQueries.length > 0 && (
              <span className="badge">{savedQueries.length}</span>
            )}
          </button>

          {showSaved && (
            <div className="saved-dropdown">
              {savedQueries.length === 0 ? (
                <div className="dropdown-empty">No saved queries</div>
              ) : (
                savedQueries.map((q) => (
                  <div key={q.name} className="saved-item">
                    <button
                      className="saved-item-btn"
                      onClick={() => {
                        onLoadQuery(q);
                        setShowSaved(false);
                      }}
                      title={q.sql}
                    >
                      {q.name}
                    </button>
                    <button
                      className="saved-item-delete"
                      onClick={() => onDeleteQuery(q.name)}
                      title="Delete"
                    >
                      <Codicon name="close" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <button
          className={`toolbar-btn secondary${showSaveInput ? " active" : ""}`}
          onClick={handleToggleSaveInput}
          title="Save Current Query"
          disabled={loading}
        >
          <Codicon name="save" />
        </button>

        {showSaveInput && (
          <div className="save-input-group">
            <input
              ref={saveInputRef}
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Query name"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSave();
                }
                if (e.key === "Escape") {
                  setShowSaveInput(false);
                  setSaveName("");
                }
              }}
            />
            <button
              className="toolbar-btn secondary"
              onClick={handleSave}
              disabled={!saveName.trim()}
            >
              Save
            </button>
          </div>
        )}

        <div className="toolbar-separator" />

        <div className="history-group" ref={historyRef}>
          <button
            className="toolbar-btn secondary"
            onClick={() => setShowHistory(!showHistory)}
            title="Recent Queries"
            disabled={loading}
          >
            <Codicon name="history" />
            <span>Recent</span>
            {history.length > 0 && (
              <span className="badge">{history.length}</span>
            )}
          </button>

          {showHistory && (
            <div className="history-dropdown">
              {history.length === 0 ? (
                <div className="dropdown-empty">No recent queries</div>
              ) : (
                <>
                  <div className="history-header">
                    <span className="history-header-label">Recent Queries</span>
                    <button
                      className="history-clear-btn"
                      onClick={() => {
                        onClearHistory();
                        setShowHistory(false);
                      }}
                      title="Clear history"
                    >
                      <Codicon name="clear-all" />
                    </button>
                  </div>
                  {history.map((entry, i) => (
                    <button
                      key={`${entry.timestamp}-${i}`}
                      className="history-item"
                      onClick={() => {
                        onLoadHistoryQuery(entry);
                        setShowHistory(false);
                      }}
                      title={entry.sql}
                    >
                      <span className="history-item-sql">{truncateSql(entry.sql)}</span>
                      <span className="history-item-meta">
                        {entry.rowCount} rows &middot; {entry.durationMs}ms &middot; {formatTimestamp(entry.timestamp)}
                      </span>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="toolbar-right">
        <button
          className="toolbar-btn secondary"
          onClick={onToggleSplit}
          title={splitDirection === "vertical" ? "Switch to horizontal layout" : "Switch to vertical layout"}
        >
          <Codicon
            name={
              splitDirection === "vertical"
                ? "split-vertical"
                : "split-horizontal"
            }
          />
        </button>

        <div className="toolbar-separator" />

        <EnvironmentBar
          envName={envName ?? "No environment"}
          onChangeEnv={onChangeEnv}
        />
      </div>
    </div>
  );
}
