import * as React from "react";
import { useEffect } from "react";
import { useReducer, TabBar, ResultsViewer } from "shared-views";
import type { TableColumnDefinition } from "shared-views/DataTable";
import "shared-views/results-viewer.css";
import type {
  EntityAttribute,
  EntityRelationships,
  EntityForm,
  EntityView,
} from "../../src/types/metadata";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = "attributes" | "relationships" | "forms" | "views";

interface AttributeRow {
  MetadataId: string;
  LogicalName: string;
  displayName: string;
  type: string;
  requiredLevel: string;
  custom: string;
}

interface RelationshipRow {
  MetadataId: string;
  SchemaName: string;
  type: "1:N" | "N:1" | "N:N";
  relatedEntity: string;
  foreignKey: string;
  custom: string;
}

interface FormRow {
  formid: string;
  name: string;
  formType: string;
  managed: string;
}

interface ViewRow {
  savedqueryid: string;
  name: string;
  viewType: string;
  isDefault: string;
  managed: string;
}

interface TabData<T> {
  rows: T[];
  loading: boolean;
  error: string | null;
  loaded: boolean;
}

function emptyTab<T>(): TabData<T> {
  return { rows: [], loading: false, error: null, loaded: false };
}

// ── State & Actions ───────────────────────────────────────────────────────────

interface State {
  envName: string;
  entityLogicalName: string;
  entityDisplayName?: string;
  activeTab: Tab;
  attributes: TabData<AttributeRow>;
  relationships: TabData<RelationshipRow>;
  forms: TabData<FormRow>;
  views: TabData<ViewRow>;
}

const initialState: State = {
  envName: "",
  entityLogicalName: "",
  activeTab: "attributes",
  attributes: emptyTab(),
  relationships: emptyTab(),
  forms: emptyTab(),
  views: emptyTab(),
};

type Action =
  | { type: "ready"; meta: { toExtension: true } }
  | { type: "init"; payload: { envName: string; entityLogicalName: string; entityDisplayName?: string; tab: Tab } }
  | { type: "switchTab"; payload: Tab }
  | { type: "retrieveAttributes"; meta: { toExtension: true } }
  | { type: "retrieveAttributes:response"; payload: EntityAttribute[] }
  | { type: "retrieveAttributes:error"; payload: string }
  | { type: "retrieveRelationships"; meta: { toExtension: true } }
  | { type: "retrieveRelationships:response"; payload: EntityRelationships }
  | { type: "retrieveRelationships:error"; payload: string }
  | { type: "retrieveForms"; meta: { toExtension: true } }
  | { type: "retrieveForms:response"; payload: EntityForm[] }
  | { type: "retrieveForms:error"; payload: string }
  | { type: "retrieveViews"; meta: { toExtension: true } }
  | { type: "retrieveViews:response"; payload: EntityView[] }
  | { type: "retrieveViews:error"; payload: string }
  | { type: "openViewDesigner"; payload: { savedqueryid: string; entityLogicalName: string; entityDisplayName?: string }; meta: { toExtension: true } }
  | { type: "openFormViewer"; payload: { formid: string; entityLogicalName: string; entityDisplayName?: string }; meta: { toExtension: true } };

// ── Row processors ────────────────────────────────────────────────────────────

const FORM_TYPE_LABELS: Record<number, string> = {
  2: "Main", 5: "Mobile Express", 6: "Quick View", 7: "Quick Create",
  8: "Dashboard", 11: "Dialog", 12: "Power BI Dashboard",
};

const VIEW_TYPE_LABELS: Record<number, string> = {
  0: "Public View", 1: "Advanced Find", 2: "Associated", 4: "Quick Find", 64: "Lookup",
};

function processAttributes(attrs: EntityAttribute[]): AttributeRow[] {
  return attrs.map((a) => ({
    MetadataId: a.MetadataId,
    LogicalName: a.LogicalName,
    displayName: a.DisplayName?.UserLocalizedLabel?.Label ?? a.DisplayName?.LocalizedLabels?.[0]?.Label ?? a.LogicalName,
    type: a.AttributeTypeName?.Value?.replace(/Type$/, "") ?? a.AttributeType,
    requiredLevel: a.RequiredLevel?.Value === "ApplicationRequired" ? "Required"
      : a.RequiredLevel?.Value === "SystemRequired" ? "System"
      : a.RequiredLevel?.Value === "Recommended" ? "Recommended"
      : "",
    custom: a.IsCustomAttribute ? "Yes" : "",
  }));
}

