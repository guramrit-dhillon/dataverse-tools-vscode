import * as React from "react";
import { useEffect, useCallback, useState } from "react";
import {
  useReducer,
  SplitView,
  Autocomplete,
  FilterField,
  EnvironmentBar,
  Codicon,
  IconButton,
  ResultsViewer,
  type AutocompleteOption,
} from "shared-views";
import StatusBar from "shared-views/StatusBar";
import "shared-views/filter-field.css";
import "shared-views/environment-bar.css";
import "shared-views/status-bar.css";
import "shared-views/results-viewer.css";
import { useAuditAdapter, type AuditRow } from "../adapters/auditAdapter";
import { AuditDiffView } from "./AuditDiffView";

// ── Types ─────────────────────────────────────────────────────────────────────

interface EntityOption {
  logicalName: string;
  displayName: string;
}

interface AuditChange {
  attributeName: string;
  displayName: string;
  oldValue: string | null;
  newValue: string | null;
}

interface State {
  envName: string;
  entityLogicalName: string;
  recordId: string;
  maxCount: number;
  entities: EntityOption[];
  entitiesLoading: boolean;
  entitiesLoaded: boolean;
  filteredEntities: AutocompleteOption[];
  auditRecords: AuditRow[];
  loading: boolean;
  retrieved: boolean;
  selected: AuditRow | null;
  detailChanges: AuditChange[] | null;
  detailLoading: boolean;
  error: string | null;
  durationMs: number | null;
}

const initialState: State = {
  envName: "",
  entityLogicalName: "",
  recordId: "",
  maxCount: 50,
  entities: [],
  entitiesLoading: false,
  entitiesLoaded: false,
  filteredEntities: [],
  auditRecords: [],
  loading: false,
  retrieved: false,
  selected: null,
  detailChanges: null,
  detailLoading: false,
  error: null,
  durationMs: null,
};

type Action =
  | { type: "init"; payload: { envName: string; entityLogicalName?: string } }
  | { type: "ready"; meta: { toExtension: true } }
  | { type: "setFilter"; payload: Partial<Pick<State, "entityLogicalName" | "recordId" | "maxCount">> }
  | { type: "entitySearch"; meta: { toExtension: true } }
  | { type: "entitySearch:response"; payload: EntityOption[] }
  | { type: "entitySearch:error"; payload: string }
  | { type: "filterEntities"; payload: string }
  | { type: "retrieve"; payload: { entityLogicalName: string; recordId: string; maxCount: number }; meta: { toExtension: true } }
  | { type: "retrieve:response"; payload: AuditRow[] }
  | { type: "retrieve:error"; payload: string }
  | { type: "setSelected"; payload: AuditRow | null }
  | { type: "getDetails"; payload: { auditId: string }; meta: { toExtension: true } }
  | { type: "getDetails:response"; payload: AuditChange[] }
  | { type: "getDetails:error"; payload: string }
  | { type: "clear" }
  | { type: "changeEnvironment"; meta: { toExtension: true } }
  | { type: "changeEnvironment:response"; payload: { envName: string } };

// ── Helpers ───────────────────────────────────────────────────────────────────

function toEntityOptions(entities: EntityOption[]): AutocompleteOption[] {
  return entities.map((e) => ({
    key: e.logicalName,
    label: `${e.displayName} (${e.logicalName})`,
  }));
}

function filterEntityOptions(entities: EntityOption[], query: string): AutocompleteOption[] {
  const q = query.toLowerCase();
  const filtered = q
    ? entities.filter((e) =>
      e.logicalName.toLowerCase().includes(q) ||
        e.displayName.toLowerCase().includes(q))
    : entities;
  return toEntityOptions(filtered);
}

// ── Reducer ──────────────────────────────────────────────────────────────────

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "init": {
      const { envName, entityLogicalName } = action.payload ?? {};
      return {
        ...state,
        envName: envName ?? state.envName,
        entityLogicalName: entityLogicalName ?? state.entityLogicalName,
      };
    }
    case "setFilter":
      return { ...state, ...action.payload };
    case "entitySearch":
      return { ...state, entitiesLoading: true };
    case "entitySearch:response":
      return {
        ...state,
        entities: action.payload,
        entitiesLoading: false,
        entitiesLoaded: true,
        filteredEntities: toEntityOptions(action.payload),
      };
    case "entitySearch:error":
      return { ...state, entitiesLoading: false, error: action.payload };
    case "filterEntities":
      return { ...state, filteredEntities: filterEntityOptions(state.entities, action.payload) };
    case "retrieve":
      return { ...state, loading: true, error: null, durationMs: null };
    case "retrieve:response":
      return { ...state, auditRecords: action.payload, loading: false, retrieved: true, selected: null, detailChanges: null };
    case "retrieve:error":
      return { ...state, error: action.payload, loading: false };
    case "setSelected":
      return { ...state, selected: action.payload, detailChanges: null, detailLoading: action.payload !== null };
    case "getDetails:response":
      return { ...state, detailChanges: action.payload, detailLoading: false };
    case "getDetails:error":
      return { ...state, detailLoading: false, error: action.payload };
    case "clear":
      return {
        ...state,
        auditRecords: [],
        selected: null,
        detailChanges: null,
        detailLoading: false,
        error: null,
        retrieved: false,
        entityLogicalName: "",
        recordId: "",
        maxCount: 50,
        durationMs: null,
      };
    case "changeEnvironment:response":
      return action.payload?.envName
        ? { ...state, envName: action.payload.envName, entities: [], entitiesLoaded: false }
        : state;
  }
  return state;
}

