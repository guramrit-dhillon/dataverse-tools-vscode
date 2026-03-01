import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import DataTable from "./DataTable";
import type { TableColumnDefinition } from "./DataTable";
import { TabBar } from "./TabBar";
import StatusBar from "./StatusBar";
import { Codicon } from "./Codicon";
import "./results-viewer.css";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ResultsViewerTab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  /** Raw text content for code-block tabs */
  content?: string;
  /** If true, renders as a <pre> code block. */
  isCodeBlock?: boolean;
  /** Custom renderer — takes precedence over content+isCodeBlock. */
  renderTab?: () => React.ReactNode;
}

export interface ResultsViewerProps<T = Record<string, unknown>> {
  columns: TableColumnDefinition<T>[];
  rows: T[];
  totalRows?: number;
  durationMs?: number | null;
  error?: string | null;
  loading?: boolean;

  // ── Filter (controlled or uncontrolled) ──
  enableFilter?: boolean;
  filterText?: string;
  onFilterChange?: (text: string) => void;
  filterPredicate?: (row: T, text: string, cols: TableColumnDefinition<T>[]) => boolean;

  // ── Tabs ──
  tabs?: ResultsViewerTab[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;

  // ── Export ──
  enableExport?: boolean;
  exportFileName?: string;
  csvCellFormatter?: (col: TableColumnDefinition<T>, row: T) => string;

  // ── Copy ──
  enableCopy?: boolean;

  // ── DataTable passthrough ──
  keyFormatter?: (row: T) => string;
  onRowClick?: (row: T) => void;
  selectedKeys?: string[];
  onSelectionChange?: (keys: string[], rows: T[]) => void;
  rowClassName?: string | ((row: T) => string);
  emptyMessage?: string;

  // ── Slots ──
  filterBarTrailing?: React.ReactNode;

  // ── StatusBar ──
  enableStatusBar?: boolean;
  statusBarMessages?: string[];
  statusBarSchemaLoading?: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function cellToString(val: unknown): string {
  if (val === null || val === undefined) { return ""; }
  if (typeof val === "object") { return JSON.stringify(val); }
  return String(val);
}

function defaultFilter<T>(
  row: T,
  text: string,
  columns: TableColumnDefinition<T>[],
): boolean {
  const lower = text.toLowerCase();
  return columns.some((col) => {
    const val = (row as Record<string, unknown>)[col.key];
    const str = col.valueFormatter ? col.valueFormatter(val, row) : cellToString(val);
    return str.toLowerCase().includes(lower);
  });
}

function escapeCSV(v: string): string {
  return `"${v.replace(/"/g, '""')}"`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ResultsViewer<T = Record<string, unknown>>({
  columns,
  rows,
  totalRows,
  durationMs,
  error,
  loading,
  enableFilter = true,
  filterText: filterTextProp,
  onFilterChange,
  filterPredicate,
  tabs,
  activeTab: activeTabProp,
  onTabChange,
  enableExport = true,
  exportFileName = "results",
  csvCellFormatter,
  enableCopy = true,
  keyFormatter = (row) => JSON.stringify(row),
  onRowClick,
  selectedKeys,
  onSelectionChange,
  rowClassName,
  emptyMessage,
  filterBarTrailing,
  enableStatusBar = true,
  statusBarMessages = [],
  statusBarSchemaLoading,
}: ResultsViewerProps<T>): React.ReactElement {
  // ── Internal state (uncontrolled mode) ──
  const [internalFilter, setInternalFilter] = useState("");
  const [internalTab, setInternalTab] = useState("table");
  const [copied, setCopied] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const filterText = filterTextProp ?? internalFilter;
  const setFilterText = onFilterChange ?? setInternalFilter;
  const activeTab = activeTabProp ?? internalTab;
  const setActiveTab = onTabChange ?? setInternalTab;

  // Close export dropdown on outside click
  useEffect(() => {
    if (!showExport) { return; }
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExport(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showExport]);

  // ── Filtered rows ──
  const predicate = filterPredicate ?? defaultFilter;
  const filteredRows = useMemo(() => {
    if (!enableFilter || filterText.trim() === "") { return rows; }
    return rows.filter((row) => predicate(row, filterText, columns));
  }, [rows, filterText, columns, enableFilter, predicate]);

  // ── Tab definitions ──
  const hasTabs = tabs && tabs.length > 0;
  const isFiltered = filterText.trim() !== "" && filteredRows.length !== rows.length;
  const tableLabel = isFiltered
    ? `Table (${filteredRows.length}/${rows.length})`
    : `Table (${rows.length})`;

  const allTabs = useMemo(() => {
    if (!hasTabs) { return []; }
    return [
      { id: "table", label: tableLabel, icon: <Codicon name="table" /> },
      ...tabs,
    ];
  }, [hasTabs, tableLabel, tabs]);

  // ── Active tab content helper ──
  const activeTabDef = tabs?.find((t) => t.id === activeTab);
  const isTableTab = activeTab === "table" || !hasTabs;

  // Get raw text content for the active non-table tab (used for copy)
  const getActiveTabText = useCallback((): string | null => {
    if (!activeTabDef) { return null; }
    return activeTabDef.content ?? null;
  }, [activeTabDef]);

  // ── Copy handler ──
  const handleCopy = useCallback(() => {
    let text: string;
    if (isTableTab) {
      // Copy as TSV
      const headers = columns.map((c) => c.label).join("\t");
      const body = filteredRows.map((row) =>
        columns.map((col) => {
          const val = (row as Record<string, unknown>)[col.key];
          return col.valueFormatter ? col.valueFormatter(val, row) : cellToString(val);
        }).join("\t")
      ).join("\n");
      text = `${headers}\n${body}`;
    } else {
      text = getActiveTabText() ?? "";
    }
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [isTableTab, columns, filteredRows, getActiveTabText]);

  // ── Export handlers ──
  const handleExportCsv = useCallback(() => {
    const headers = columns.map((c) => escapeCSV(c.label)).join(",");
    const body = filteredRows.map((row) =>
      columns.map((col) => {
        let display: string;
        if (csvCellFormatter) {
          display = csvCellFormatter(col, row);
        } else {
          const val = (row as Record<string, unknown>)[col.key];
          display = col.valueFormatter ? col.valueFormatter(val, row) : cellToString(val);
        }
        return escapeCSV(display === "—" ? "" : display);
      }).join(",")
    ).join("\n");
    downloadBlob(`${headers}\n${body}`, `${exportFileName}.csv`, "text/csv;charset=utf-8;");
  }, [columns, filteredRows, csvCellFormatter, exportFileName]);

  const handleExportJson = useCallback(() => {
    const json = JSON.stringify(filteredRows, null, 2);
    downloadBlob(json, `${exportFileName}.json`, "application/json;charset=utf-8;");
  }, [filteredRows, exportFileName]);

  const hasRows = rows.length > 0;

  // ── Copy title based on active tab ──
  const copyTitle = isTableTab ? "Copy with headers"
    : activeTabDef ? `Copy ${activeTabDef.label}` : "Copy";

  return (
    <div className="results-viewer">
      {/* ── TabBar (only if extra tabs defined) ── */}
      {hasTabs && (
        <TabBar
          tabs={allTabs}
          active={activeTab}
          onChange={setActiveTab}
          trailing={
            <div className="results-actions">
              {enableCopy && (
                <button
                  type="button"
                  className="toolbar-btn"
                  onClick={handleCopy}
                  title={copyTitle}
                  disabled={!hasRows && isTableTab}
                >
                  <Codicon name={copied ? "check" : "copy"} />
                  {copied && <span>Copied!</span>}
                </button>
              )}
              {enableExport && isTableTab && (
                <div className="export-group" ref={exportRef}>
                  <button
                    type="button"
                    className="toolbar-btn"
                    onClick={() => setShowExport(!showExport)}
                    title="Export Results"
                    disabled={!hasRows}
                  >
                    <Codicon name="export" />
                  </button>
                  {showExport && (
                    <div className="export-dropdown">
                      <button type="button" onClick={() => { handleExportCsv(); setShowExport(false); }}>
                        <Codicon name="file" /> Export as CSV
                      </button>
                      <button type="button" onClick={() => { handleExportJson(); setShowExport(false); }}>
                        <Codicon name="json" /> Export as JSON
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          }
        />
      )}

      {/* ── Actions row when no tabs ── */}
      {!hasTabs && (enableCopy || enableExport) && hasRows && (
        <div className="rv-filter-bar" style={{ justifyContent: "flex-end", borderBottom: "none", padding: "4px 12px 0" }}>
          <div className="results-actions">
            {enableCopy && (
              <button type="button" className="toolbar-btn" onClick={handleCopy} title="Copy with headers">
                <Codicon name={copied ? "check" : "copy"} />
                {copied && <span>Copied!</span>}
              </button>
            )}
            {enableExport && (
              <div className="export-group" ref={exportRef}>
                <button type="button" className="toolbar-btn" onClick={() => setShowExport(!showExport)} title="Export Results" disabled={!hasRows}>
                  <Codicon name="export" />
                </button>
                {showExport && (
                  <div className="export-dropdown">
                    <button type="button" onClick={() => { handleExportCsv(); setShowExport(false); }}>
                      <Codicon name="file" /> Export as CSV
                    </button>
                    <button type="button" onClick={() => { handleExportJson(); setShowExport(false); }}>
                      <Codicon name="json" /> Export as JSON
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Filter bar (table tab only) ── */}
      {enableFilter && isTableTab && hasRows && (
        <div className="rv-filter-bar">
          <Codicon name="search" />
          <input
            type="text"
            className="rv-filter-input"
            placeholder="Filter rows…"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
          {filterText && (
            <button
              type="button"
              className="rv-filter-clear"
              onClick={() => setFilterText("")}
              title="Clear filter"
              aria-label="Clear filter"
            >
              <Codicon name="close" />
            </button>
          )}
          {filterBarTrailing}
        </div>
      )}

      {/* ── Content area ── */}
      <div className="rv-content">
        {/* Table tab */}
        {isTableTab && (
          <div className="rv-table-wrap">
            {!hasRows ? (
              <div className="rv-empty-state">
                <div className="rv-empty-state-icon">
                  <Codicon name="table" />
                </div>
                <span className="rv-empty-state-text">{emptyMessage ?? "No rows returned"}</span>
              </div>
            ) : filteredRows.length === 0 && filterText ? (
              <div className="rv-empty-state">
                <div className="rv-empty-state-icon">
                  <Codicon name="search" />
                </div>
                <span className="rv-empty-state-text">No rows match the filter</span>
                <span className="rv-empty-state-hint">Try a different search term or clear the filter</span>
              </div>
            ) : (
              <DataTable
                columns={columns as TableColumnDefinition<T>[]}
                rows={filteredRows}
                keyFormatter={keyFormatter}
                onRowClick={onRowClick}
                selectedKeys={selectedKeys}
                onSelectionChange={onSelectionChange}
                rowClassName={rowClassName}
              />
            )}
          </div>
        )}

        {/* Non-table tabs */}
        {!isTableTab && activeTabDef && (
          activeTabDef.renderTab ? (
            activeTabDef.renderTab()
          ) : activeTabDef.content !== undefined ? (
            <div className="rv-code-content">
              {activeTabDef.content ? (
                <textarea
                  className="rv-code-block"
                  value={activeTabDef.content}
                  readOnly
                  spellCheck={false}
                  wrap="off"
                />
              ) : (
                <div className="rv-empty-state">
                  <div className="rv-empty-state-icon">
                    <Codicon name="info" />
                  </div>
                  <span className="rv-empty-state-text">No content to display</span>
                </div>
              )}
            </div>
          ) : null
        )}
      </div>

      {/* ── Status bar ── */}
      {enableStatusBar && (
        <StatusBar
          rowCount={totalRows ?? rows.length}
          durationMs={durationMs ?? null}
          messages={statusBarMessages}
          error={error ?? null}
          loading={loading}
          schemaLoading={statusBarSchemaLoading}
        />
      )}
    </div>
  );
}

// ── Utility ─────────────────────────────────────────────────────────────────

function downloadBlob(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