function processRelationships(data: EntityRelationships, entityLogicalName: string): RelationshipRow[] {
  const rows: RelationshipRow[] = [];
  for (const r of data.oneToMany) {
    rows.push({ MetadataId: r.MetadataId, SchemaName: r.SchemaName, type: "1:N", relatedEntity: r.ReferencingEntity, foreignKey: r.ReferencingAttribute, custom: r.IsCustomRelationship ? "Yes" : "" });
  }
  for (const r of data.manyToOne) {
    rows.push({ MetadataId: r.MetadataId, SchemaName: r.SchemaName, type: "N:1", relatedEntity: r.ReferencedEntity, foreignKey: r.ReferencingAttribute, custom: r.IsCustomRelationship ? "Yes" : "" });
  }
  for (const r of data.manyToMany) {
    const related = r.Entity1LogicalName === entityLogicalName ? r.Entity2LogicalName : r.Entity1LogicalName;
    rows.push({ MetadataId: r.MetadataId, SchemaName: r.SchemaName, type: "N:N", relatedEntity: related, foreignKey: "", custom: r.IsCustomRelationship ? "Yes" : "" });
  }
  return rows.sort((a, b) => a.SchemaName.localeCompare(b.SchemaName));
}

// ── Reducer ───────────────────────────────────────────────────────────────────

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "init": {
      const { envName, entityLogicalName, entityDisplayName, tab } = action.payload;
      // If entity changed, reset all tab data
      const entityChanged = entityLogicalName !== state.entityLogicalName;
      return {
        ...(entityChanged ? initialState : state),
        envName,
        entityLogicalName,
        entityDisplayName,
        activeTab: tab,
      };
    }
    case "switchTab":
      return { ...state, activeTab: action.payload };

    case "retrieveAttributes":
      return { ...state, attributes: { ...state.attributes, loading: true, error: null } };
    case "retrieveAttributes:response":
      return { ...state, attributes: { rows: processAttributes(action.payload), loading: false, error: null, loaded: true } };
    case "retrieveAttributes:error":
      return { ...state, attributes: { ...state.attributes, loading: false, error: action.payload } };

    case "retrieveRelationships":
      return { ...state, relationships: { ...state.relationships, loading: true, error: null } };
    case "retrieveRelationships:response":
      return { ...state, relationships: { rows: processRelationships(action.payload, state.entityLogicalName), loading: false, error: null, loaded: true } };
    case "retrieveRelationships:error":
      return { ...state, relationships: { ...state.relationships, loading: false, error: action.payload } };

    case "retrieveForms":
      return { ...state, forms: { ...state.forms, loading: true, error: null } };
    case "retrieveForms:response":
      return { ...state, forms: { rows: action.payload.map((f) => ({ formid: f.formid, name: f.name, formType: FORM_TYPE_LABELS[f.type] ?? `Type ${f.type}`, managed: f.ismanaged ? "Yes" : "" })), loading: false, error: null, loaded: true } };
    case "retrieveForms:error":
      return { ...state, forms: { ...state.forms, loading: false, error: action.payload } };

    case "retrieveViews":
      return { ...state, views: { ...state.views, loading: true, error: null } };
    case "retrieveViews:response":
      return { ...state, views: { rows: action.payload.map((v) => ({ savedqueryid: v.savedqueryid, name: v.name, viewType: VIEW_TYPE_LABELS[v.querytype] ?? `Type ${v.querytype}`, isDefault: v.isdefault ? "Yes" : "", managed: v.ismanaged ? "Yes" : "" })), loading: false, error: null, loaded: true } };
    case "retrieveViews:error":
      return { ...state, views: { ...state.views, loading: false, error: action.payload } };
  }
  return state;
}

// ── Column definitions ────────────────────────────────────────────────────────

const ATTR_COLS: TableColumnDefinition<AttributeRow>[] = [
  { key: "displayName", label: "Display Name" },
  { key: "LogicalName", label: "Logical Name" },
  { key: "type", label: "Type" },
  { key: "requiredLevel", label: "Required" },
  { key: "custom", label: "Custom" },
];

const REL_COLS: TableColumnDefinition<RelationshipRow>[] = [
  { key: "SchemaName", label: "Schema Name" },
  { key: "type", label: "Type" },
  { key: "relatedEntity", label: "Related Entity" },
  { key: "foreignKey", label: "Foreign Key" },
  { key: "custom", label: "Custom" },
];

const FORM_COLS: TableColumnDefinition<FormRow>[] = [
  { key: "name", label: "Name", isLink: true },
  { key: "formType", label: "Type" },
  { key: "managed", label: "Managed" },
];

const VIEW_COLS: TableColumnDefinition<ViewRow>[] = [
  { key: "name", label: "Name", isLink: true },
  { key: "viewType", label: "Type" },
  { key: "isDefault", label: "Default" },
  { key: "managed", label: "Managed" },
];