// ── Root component ────────────────────────────────────────────────────────────

export function AuditViewerApp(): React.ReactElement {
  const [state, dispatch] = useReducer(reducer, initialState);
  const {
    envName, entityLogicalName, recordId, maxCount,
    filteredEntities, entitiesLoaded,
    auditRecords, loading, retrieved, error, selected,
    detailChanges, detailLoading, durationMs,
  } = state;
  const adapter = useAuditAdapter();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const retrieve = useCallback(() => {
    if (!entityLogicalName || !recordId) { return; }
    dispatch({
      type: "retrieve",
      payload: { entityLogicalName, recordId, maxCount },
      meta: { toExtension: true },
    });
  }, [entityLogicalName, recordId, maxCount]);

  useEffect(() => {
    dispatch({ type: "ready", meta: { toExtension: true } });
  }, []);

  // When a row is selected, fetch its details from the extension
  useEffect(() => {
    if (selected) {
      dispatch({
        type: "getDetails",
        payload: { auditId: selected.auditid },
        meta: { toExtension: true },
      });
    }
  }, [selected?.auditid]);

  const loadEntities = useCallback(() => {
    if (!entitiesLoaded) {
      dispatch({ type: "entitySearch", meta: { toExtension: true } });
    }
  }, [entitiesLoaded]);

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === "Enter" && !loading) {
      e.preventDefault();
      retrieve();
    }
  };

  const handleChangeEnv = (): void => {
    dispatch({ type: "changeEnvironment", meta: { toExtension: true } } as any);
  };

  const handleClear = (): void => {
    dispatch({ type: "clear" });
  };

  const handleCopy = (text: string, field: string): void => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  const canRetrieve = entityLogicalName.length > 0 && recordId.length > 0;

  const rowCount = retrieved && !loading ? auditRecords.length : null;
  const statusMessages: string[] = [];
  if (rowCount !== null && rowCount === maxCount) {
    statusMessages.push(`Result limit reached (max ${maxCount})`);
  }

  const emptyMessage = !retrieved && !loading
    ? "Select an entity, enter a record ID, and click Retrieve"
    : "No audit records found for this record";

  return (
    <div className="app" onKeyDown={handleKeyDown}>
      {/* ── Filter panel ── */}
      <div className="filter-panel">
        {envName && (
          <EnvironmentBar envName={envName} onChangeEnv={handleChangeEnv} />
        )}
        <div className="filter-grid">
          <FilterField label="Entity">
            <Autocomplete
              fieldId="filter-entity"
              options={filteredEntities}
              value={entityLogicalName
                ? { key: entityLogicalName, label: entityLogicalName }
                : null}
              onSearch={(q) => {
                loadEntities();
                dispatch({ type: "filterEntities", payload: q });
              }}
              onSelect={(opt) => dispatch({
                type: "setFilter",
                payload: { entityLogicalName: opt?.key ?? "" },
              })}
              placeholder="Search auditable entities\u2026"
              clearOnBlur={false}
              debounceMs={0}
            />
          </FilterField>
          <FilterField label="Record ID">
            <input
              type="text"
              className="record-id-input"
              value={recordId}
              placeholder="Enter record GUID"
              onChange={(e) => dispatch({ type: "setFilter", payload: { recordId: e.target.value.trim() } })}
            />
          </FilterField>
          <FilterField label="Max">
            <input
              type="number"
              min={1}
              max={500}
              value={maxCount}
              onChange={(e) => dispatch({
                type: "setFilter",
                payload: { maxCount: parseInt(e.target.value) || 50 },
              })}
              style={{ width: 80 }}
            />
          </FilterField>
        </div>
        <div className="filter-actions">
          <button className="primary" onClick={retrieve} disabled={loading || !canRetrieve}>
            <Codicon name={loading ? "loading~spin" : "search"} />
            {loading ? " Loading\u2026" : " Retrieve"}
          </button>
          <button className="secondary" onClick={handleClear} disabled={loading}>
            Clear
          </button>
        </div>
      </div>

      {/* ── Main area: table + detail split ── */}
      <SplitView initialRatio={0.45} min={200}>
        <div className="table-pane">
          {loading && <div className="progress-bar" />}
          <ResultsViewer<AuditRow>
            columns={adapter.columns}
            rows={auditRecords}
            keyFormatter={adapter.keyFormatter}
            rowClassName={adapter.rowClassName}
            selectedKeys={selected ? [selected.auditid] : []}
            onSelectionChange={(_keys, selectedRows) =>
              dispatch({ type: "setSelected", payload: selectedRows[0] ?? null })
            }
            enableFilter={false}
            enableExport={true}
            enableCopy={true}
            enableStatusBar={false}
            exportFileName="audit-history"
            emptyMessage={emptyMessage}
          />
        </div>
        {selected && (
          <AuditDiffView
            record={selected}
            changes={detailChanges}
            detailLoading={detailLoading}
            onClose={() => dispatch({ type: "setSelected", payload: null })}
            onCopy={handleCopy}
            copiedField={copiedField}
          />
        )}
      </SplitView>

      {/* ── Status bar ── */}
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
