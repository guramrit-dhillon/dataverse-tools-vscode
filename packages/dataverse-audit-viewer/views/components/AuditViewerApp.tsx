import * as React from "react";
import { useEffect, useCallback, useMemo, useState } from "react";
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
import { useAuditAdapter, flattenAuditRows, type AuditRow, type FlatAuditRow } from "../adapters/auditAdapter";
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

interface AuditStatusState {
  orgId: string | null;
  orgAuditEnabled: boolean | null;
  orgAuditLoading: boolean;
  userAccessAuditEnabled: boolean | null;
  userAccessAuditLoading: boolean;
  entityMetadataId: string | null;
  entityAuditEnabled: boolean | null;
  entityAuditLoading: boolean;
  entityAuditEntity: string | null; // which entity the status was loaded for
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
  auditStatus: AuditStatusState;
}

const initialAuditStatus: AuditStatusState = {
  orgId: null,
  orgAuditEnabled: null,
  orgAuditLoading: false,
  userAccessAuditEnabled: null,
  userAccessAuditLoading: false,
  entityMetadataId: null,
  entityAuditEnabled: null,
  entityAuditLoading: false,
  entityAuditEntity: null,
};

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
  auditStatus: initialAuditStatus,
};

type Action =
  | { type: "init"; payload: { envName: string; entityLogicalName?: string } }
  | { type: "ready"; meta: { toExtension: true } }
  | { type: "setFilter"; payload: Partial<Pick<State, "entityLogicalName" | "recordId" | "maxCount">> }
  | { type: "entitySearch"; meta: { toExtension: true } }
  | { type: "entitySearch:response"; payload: EntityOption[] }
  | { type: "entitySearch:error"; payload: string }
  | { type: "filterEntities"; payload: string }
  | { type: "retrieve"; payload: { entityLogicalName?: string; recordId?: string; maxCount: number }; meta: { toExtension: true } }
  | { type: "retrieve:response"; payload: AuditRow[] }
  | { type: "retrieve:error"; payload: string }
  | { type: "setSelected"; payload: AuditRow | null }
  | { type: "getDetails"; payload: { auditId: string }; meta: { toExtension: true } }
  | { type: "getDetails:response"; payload: AuditChange[] }
  | { type: "getDetails:error"; payload: string }
  | { type: "clear" }
  | { type: "changeEnvironment"; meta: { toExtension: true } }
  | { type: "changeEnvironment:response"; payload: { envName: string } }
  | { type: "manageEntityAuditing"; meta: { toExtension: true } }
  | { type: "manageEntityAuditing:response"; payload: { enabled: number; disabled: number } | null }
  | { type: "manageEntityAuditing:error"; payload: string }
  // Org audit status
  | { type: "getOrgAuditStatus"; meta: { toExtension: true } }
  | { type: "getOrgAuditStatus:response"; payload: { orgId: string; isEnabled: boolean } }
  | { type: "getOrgAuditStatus:error"; payload: string }
  | { type: "setOrgAuditStatus"; payload: { orgId: string; isEnabled: boolean }; meta: { toExtension: true } }
  | { type: "setOrgAuditStatus:response"; payload: { isEnabled: boolean } }
  | { type: "setOrgAuditStatus:error"; payload: string }
  // User access audit status
  | { type: "setUserAccessAuditStatus"; payload: { orgId: string; isEnabled: boolean }; meta: { toExtension: true } }
  | { type: "setUserAccessAuditStatus:response"; payload: { isEnabled: boolean } }
  | { type: "setUserAccessAuditStatus:error"; payload: string }
  // Entity audit status
  | { type: "getEntityAuditStatus"; payload: { entityLogicalName: string }; meta: { toExtension: true } }
  | { type: "getEntityAuditStatus:response"; payload: { metadataId: string; isEnabled: boolean } }
  | { type: "getEntityAuditStatus:error"; payload: string }
  | { type: "setEntityAuditStatus"; payload: { metadataId: string; entityLogicalName: string; isEnabled: boolean }; meta: { toExtension: true } }
  | { type: "setEntityAuditStatus:response"; payload: { isEnabled: boolean } }
  | { type: "setEntityAuditStatus:error"; payload: string };

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
        auditStatus: initialAuditStatus,
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
        auditStatus: {
          ...state.auditStatus,
          entityMetadataId: null,
          entityAuditEnabled: null,
          entityAuditLoading: false,
          entityAuditEntity: null,
        },
      };
    case "manageEntityAuditing":
      return state;
    case "manageEntityAuditing:response":
      // Reset entity list so audit-status changes are reflected next time the picker opens
      return { ...state, entities: [], entitiesLoaded: false, filteredEntities: [] };
    case "manageEntityAuditing:error":
      return state;
    case "changeEnvironment:response":
      return action.payload?.envName
        ? {
          ...state,
          envName: action.payload.envName,
          entities: [],
          entitiesLoaded: false,
          auditStatus: initialAuditStatus,
        }
        : state;
    // Org audit status
    case "getOrgAuditStatus":
      return { ...state, auditStatus: { ...state.auditStatus, orgAuditLoading: true } };
    case "getOrgAuditStatus:response":
      return {
        ...state,
        auditStatus: {
          ...state.auditStatus,
          orgId: action.payload.orgId,
          orgAuditEnabled: action.payload.isEnabled,
          userAccessAuditEnabled: (action.payload as any).isUserAccessAuditEnabled ?? state.auditStatus.userAccessAuditEnabled,
          orgAuditLoading: false,
        },
      };
    case "getOrgAuditStatus:error":
      return { ...state, auditStatus: { ...state.auditStatus, orgAuditLoading: false } };
    case "setOrgAuditStatus":
      return { ...state, auditStatus: { ...state.auditStatus, orgAuditLoading: true } };
    case "setOrgAuditStatus:response":
      return {
        ...state,
        auditStatus: { ...state.auditStatus, orgAuditEnabled: action.payload.isEnabled, orgAuditLoading: false },
      };
    case "setOrgAuditStatus:error":
      return { ...state, auditStatus: { ...state.auditStatus, orgAuditLoading: false } };
    // User access audit status
    case "setUserAccessAuditStatus":
      return { ...state, auditStatus: { ...state.auditStatus, userAccessAuditLoading: true } };
    case "setUserAccessAuditStatus:response":
      return {
        ...state,
        auditStatus: { ...state.auditStatus, userAccessAuditEnabled: action.payload.isEnabled, userAccessAuditLoading: false },
      };
    case "setUserAccessAuditStatus:error":
      return { ...state, auditStatus: { ...state.auditStatus, userAccessAuditLoading: false } };
    // Entity audit status
    case "getEntityAuditStatus":
      return {
        ...state,
        auditStatus: {
          ...state.auditStatus,
          entityAuditLoading: true,
          entityAuditEnabled: null,
          entityMetadataId: null,
          entityAuditEntity: action.payload.entityLogicalName,
        },
      };
    case "getEntityAuditStatus:response":
      return {
        ...state,
        auditStatus: {
          ...state.auditStatus,
          entityMetadataId: action.payload.metadataId,
          entityAuditEnabled: action.payload.isEnabled,
          entityAuditLoading: false,
        },
      };
    case "getEntityAuditStatus:error":
      return { ...state, auditStatus: { ...state.auditStatus, entityAuditLoading: false } };
    case "setEntityAuditStatus":
      return { ...state, auditStatus: { ...state.auditStatus, entityAuditLoading: true } };
    case "setEntityAuditStatus:response":
      return {
        ...state,
        auditStatus: { ...state.auditStatus, entityAuditEnabled: action.payload.isEnabled, entityAuditLoading: false },
      };
    case "setEntityAuditStatus:error":
      return { ...state, auditStatus: { ...state.auditStatus, entityAuditLoading: false } };
  }
  return state;
}

