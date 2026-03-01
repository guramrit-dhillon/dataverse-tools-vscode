import * as React from "react";
import { useEffect, useCallback, useState } from "react";
import { useReducer, SplitView, Autocomplete, DateInput, FilterField, EnvironmentBar, Codicon, IconButton, ResultsViewer, type AutocompleteOption } from "shared-views";
import StatusBar from "shared-views/StatusBar";
import "shared-views/filter-field.css";
import "shared-views/environment-bar.css";
import "shared-views/status-bar.css";
import "shared-views/results-viewer.css";
import { useTraceLogAdapter, type TraceLog } from "../adapters/traceLogAdapter";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Filter {
  pluginTypeName: string;
  messageName: string;
  entityName: string;
  correlationId: string;
  exceptionsOnly: boolean;
  dateFrom: string;
  dateTo: string;
  maxCount: number;
}

interface Suggestions {
  pluginTypeNames: string[];
  messageNames: string[];
  entityNames: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toOptions(items: string[]): AutocompleteOption[] {
  return items.map((s) => ({ key: s, label: s }));
}

function filterOptions(all: string[], query: string): AutocompleteOption[] {
  const q = query.toLowerCase();
  return toOptions(q ? all.filter((s) => s.toLowerCase().includes(q)) : all);
}

function defaultFilter(): Filter {
  return {
    pluginTypeName: "",
    messageName: "",
    entityName: "",
    correlationId: "",
    exceptionsOnly: false,
    dateFrom: "",
    dateTo: "",
    maxCount: 50,
  };
}

interface State {
  envName: string;
  logs?: TraceLog[];
  loading: boolean;
  retrieved: boolean;
  selected: TraceLog | null;
  error: string | null;
  filter: Filter;
  suggestions: Suggestions;
  filteredPlugins: AutocompleteOption[];
  filteredMessages: AutocompleteOption[];
  filteredEntities: AutocompleteOption[];
  durationMs: number | null;
}

const initialState: State = {
  envName: "",
  logs: [],
  loading: false,
  retrieved: false,
  selected: null,
  error: null,
  filter: defaultFilter(),
  suggestions: { pluginTypeNames: [], messageNames: [], entityNames: [] },
  filteredPlugins: [],
  filteredMessages: [],
  filteredEntities: [],
  durationMs: null,
};

type Action =
  | { type: "retrieve"; payload: Filter; meta: { toExtension: true } }
  | { type: "retrieve:response"; payload: TraceLog[] }
  | { type: "retrieve:error"; payload: string }
  | { type: "setSelected"; payload: TraceLog | null }
  | { type: "setFilter"; payload: Partial<Filter> }
  | { type: "ready"; meta: { toExtension: true } }
  | { type: "init"; payload: { envName: string; filter?: Partial<Filter> } }
  | { type: "clear" }
  | { type: "suggestions"; meta: { toExtension: true } }
  | { type: "suggestions:response"; payload: Suggestions }
  | { type: "suggestions:error"; payload: string }
  | { type: "changeEnvironment"; meta: { toExtension: true } }
  | { type: "changeEnvironment:response"; payload: { envName: string } }
  | { type: "filterSuggestions"; payload: { field: "plugin" | "message" | "entity"; query: string } };


function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "init": {
      const { envName, filter } = action.payload ?? {};
      return {
        ...state,
        envName: envName ?? state.envName,
        filter: filter ? { ...state.filter, ...filter } : state.filter,
      };
    }
    case "retrieve":
      return { ...state, loading: true, error: null, durationMs: null };
    case "retrieve:response":
      return { ...state, logs: action.payload, loading: false, retrieved: true, selected: null };
    case "retrieve:error":
      return { ...state, error: action.payload, loading: false };
    case "setSelected":
      return { ...state, selected: action.payload };
    case "setFilter":
      return { ...state, filter: { ...state.filter, ...action.payload } };
    case "suggestions:response":
      return {
        ...state,
        suggestions: action.payload,
        filteredPlugins: toOptions(action.payload.pluginTypeNames),
        filteredMessages: toOptions(action.payload.messageNames),
        filteredEntities: toOptions(action.payload.entityNames),
      };
    case "filterSuggestions": {
      const { field, query } = action.payload;
      const key = field === "plugin" ? "filteredPlugins" : field === "message" ? "filteredMessages" : "filteredEntities";
      const source = field === "plugin" ? state.suggestions.pluginTypeNames : field === "message" ? state.suggestions.messageNames : state.suggestions.entityNames;
      return { ...state, [key]: filterOptions(source, query) };
    }
    case "suggestions:error":
      return { ...state, error: action.payload };
    case "clear":
      return { ...state, logs: [], selected: null, error: null, retrieved: false, filter: defaultFilter(), durationMs: null };
    case "changeEnvironment:response":
      return action.payload?.envName
        ? { ...state, envName: action.payload.envName }
        : state;
  }
  return state;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortTypeName(typename: string): string {
  return typename.split(",")?.[0] ?? typename;
}