// ── Tab config ────────────────────────────────────────────────────────────────

const TABS = [
  { id: "attributes",    label: "Attributes" },
  { id: "relationships", label: "Relationships" },
  { id: "forms",         label: "Forms" },
  { id: "views",         label: "Views" },
] as const;

const RETRIEVE_ACTION: Record<Tab, Action["type"]> = {
  attributes:    "retrieveAttributes",
  relationships: "retrieveRelationships",
  forms:         "retrieveForms",
  views:         "retrieveViews",
};

// ── Component ─────────────────────────────────────────────────────────────────

export function EntityMetadataApp(): React.ReactElement {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { envName, entityLogicalName, entityDisplayName, activeTab } = state;
  const activeTabData = state[activeTab];

  // Signal ready on mount
  useEffect(() => {
    dispatch({ type: "ready", meta: { toExtension: true } });
  }, []);

  // Lazy-load active tab whenever entity or tab changes
  useEffect(() => {
    if (!entityLogicalName) { return; }
    const tabData = state[activeTab];
    if (!tabData.loaded && !tabData.loading) {
      dispatch({ type: RETRIEVE_ACTION[activeTab] as any, meta: { toExtension: true } });
    }
  }, [activeTab, entityLogicalName]);

  const handleTabChange = (id: string): void => {
    dispatch({ type: "switchTab", payload: id as Tab });
  };

  const entityLabel = entityDisplayName
    ? `${entityDisplayName} (${entityLogicalName})`
    : entityLogicalName;

  return (
    <div className="entity-metadata-app">
      {/* ── Breadcrumb header ── */}
      <div className="entity-breadcrumb">
        <span className="entity-breadcrumb-name">{entityLabel}</span>
        {envName && <span className="entity-breadcrumb-env">{envName}</span>}
      </div>

      {/* ── Tab navigation ── */}
      <TabBar tabs={TABS as unknown as { id: string; label: string }[]} active={activeTab} onChange={handleTabChange} />

      {/* ── Loading bar ── */}
      {activeTabData.loading && <div className="em-progress-bar" />}

      {/* ── Tab content ── */}
      <div className="entity-metadata-content">
        {activeTab === "attributes" && (
          <ResultsViewer<AttributeRow>
            columns={ATTR_COLS}
            rows={state.attributes.rows}
            keyFormatter={(r) => r.MetadataId}
            enableFilter enableExport enableCopy
            exportFileName={`${entityLogicalName}-attributes`}
            emptyMessage={state.attributes.loading ? "Loading\u2026" : "No attributes found"}
            error={state.attributes.error}
            loading={state.attributes.loading}
          />
        )}
        {activeTab === "relationships" && (
          <ResultsViewer<RelationshipRow>
            columns={REL_COLS}
            rows={state.relationships.rows}
            keyFormatter={(r) => r.MetadataId}
            enableFilter enableExport enableCopy
            exportFileName={`${entityLogicalName}-relationships`}
            emptyMessage={state.relationships.loading ? "Loading\u2026" : "No relationships found"}
            error={state.relationships.error}
            loading={state.relationships.loading}
          />
        )}
        {activeTab === "forms" && (
          <ResultsViewer<FormRow>
            columns={FORM_COLS}
            rows={state.forms.rows}
            keyFormatter={(r) => r.formid}
            enableFilter enableExport enableCopy
            exportFileName={`${entityLogicalName}-forms`}
            emptyMessage={state.forms.loading ? "Loading\u2026" : "No forms found"}
            error={state.forms.error}
            loading={state.forms.loading}
            onCellClick={(_col, row) => {
              dispatch({
                type: "openFormViewer",
                payload: { formid: row.formid, entityLogicalName, entityDisplayName },
                meta: { toExtension: true },
              });
            }}
          />
        )}
        {activeTab === "views" && (
          <ResultsViewer<ViewRow>
            columns={VIEW_COLS}
            rows={state.views.rows}
            keyFormatter={(r) => r.savedqueryid}
            enableFilter enableExport enableCopy
            exportFileName={`${entityLogicalName}-views`}
            emptyMessage={state.views.loading ? "Loading\u2026" : "No views found"}
            error={state.views.error}
            loading={state.views.loading}
            onCellClick={(_col, row) => {
              dispatch({
                type: "openViewDesigner",
                payload: { savedqueryid: row.savedqueryid, entityLogicalName, entityDisplayName },
                meta: { toExtension: true },
              });
            }}
          />
        )}
      </div>
    </div>
  );
}