// ── AuditStatusInline component ───────────────────────────────────────────────

interface AuditStatusInlineProps {
  label: string;
  enabled: boolean | null;
  loading: boolean;
  onToggle: () => void;
}

function AuditStatusInline({ label, enabled, loading, onToggle }: AuditStatusInlineProps): React.ReactElement {
  return (
    <div className="audit-inline">
      <span className="audit-inline-label">{label}</span>
      {loading ? (
        <>
          <Codicon name="loading~spin" />
          <span className="audit-inline-checking">Checking…</span>
        </>
      ) : enabled === null ? (
        <span className="audit-inline-unknown">—</span>
      ) : (
        <>
          <Codicon name="circle-filled" className={`audit-dot ${enabled ? "dot-on" : "dot-off"}`} />
          <span className="audit-inline-value">{enabled ? "on" : "off"}</span>
          <button className="audit-inline-btn" onClick={onToggle}>
            {enabled ? "Disable" : "Enable"}
          </button>
        </>
      )}
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

export function AuditViewerApp(): React.ReactElement {
  const [state, dispatch] = useReducer(reducer, initialState);
  const {
    envName, entityLogicalName, recordId, maxCount,
    filteredEntities, entitiesLoaded,
    auditRecords, loading, retrieved, error, selected,
    detailChanges, detailLoading, durationMs,
    auditStatus,
  } = state;
  const adapter = useAuditAdapter();
  const flatAuditRows = useMemo(() => flattenAuditRows(auditRecords), [auditRecords]);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const retrieve = useCallback(() => {
    dispatch({
      type: "retrieve",
      payload: { entityLogicalName: entityLogicalName || undefined, recordId: recordId || undefined, maxCount },
      meta: { toExtension: true },
    });
  }, [entityLogicalName, recordId, maxCount]);

  useEffect(() => {
    dispatch({ type: "ready", meta: { toExtension: true } });
  }, []);

  // Load org audit status on ready
  useEffect(() => {
    dispatch({ type: "getOrgAuditStatus", meta: { toExtension: true } });
  }, []);

  // When environment changes, reload org audit status
  useEffect(() => {
    if (envName) {
      dispatch({ type: "getOrgAuditStatus", meta: { toExtension: true } });
    }
  }, [envName]);

  // When entity changes, load entity audit status
  useEffect(() => {
    if (entityLogicalName && entityLogicalName !== auditStatus.entityAuditEntity) {
      dispatch({
        type: "getEntityAuditStatus",
        payload: { entityLogicalName },
        meta: { toExtension: true },
      });
    }
    if (!entityLogicalName) {
      // Clear entity status when entity is cleared
      dispatch({ type: "setFilter", payload: {} });
    }
  }, [entityLogicalName]);

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

  const handleToggleOrgAudit = (): void => {
    if (auditStatus.orgId === null || auditStatus.orgAuditEnabled === null || auditStatus.orgAuditLoading) { return; }
    dispatch({
      type: "setOrgAuditStatus",
      payload: { orgId: auditStatus.orgId, isEnabled: !auditStatus.orgAuditEnabled },
      meta: { toExtension: true },
    });
  };

  const handleToggleUserAccessAudit = (): void => {
    if (auditStatus.orgId === null || auditStatus.userAccessAuditEnabled === null || auditStatus.userAccessAuditLoading) { return; }
    dispatch({
      type: "setUserAccessAuditStatus",
      payload: { orgId: auditStatus.orgId, isEnabled: !auditStatus.userAccessAuditEnabled },
      meta: { toExtension: true },
    });
  };

  const handleToggleEntityAudit = (): void => {
    if (!auditStatus.entityMetadataId || auditStatus.entityAuditEnabled === null || auditStatus.entityAuditLoading) { return; }
    dispatch({
      type: "setEntityAuditStatus",
      payload: {
        metadataId: auditStatus.entityMetadataId,
        entityLogicalName,
        isEnabled: !auditStatus.entityAuditEnabled,
      },
      meta: { toExtension: true },
    });
  };

  const rowCount = retrieved && !loading ? auditRecords.length : null;
  const statusMessages: string[] = [];
  if (rowCount !== null && rowCount === maxCount) {
    statusMessages.push(`Result limit reached (max ${maxCount})`);
  }

  const emptyMessage = !retrieved && !loading
    ? "Set filters and click Retrieve, or click Retrieve to load all recent audit records"
    : "No audit records found";

  return (
    <div className="app" onKeyDown={handleKeyDown}>
      {/* ── Filter panel ── */}
      <div className="filter-panel">
        {envName && (
          <div className="env-audit-row">
            <AuditStatusInline
              label="Auditing"
              enabled={auditStatus.orgAuditEnabled}
              loading={auditStatus.orgAuditLoading}
              onToggle={handleToggleOrgAudit}
            />
            <AuditStatusInline
              label="User Access"
              enabled={auditStatus.userAccessAuditEnabled}
              loading={auditStatus.userAccessAuditLoading}
              onToggle={handleToggleUserAccessAudit}
            />
            <div className="env-audit-separator" />
            <EnvironmentBar envName={envName} onChangeEnv={handleChangeEnv} />
          </div>
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
              placeholder="Search entities…"
              clearOnBlur={false}
              debounceMs={0}
            />
          </FilterField>
          <FilterField label="Record ID">
            <input
              type="text"
              className="record-id-input"
              value={recordId}
              placeholder="Enter record GUID (optional)"
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
          <button className="primary" onClick={retrieve} disabled={loading}>
            <Codicon name={loading ? "loading~spin" : "search"} />
            {loading ? " Loading\u2026" : " Retrieve"}
          </button>
          <button className="secondary" onClick={handleClear} disabled={loading}>
            Clear
          </button>
          <button
            className="secondary"
            onClick={() => dispatch({ type: "manageEntityAuditing", meta: { toExtension: true } })}
            title="Manage entity auditing"
            disabled={loading}
          >
            <Codicon name="checklist" /> Manage Auditing
          </button>
          {entityLogicalName && (
            <AuditStatusInline
              label="Entity auditing"
              enabled={auditStatus.entityAuditEnabled}
              loading={auditStatus.entityAuditLoading}
              onToggle={handleToggleEntityAudit}
            />
          )}
        </div>
      </div>

      {/* ── Main area: table + detail split ── */}
      <SplitView initialRatio={0.45} min={200}>
        <div className="table-pane">
          {loading && <div className="progress-bar" />}
          <ResultsViewer<FlatAuditRow>
            columns={adapter.columns}
            rows={flatAuditRows}
            keyFormatter={adapter.keyFormatter}
            rowClassName={adapter.rowClassName}
            selectedKeys={selected ? flatAuditRows.filter((r) => r.audit.auditid === selected.auditid).map((r) => r.rowKey) : []}
            onSelectionChange={(_keys, selectedRows) =>
              dispatch({ type: "setSelected", payload: selectedRows[0]?.audit ?? null })
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