function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) { return "\u2014"; }
  if (ms >= 1000) { return `${(ms / 1000).toFixed(1)}s`; }
  return `${ms}ms`;
}

// ── Root component ────────────────────────────────────────────────────────────

export function TraceLogApp(): React.ReactElement {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { envName, logs, retrieved, loading, error, filter, selected, filteredPlugins, filteredMessages, filteredEntities, durationMs } = state;
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const adapter = useTraceLogAdapter();

  const retrieve = useCallback((f: Filter) => {
    dispatch({ type: "retrieve", payload: f, meta: { toExtension: true } });
  }, []);

  useEffect(() => {
    dispatch({ type: "ready", meta: { toExtension: true } });
    dispatch({ type: "suggestions", meta: { toExtension: true } });
  }, []);

  const handleRetrieve = (): void => retrieve(filter);

  const handleClear = (): void => {
    dispatch({ type: "clear" });
  };

  const handleChangeEnv = (): void => {
    dispatch({ type: "changeEnvironment", meta: { toExtension: true } } as any);
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === "Enter" && !loading) {
      e.preventDefault();
      handleRetrieve();
    }
  };

  const handleCopy = (text: string, field: string): void => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  function renderDetailMeta(log: TraceLog): React.ReactElement {
    return (
      <div className="detail-meta">
        <span>{shortTypeName(log.typename)}</span>
        <span>{log.messagename}</span>
        <span>{log.primaryentity ?? "\u2014"}</span>
        <span>{log["mode@OData.Community.Display.V1.FormattedValue"]}</span>
        <span>depth {log.depth}</span>
        {log.performanceexecutionduration !== undefined && (
          <span>{formatDuration(log.performanceexecutionduration)}</span>
        )}
        {log.correlationid && (
          <span className="mono" title="Correlation ID">{log.correlationid}</span>
        )}
      </div>
    );
  }

  function renderDetailPane(log: TraceLog): React.ReactElement {
    return (
      <div className="detail-pane">
        <div className="detail-header">
          <span className="detail-header-title">Trace Details</span>
          <IconButton
            icon="close"
            label="Close detail pane"
            onClick={() => dispatch({ type: "setSelected", payload: null })}
          />
        </div>
        <SplitView direction="vertical" initialRatio={log.exceptiondetails ? 0.5 : 1} min={80}>
          <section className="detail-section">
            <div className="detail-section-header">
              <h3 className="detail-heading">Trace Message</h3>
              {log.messageblock && (
                <IconButton
                  icon={copiedField === "trace" ? "check" : "copy"}
                  label="Copy trace message"
                  onClick={() => handleCopy(log.messageblock!, "trace")}
                />
              )}
            </div>
            {renderDetailMeta(log)}
            <textarea className="detail-pre" wrap="off" readOnly value={log.messageblock || "(no trace output)"} />
          </section>
          {log.exceptiondetails ? (
            <section className="detail-section exception">
              <div className="detail-section-header">
                <h3 className="detail-heading error-heading">Exception</h3>
                <IconButton
                  icon={copiedField === "exception" ? "check" : "copy"}
                  label="Copy exception details"
                  onClick={() => handleCopy(log.exceptiondetails!, "exception")}
                />
              </div>
              <textarea className="detail-pre exception-pre" wrap="off" readOnly value={log.exceptiondetails} />
            </section>
          ) : undefined}
        </SplitView>
      </div>
    );
  }

  const rowCount = retrieved && !loading ? (logs?.length ?? null) : null;
  const statusMessages: string[] = [];
  if (rowCount !== null && rowCount === filter.maxCount) {
    statusMessages.push(`Result limit reached (max ${filter.maxCount})`);
  }

  const emptyMessage = !retrieved && !loading
    ? "Set filters and click Retrieve Logs"
    : "No trace logs found";

  return (
    <div className="app" onKeyDown={handleKeyDown}>
      {/* ── Filter panel ── */}
      <div className="filter-panel">
        {envName && (
          <EnvironmentBar envName={envName} onChangeEnv={handleChangeEnv} />
        )}
        <div className="filter-grid">
          <FilterField label="Plugin">
            <Autocomplete
              fieldId="filter-plugin"
              options={filteredPlugins}
              value={filter.pluginTypeName ? { key: filter.pluginTypeName, label: filter.pluginTypeName } : null}
              onSearch={(q) => dispatch({ type: "filterSuggestions", payload: { field: "plugin", query: q } })}
              onSelect={(opt) => dispatch({ type: "setFilter", payload: { pluginTypeName: opt?.label ?? "" } })}
              placeholder="Type name (partial match)"
              clearOnBlur={false}
              debounceMs={0}
            />
          </FilterField>
          <FilterField label="Message">
            <Autocomplete
              fieldId="filter-message"
              options={filteredMessages}
              value={filter.messageName ? { key: filter.messageName, label: filter.messageName } : null}
              onSearch={(q) => dispatch({ type: "filterSuggestions", payload: { field: "message", query: q } })}
              onSelect={(opt) => dispatch({ type: "setFilter", payload: { messageName: opt?.label ?? "" } })}
              placeholder="e.g. Create"
              clearOnBlur={false}
              debounceMs={0}
            />
          </FilterField>
          <FilterField label="Entity">
            <Autocomplete
              fieldId="filter-entity"
              options={filteredEntities}
              value={filter.entityName ? { key: filter.entityName, label: filter.entityName } : null}
              onSearch={(q) => dispatch({ type: "filterSuggestions", payload: { field: "entity", query: q } })}
              onSelect={(opt) => dispatch({ type: "setFilter", payload: { entityName: opt?.label ?? "" } })}
              placeholder="e.g. account"
              clearOnBlur={false}
              debounceMs={0}
            />
          </FilterField>
          <FilterField label="Correlation ID">
            <input
              type="text"
              className="correlation-input"
              value={filter.correlationId}
              placeholder="GUID"
              onChange={(e) => dispatch({ type: "setFilter", payload: { correlationId: e.target.value } })}
            />
          </FilterField>
          <FilterField label="Date From">
            <DateInput
              fieldId="filter-date-from"
              value={filter.dateFrom}
              onChange={(v) => dispatch({ type: "setFilter", payload: { dateFrom: v } })}
            />
          </FilterField>
          <FilterField label="Date To">
            <DateInput
              fieldId="filter-date-to"
              value={filter.dateTo}
              onChange={(v) => dispatch({ type: "setFilter", payload: { dateTo: v } })}
            />
          </FilterField>
          <FilterField label="Max">
            <input
              type="number"
              min={1}
              max={5000}
              value={filter.maxCount}
              onChange={(e) => dispatch({ type: "setFilter", payload: { maxCount: parseInt(e.target.value) || 50 } })}
              style={{ width: 80 }}
            />
          </FilterField>
          <div className="filter-check">
            <label>
              <input
                type="checkbox"
                checked={filter.exceptionsOnly}
                onChange={(e) => dispatch({ type: "setFilter", payload: { exceptionsOnly: e.target.checked } })}
              />
              {" "}Exceptions only
            </label>
          </div>
        </div>
        <div className="filter-actions">
          <button className="primary" onClick={handleRetrieve} disabled={loading} >
            <Codicon name={loading ? "loading~spin" : "search"} />
            {loading ? " Loading\u2026" : " Retrieve Logs"}
          </button>
          <button className="secondary" onClick={handleClear} disabled={loading}>
            Clear
          </button>
        </div>
      </div>

      {/* ── Main area: table (full width) or table + detail (split) ── */}
      <SplitView initialRatio={0.55} min={200}>
        <div className="table-pane">
          {loading && <div className="progress-bar" />}
          <ResultsViewer<TraceLog>
            columns={adapter.columns}
            rows={logs ?? []}
            keyFormatter={adapter.keyFormatter}
            rowClassName={adapter.rowClassName}
            selectedKeys={selected ? [selected.plugintracelogid] : []}
            onSelectionChange={(_keys, selectedRows) => dispatch({ type: "setSelected", payload: selectedRows[0] ?? null })}
            enableFilter={false}
            enableExport={true}
            enableCopy={true}
            enableStatusBar={false}
            exportFileName="trace-logs"
            emptyMessage={emptyMessage}
          />
        </div>
        {selected && renderDetailPane(selected)}
      </SplitView>

      {/* ── Status bar (always visible) ── */}
      <StatusBar
        rowCount={rowCount}
        durationMs={durationMs}
        messages={statusMessages}
        error={error}
        loading={loading}
      />
    </div>
  );
}
