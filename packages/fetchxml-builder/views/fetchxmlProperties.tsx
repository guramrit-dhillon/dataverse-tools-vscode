import * as React from "react";
import { useEffect, useState, useCallback, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { useReducer, Field, ErrorBanner, Autocomplete, ErrorBoundary, Codicon } from "shared-views";
import type { AutocompleteOption } from "shared-views";
import "shared-views/panel.css";
import "./styles/fetchxmlProperties.css";

// ── Types ─────────────────────────────────────────────────────────────────────

type FetchNodeKind =
  | "fetch"
  | "entity"
  | "attribute"
  | "link-entity"
  | "filter"
  | "condition"
  | "order"
  | "value";

interface FetchNode {
  id: string;
  kind: FetchNodeKind;
  attrs: Record<string, string>;
  children: FetchNode[];
  text?: string;
}

interface AttributeMeta {
  name: string;
  /** Type group: "text" | "number" | "date" | "bool" | "lookup" | "set" | "id" */
  type: string;
}

interface RelationshipMeta {
  schemaName: string;
  type: "1:N" | "N:1" | "N:N";
  relatedEntity: string;
  fromAttribute: string;
  toAttribute: string;
  intersect: boolean;
}

// ── Operators per attribute type ───────────────────────────────────────────────

type OpDef = { value: string; label: string };

const OPS_TEXT: OpDef[] = [
  { value: "eq", label: "eq — equals" },
  { value: "ne", label: "ne — not equals" },
  { value: "like", label: "like — pattern match (use %)" },
  { value: "not-like", label: "not-like — pattern does not match" },
  { value: "begins-with", label: "begins-with — starts with text" },
  { value: "not-begin-with", label: "not-begin-with — does not start with" },
  { value: "ends-with", label: "ends-with — ends with text" },
  { value: "not-end-with", label: "not-end-with — does not end with" },
  { value: "in", label: "in — value in list" },
  { value: "not-in", label: "not-in — value not in list" },
  { value: "null", label: "null — is null" },
  { value: "not-null", label: "not-null — is not null" },
];

const OPS_NUMBER: OpDef[] = [
  { value: "eq", label: "eq — equals" },
  { value: "ne", label: "ne — not equals" },
  { value: "gt", label: "gt — greater than" },
  { value: "ge", label: "ge — greater than or equal" },
  { value: "lt", label: "lt — less than" },
  { value: "le", label: "le — less than or equal" },
  { value: "in", label: "in — value in list" },
  { value: "not-in", label: "not-in — value not in list" },
  { value: "between", label: "between — between two values" },
  { value: "not-between", label: "not-between" },
  { value: "null", label: "null — is null" },
  { value: "not-null", label: "not-null — is not null" },
];

const OPS_DATE: OpDef[] = [
  { value: "eq", label: "eq — equals" },
  { value: "ne", label: "ne — not equals" },
  { value: "gt", label: "gt — greater than" },
  { value: "ge", label: "ge — greater than or equal" },
  { value: "lt", label: "lt — less than" },
  { value: "le", label: "le — less than or equal" },
  { value: "on", label: "on — date equals" },
  { value: "on-or-before", label: "on-or-before" },
  { value: "on-or-after", label: "on-or-after" },
  // Relative — no value needed
  { value: "today", label: "today" },
  { value: "yesterday", label: "yesterday" },
  { value: "tomorrow", label: "tomorrow" },
  { value: "last-seven-days", label: "last-seven-days" },
  { value: "next-seven-days", label: "next-seven-days" },
  { value: "last-week", label: "last-week" },
  { value: "this-week", label: "this-week" },
  { value: "next-week", label: "next-week" },
  { value: "last-month", label: "last-month" },
  { value: "this-month", label: "this-month" },
  { value: "next-month", label: "next-month" },
  { value: "last-year", label: "last-year" },
  { value: "this-year", label: "this-year" },
  { value: "next-year", label: "next-year" },
  // Relative — X value needed (enter the N)
  { value: "last-x-hours", label: "last-x-hours — last N hours" },
  { value: "next-x-hours", label: "next-x-hours — next N hours" },
  { value: "last-x-days", label: "last-x-days — last N days" },
  { value: "next-x-days", label: "next-x-days — next N days" },
  { value: "last-x-weeks", label: "last-x-weeks — last N weeks" },
  { value: "next-x-weeks", label: "next-x-weeks — next N weeks" },
  { value: "last-x-months", label: "last-x-months — last N months" },
  { value: "next-x-months", label: "next-x-months — next N months" },
  { value: "last-x-years", label: "last-x-years — last N years" },
  { value: "next-x-years", label: "next-x-years — next N years" },
  { value: "olderthan-x-minutes", label: "olderthan-x-minutes" },
  { value: "olderthan-x-hours", label: "olderthan-x-hours" },
  { value: "olderthan-x-days", label: "olderthan-x-days" },
  { value: "olderthan-x-weeks", label: "olderthan-x-weeks" },
  { value: "olderthan-x-months", label: "olderthan-x-months" },
  { value: "olderthan-x-years", label: "olderthan-x-years" },
  // Fiscal — no value needed
  { value: "this-fiscal-year", label: "this-fiscal-year" },
  { value: "this-fiscal-period", label: "this-fiscal-period" },
  { value: "next-fiscal-year", label: "next-fiscal-year" },
  { value: "next-fiscal-period", label: "next-fiscal-period" },
  { value: "last-fiscal-year", label: "last-fiscal-year" },
  { value: "last-fiscal-period", label: "last-fiscal-period" },
  // Fiscal — X value needed
  { value: "last-x-fiscal-years", label: "last-x-fiscal-years" },
  { value: "last-x-fiscal-periods", label: "last-x-fiscal-periods" },
  { value: "next-x-fiscal-years", label: "next-x-fiscal-years" },
  { value: "next-x-fiscal-periods", label: "next-x-fiscal-periods" },
  { value: "in-fiscal-year", label: "in-fiscal-year" },
  { value: "in-fiscal-period", label: "in-fiscal-period" },
  { value: "in-fiscal-period-and-year", label: "in-fiscal-period-and-year" },
  { value: "in-or-before-fiscal-period-and-year", label: "in-or-before-fiscal-period-and-year" },
  { value: "in-or-after-fiscal-period-and-year", label: "in-or-after-fiscal-period-and-year" },
  { value: "null", label: "null — is null" },
  { value: "not-null", label: "not-null — is not null" },
];

const OPS_BOOL: OpDef[] = [
  { value: "eq", label: "eq — equals" },
  { value: "ne", label: "ne — not equals" },
  { value: "null", label: "null — is null" },
  { value: "not-null", label: "not-null — is not null" },
];

const OPS_LOOKUP: OpDef[] = [
  { value: "eq", label: "eq — equals" },
  { value: "ne", label: "ne — not equals" },
  { value: "null", label: "null — is null" },
  { value: "not-null", label: "not-null — is not null" },
  { value: "in", label: "in — value in list" },
  { value: "not-in", label: "not-in — value not in list" },
  { value: "eq-userid", label: "eq-userid — equals current user" },
  { value: "ne-userid", label: "ne-userid — not current user" },
  { value: "eq-userteams", label: "eq-userteams" },
  { value: "eq-useroruserteams", label: "eq-useroruserteams" },
  { value: "eq-useroruserhierarchy", label: "eq-useroruserhierarchy" },
  { value: "eq-useroruserhierarchyandteams", label: "eq-useroruserhierarchyandteams" },
  { value: "eq-businessid", label: "eq-businessid — same business unit" },
  { value: "ne-businessid", label: "ne-businessid — different business unit" },
  { value: "under", label: "under — hierarchy: under node" },
  { value: "eq-or-under", label: "eq-or-under — hierarchy: equal or under" },
  { value: "not-under", label: "not-under — hierarchy: not under" },
  { value: "above", label: "above — hierarchy: above node" },
  { value: "eq-or-above", label: "eq-or-above — hierarchy: equal or above" },
];

const OPS_SET: OpDef[] = [
  { value: "eq", label: "eq — equals" },
  { value: "ne", label: "ne — not equals" },
  { value: "in", label: "in — value in list" },
  { value: "not-in", label: "not-in — value not in list" },
  { value: "contain-values", label: "contain-values — multi-select contains" },
  { value: "not-contain-values", label: "not-contain-values — multi-select does not contain" },
  { value: "null", label: "null — is null" },
  { value: "not-null", label: "not-null — is not null" },
];

const OPS_ID: OpDef[] = [
  { value: "eq", label: "eq — equals" },
  { value: "ne", label: "ne — not equals" },
  { value: "null", label: "null — is null" },
  { value: "not-null", label: "not-null — is not null" },
  { value: "in", label: "in — value in list" },
  { value: "not-in", label: "not-in — value not in list" },
];

const OPS_ALL: OpDef[] = [
  ...OPS_TEXT,
  { value: "gt", label: "gt — greater than" },
  { value: "ge", label: "ge — greater than or equal" },
  { value: "lt", label: "lt — less than" },
  { value: "le", label: "le — less than or equal" },
  { value: "between", label: "between — between two values" },
  { value: "not-between", label: "not-between" },
  { value: "on", label: "on — date equals" },
  { value: "on-or-before", label: "on-or-before" },
  { value: "on-or-after", label: "on-or-after" },
  { value: "today", label: "today" },
  { value: "yesterday", label: "yesterday" },
  { value: "tomorrow", label: "tomorrow" },
  { value: "last-seven-days", label: "last-seven-days" },
  { value: "next-seven-days", label: "next-seven-days" },
  { value: "last-week", label: "last-week" },
  { value: "this-week", label: "this-week" },
  { value: "next-week", label: "next-week" },
  { value: "last-month", label: "last-month" },
  { value: "this-month", label: "this-month" },
  { value: "next-month", label: "next-month" },
  { value: "last-year", label: "last-year" },
  { value: "this-year", label: "this-year" },
  { value: "next-year", label: "next-year" },
  { value: "last-x-hours", label: "last-x-hours — last N hours" },
  { value: "next-x-hours", label: "next-x-hours — next N hours" },
  { value: "last-x-days", label: "last-x-days — last N days" },
  { value: "next-x-days", label: "next-x-days — next N days" },
  { value: "last-x-weeks", label: "last-x-weeks — last N weeks" },
  { value: "next-x-weeks", label: "next-x-weeks — next N weeks" },
  { value: "last-x-months", label: "last-x-months — last N months" },
  { value: "next-x-months", label: "next-x-months — next N months" },
  { value: "last-x-years", label: "last-x-years — last N years" },
  { value: "next-x-years", label: "next-x-years — next N years" },
  { value: "eq-userid", label: "eq-userid — equals current user" },
  { value: "ne-userid", label: "ne-userid — not current user" },
  { value: "eq-userteams", label: "eq-userteams" },
  { value: "eq-useroruserteams", label: "eq-useroruserteams" },
  { value: "eq-useroruserhierarchy", label: "eq-useroruserhierarchy" },
  { value: "eq-businessid", label: "eq-businessid" },
  { value: "ne-businessid", label: "ne-businessid" },
  { value: "under", label: "under — hierarchy" },
  { value: "eq-or-under", label: "eq-or-under" },
  { value: "not-under", label: "not-under" },
  { value: "above", label: "above — hierarchy" },
  { value: "eq-or-above", label: "eq-or-above" },
  { value: "contain-values", label: "contain-values" },
  { value: "not-contain-values", label: "not-contain-values" },
];

const OPERATORS_BY_TYPE: Record<string, OpDef[]> = {
  text: OPS_TEXT,
  number: OPS_NUMBER,
  date: OPS_DATE,
  bool: OPS_BOOL,
  lookup: OPS_LOOKUP,
  set: OPS_SET,
  id: OPS_ID,
};

// ── State & Actions ───────────────────────────────────────────────────────────

interface State {
  node: FetchNode | null;
  draft: Record<string, string>;
  entities: AutocompleteOption[];
  attributes: AutocompleteOption[];
  fromAttributes: AutocompleteOption[];
  attrTypeMap: Record<string, string>;
  linkedEntities: AutocompleteOption[];
  relationships: RelationshipMeta[];
  relationshipsLoading: boolean;
  entitiesLoading: boolean;
  attributesLoading: boolean;
  fromAttributesLoading: boolean;
  executing: boolean;
  error: string | null;
}

const initial: State = {
  node: null,
  draft: {},
  entities: [],
  attributes: [],
  fromAttributes: [],
  attrTypeMap: {},
  linkedEntities: [],
  relationships: [],
  relationshipsLoading: false,
  entitiesLoading: false,
  attributesLoading: false,
  fromAttributesLoading: false,
  executing: false,
  error: null,
};

type Action =
  | { type: "init"; payload: FetchNode | null }
  | { type: "setField"; payload: { key: string; value: string } }
  | { type: "loadEntities"; meta: { toExtension: true } }
  | { type: "loadEntities:response"; payload: string[] }
  | { type: "loadEntities:error"; payload: string }
  | { type: "loadAttributes"; payload: { entityName: string; nodeId: string }; meta: { toExtension: true } }
  | { type: "loadAttributes:response"; payload: AttributeMeta[] }
  | { type: "loadAttributes:error"; payload: string }
  | { type: "loadFromAttributes"; payload: { entityName: string; nodeId: string }; meta: { toExtension: true } }
  | { type: "loadFromAttributes:response"; payload: AttributeMeta[] }
  | { type: "loadFromAttributes:error"; payload: string }
  | { type: "loadLinkedEntities"; meta: { toExtension: true } }
  | { type: "loadLinkedEntities:response"; payload: string[] }
  | { type: "loadRelationships"; payload: { parentEntity: string }; meta: { toExtension: true } }
  | { type: "loadRelationships:response"; payload: RelationshipMeta[] }
  | { type: "loadRelationships:error"; payload: string }
  | { type: "updateNode"; payload: { id: string; attrs: Record<string, string> }; meta: { toExtension: true } }
  | { type: "setConditionValues"; payload: { id: string; values: string[] }; meta: { toExtension: true } }
  | { type: "ready"; meta: { toExtension: true } }
  | { type: "executing"; payload: boolean }
  | { type: "setError"; payload: string | null };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "init":
      return {
        ...state,
        node: action.payload,
        draft: action.payload?.attrs ? { ...action.payload.attrs } : {},
        error: null,
        attributes: [],
        fromAttributes: [],
        attrTypeMap: {},
        relationships: [],
      };
    case "setField":
      return {
        ...state,
        draft: { ...state.draft, [action.payload.key]: action.payload.value },
      };
    case "loadEntities":
      return { ...state, entitiesLoading: true };
    case "loadEntities:response":
      return {
        ...state,
        entitiesLoading: false,
        entities: action.payload.map((n) => ({ key: n, label: n })),
      };
    case "loadEntities:error":
      return { ...state, entitiesLoading: false, error: action.payload };
    case "loadAttributes":
      return { ...state, attributesLoading: true, attributes: [], attrTypeMap: {} };
    case "loadAttributes:response":
      return {
        ...state,
        attributesLoading: false,
        attributes: action.payload.map((a) => ({ key: a.name, label: a.name })),
        attrTypeMap: Object.fromEntries(action.payload.map((a) => [a.name, a.type])),
      };
    case "loadAttributes:error":
      return { ...state, attributesLoading: false, error: action.payload };
    case "loadFromAttributes":
      return { ...state, fromAttributesLoading: true, fromAttributes: [] };
    case "loadFromAttributes:response":
      return {
        ...state,
        fromAttributesLoading: false,
        fromAttributes: action.payload.map((a) => ({ key: a.name, label: a.name })),
      };
    case "loadFromAttributes:error":
      return { ...state, fromAttributesLoading: false, error: action.payload };
    case "loadLinkedEntities:response":
      return {
        ...state,
        linkedEntities: action.payload.map((n) => ({ key: n, label: n })),
      };
    case "loadRelationships":
      return { ...state, relationshipsLoading: true };
    case "loadRelationships:response":
      return { ...state, relationshipsLoading: false, relationships: action.payload };
    case "loadRelationships:error":
      return { ...state, relationshipsLoading: false, error: action.payload };
    case "setError":
      return { ...state, error: action.payload };
    case "executing":
      return { ...state, executing: action.payload };
    case "updateNode":
    case "ready":
    case "loadLinkedEntities":
      return state;
    default:
      return state;
  }
}

// ── Commit helper ─────────────────────────────────────────────────────────────

type CommitFn = (override?: Record<string, string>) => void;

function buildAttrs(
  draft: Record<string, string>,
  override?: Record<string, string>
): Record<string, string> {
  const merged = override ? { ...draft, ...override } : draft;
  return Object.fromEntries(
    Object.entries(merged).filter(([k]) => !k.startsWith("_"))
  );
}

// ── Form field helpers ────────────────────────────────────────────────────────

function textField(
  key: string,
  label: string,
  draft: Record<string, string>,
  dispatch: (a: Action) => void,
  commit: CommitFn,
  type: "text" | "number" = "text"
): React.ReactElement {
  return (
    <Field key={key} label={label} as="input" fieldId={key}
      type={type}
      value={draft[key] ?? ""}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
        dispatch({ type: "setField", payload: { key, value: e.target.value } })
      }
      onBlur={(e: React.FocusEvent<HTMLInputElement>) =>
        commit({ [key]: e.target.value })
      }
    />
  );
}

function selectField(
  key: string,
  label: string,
  options: OpDef[],
  draft: Record<string, string>,
  dispatch: (a: Action) => void,
  commit: CommitFn
): React.ReactElement {
  return (
    <div className="field" key={key}>
      <label htmlFor={key}>{label}</label>
      <select
        id={key}
        value={draft[key] ?? options[0]?.value ?? ""}
        onChange={(e) => {
          const value = e.target.value;
          dispatch({ type: "setField", payload: { key, value } });
          commit({ [key]: value });
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function checkField(
  key: string,
  label: string,
  draft: Record<string, string>,
  dispatch: (a: Action) => void,
  commit: CommitFn
): React.ReactElement {
  return (
    <div className="field-check" key={key}>
      <input
        id={key}
        type="checkbox"
        checked={draft[key] === "true"}
        onChange={(e) => {
          const value = e.target.checked ? "true" : "";
          dispatch({ type: "setField", payload: { key, value } });
          commit({ [key]: value });
        }}
      />
      <label htmlFor={key}>
        {label}
      </label>
    </div>
  );
}

// ── Form sections per node kind ───────────────────────────────────────────────

function FetchForm({ draft, dispatch, commit }: {
  draft: Record<string, string>;
  dispatch: (a: Action) => void;
  commit: CommitFn;
}): React.ReactElement {
  return (
    <>
      {textField("top", "Top (max rows)", draft, dispatch, commit, "number")}
      {textField("count", "Count (page size)", draft, dispatch, commit, "number")}
      {textField("page", "Page number", draft, dispatch, commit, "number")}
      {textField("paging-cookie", "Paging cookie", draft, dispatch, commit)}
      {checkField("distinct", "Distinct", draft, dispatch, commit)}
      {checkField("no-lock", "No lock (read without shared lock)", draft, dispatch, commit)}
      {checkField("aggregate", "Aggregate mode", draft, dispatch, commit)}
      {checkField("returntotalrecordcount", "Return total record count", draft, dispatch, commit)}
    </>
  );
}

function EntityForm({ draft, dispatch, commit, entities, entitiesLoading }: {
  draft: Record<string, string>;
  dispatch: (a: Action) => void;
  commit: CommitFn;
  entities: AutocompleteOption[];
  entitiesLoading: boolean;
}): React.ReactElement {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return q ? entities.filter((e) => e.label.toLowerCase().includes(q)) : entities;
  }, [entities, query]);

  return (
    <div className="field">
      <label htmlFor="entityName">Entity name *</label>
      <Autocomplete
        fieldId="entityName"
        value={draft.name ? { key: draft.name, label: draft.name } : null}
        options={filtered}
        loading={entitiesLoading}
        disabled={entitiesLoading}
        onSearch={setQuery}
        onSelect={(opt) => {
          const value = opt?.key ?? "";
          dispatch({ type: "setField", payload: { key: "name", value } });
          commit({ name: value });
        }}
        placeholder={entitiesLoading ? "Loading entities…" : "Search entities…"}
        debounceMs={0}
      />
    </div>
  );
}

function AttributeForm({ draft, dispatch, commit, attributes, attributesLoading }: {
  draft: Record<string, string>;
  dispatch: (a: Action) => void;
  commit: CommitFn;
  attributes: AutocompleteOption[];
  attributesLoading: boolean;
}): React.ReactElement {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return q ? attributes.filter((a) => a.label.toLowerCase().includes(q)) : attributes;
  }, [attributes, query]);

  return (
    <>
      <div className="field">
        <label htmlFor="attrName">Attribute name *</label>
        <Autocomplete
          fieldId="attrName"
          value={draft.name ? { key: draft.name, label: draft.name } : null}
          options={filtered}
          loading={attributesLoading}
          disabled={attributesLoading}
          onSearch={setQuery}
          onSelect={(opt) => {
            const value = opt?.key ?? "";
            dispatch({ type: "setField", payload: { key: "name", value } });
            commit({ name: value });
          }}
          placeholder={attributesLoading ? "Loading attributes…" : "Search attributes…"}
          debounceMs={0}
        />
      </div>
      {textField("alias", "Alias", draft, dispatch, commit)}
      {selectField("aggregate", "Aggregate", [
        { value: "", label: "(none)" },
        { value: "avg", label: "avg" },
        { value: "count", label: "count" },
        { value: "countcolumn", label: "countcolumn" },
        { value: "max", label: "max" },
        { value: "min", label: "min" },
        { value: "sum", label: "sum" },
      ], draft, dispatch, commit)}
      {draft.aggregate && checkField("groupby", "Group by", draft, dispatch, commit)}
      {draft.aggregate && selectField("dategrouping", "Date grouping", [
        { value: "", label: "(none)" },
        { value: "day", label: "day" },
        { value: "week", label: "week" },
        { value: "month", label: "month" },
        { value: "quarter", label: "quarter" },
        { value: "year", label: "year" },
        { value: "fiscal-period", label: "fiscal-period" },
        { value: "fiscal-year", label: "fiscal-year" },
      ], draft, dispatch, commit)}
    </>
  );
}

function LinkEntityForm({ draft, dispatch, commit, entities, entitiesLoading, fromAttributes, fromAttributesLoading, attributes, attributesLoading, nodeId, relationships, relationshipsLoading }: {
  draft: Record<string, string>;
  dispatch: (a: Action) => void;
  commit: CommitFn;
  entities: AutocompleteOption[];
  entitiesLoading: boolean;
  fromAttributes: AutocompleteOption[];
  fromAttributesLoading: boolean;
  attributes: AutocompleteOption[];
  attributesLoading: boolean;
  nodeId: string;
  relationships: RelationshipMeta[];
  relationshipsLoading: boolean;
}): React.ReactElement {
  const grouped = useMemo(() => {
    const groups: Record<string, RelationshipMeta[]> = { "1:N": [], "N:1": [], "N:N": [] };
    for (const r of relationships) {
      groups[r.type].push(r);
    }
    for (const g of Object.values(groups)) {
      g.sort((a, b) => a.schemaName.localeCompare(b.schemaName));
    }
    return groups;
  }, [relationships]);

  const handleRelationshipSelect = useCallback((schemaName: string) => {
    if (!schemaName) { return; }
    const rel = relationships.find(r => r.schemaName === schemaName);
    if (!rel) { return; }
    dispatch({ type: "setField", payload: { key: "name", value: rel.relatedEntity } });
    dispatch({ type: "setField", payload: { key: "from", value: rel.fromAttribute } });
    dispatch({ type: "setField", payload: { key: "to", value: rel.toAttribute } });
    dispatch({ type: "setField", payload: { key: "intersect", value: rel.intersect ? "true" : "" } });
    commit({
      name: rel.relatedEntity,
      from: rel.fromAttribute,
      to: rel.toAttribute,
      intersect: rel.intersect ? "true" : "",
    });
    if (rel.relatedEntity) {
      dispatch({
        type: "loadFromAttributes",
        payload: { entityName: rel.relatedEntity, nodeId },
        meta: { toExtension: true },
      });
    }
  }, [relationships, dispatch, commit, nodeId]);

  const [entityQuery, setEntityQuery] = useState("");
  const filteredEntities = useMemo(() => {
    const q = entityQuery.toLowerCase();
    return q ? entities.filter((e) => e.label.toLowerCase().includes(q)) : entities;
  }, [entities, entityQuery]);

  const [fromQuery, setFromQuery] = useState("");
  const filteredFrom = useMemo(() => {
    const q = fromQuery.toLowerCase();
    return q ? fromAttributes.filter((a) => a.label.toLowerCase().includes(q)) : fromAttributes;
  }, [fromAttributes, fromQuery]);

  const [toQuery, setToQuery] = useState("");
  const filteredTo = useMemo(() => {
    const q = toQuery.toLowerCase();
    return q ? attributes.filter((a) => a.label.toLowerCase().includes(q)) : attributes;
  }, [attributes, toQuery]);

  return (
    <>
      <div className="field">
        <label htmlFor="leRelationship">Relationship</label>
        <select
          id="leRelationship"
          value=""
          disabled={relationshipsLoading || relationships.length === 0}
          onChange={(e) => handleRelationshipSelect(e.target.value)}
        >
          <option value="">
            {relationshipsLoading ? "Loading relationships…" : "(Select relationship to auto-fill…)"}
          </option>
          {grouped["1:N"].length > 0 && (
            <optgroup label="One-to-Many (1:N)">
              {grouped["1:N"].map(r => (
                <option key={r.schemaName} value={r.schemaName}>
                  {r.schemaName} → {r.relatedEntity}
                </option>
              ))}
            </optgroup>
          )}
          {grouped["N:1"].length > 0 && (
            <optgroup label="Many-to-One (N:1)">
              {grouped["N:1"].map(r => (
                <option key={r.schemaName} value={r.schemaName}>
                  {r.schemaName} → {r.relatedEntity}
                </option>
              ))}
            </optgroup>
          )}
          {grouped["N:N"].length > 0 && (
            <optgroup label="Many-to-Many (N:N)">
              {grouped["N:N"].map(r => (
                <option key={r.schemaName} value={r.schemaName}>
                  {r.schemaName} → {r.relatedEntity}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>
      <div className="field">
        <label htmlFor="leName">Related entity *</label>
        <Autocomplete
          fieldId="leName"
          value={draft.name ? { key: draft.name, label: draft.name } : null}
          options={filteredEntities}
          loading={entitiesLoading}
          disabled={entitiesLoading}
          onSearch={setEntityQuery}
          onSelect={(opt) => {
            const value = opt?.key ?? "";
            dispatch({ type: "setField", payload: { key: "name", value } });
            commit({ name: value });
            // Reload from-attributes whenever the related entity changes.
            if (value) {
              dispatch({
                type: "loadFromAttributes",
                payload: { entityName: value, nodeId },
                meta: { toExtension: true },
              });
            }
          }}
          placeholder={entitiesLoading ? "Loading entities…" : "Search entities…"}
          debounceMs={0}
        />
      </div>
      <div className="field">
        <label htmlFor="leFrom">From (attribute on related entity) *</label>
        <Autocomplete
          fieldId="leFrom"
          value={draft.from ? { key: draft.from, label: draft.from } : null}
          options={filteredFrom}
          loading={fromAttributesLoading}
          disabled={fromAttributesLoading}
          onSearch={setFromQuery}
          onSelect={(opt) => {
            const value = opt?.key ?? "";
            dispatch({ type: "setField", payload: { key: "from", value } });
            commit({ from: value });
          }}
          placeholder={fromAttributesLoading ? "Loading attributes…" : draft.name ? "Search attributes…" : "Select entity first…"}
          debounceMs={0}
        />
      </div>
      <div className="field">
        <label htmlFor="leTo">To (attribute on parent) *</label>
        <Autocomplete
          fieldId="leTo"
          value={draft.to ? { key: draft.to, label: draft.to } : null}
          options={filteredTo}
          loading={attributesLoading}
          disabled={attributesLoading}
          onSearch={setToQuery}
          onSelect={(opt) => {
            const value = opt?.key ?? "";
            dispatch({ type: "setField", payload: { key: "to", value } });
            commit({ to: value });
          }}
          placeholder={attributesLoading ? "Loading attributes…" : "Search attributes…"}
          debounceMs={0}
        />
      </div>
      {selectField("link-type", "Join type *", [
        { value: "inner", label: "inner (matching records only)" },
        { value: "outer", label: "outer (all parent records)" },
        { value: "exists", label: "exists (filter only, no columns)" },
        { value: "in", label: "in (filter only, no columns)" },
        { value: "any", label: "any" },
        { value: "not any", label: "not any" },
        { value: "all", label: "all" },
        { value: "not all", label: "not all" },
        { value: "matchfirstrowusingcrossapply", label: "matchfirstrowusingcrossapply" },
      ], draft, dispatch, commit)}
      {textField("alias", "Alias", draft, dispatch, commit)}
      {checkField("intersect", "Intersect (many-to-many)", draft, dispatch, commit)}
    </>
  );
}

function FilterForm({ draft, dispatch, commit }: {
  draft: Record<string, string>;
  dispatch: (a: Action) => void;
  commit: CommitFn;
}): React.ReactElement {
  return selectField("type", "Filter logic", [
    { value: "and", label: "AND (all conditions must match)" },
    { value: "or", label: "OR (any condition must match)" },
  ], draft, dispatch, commit);
}

function ConditionForm({ node, draft, dispatch, commit, attributes, attributesLoading, attrTypeMap, linkedEntities }: {
  node: FetchNode;
  draft: Record<string, string>;
  dispatch: (a: Action) => void;
  commit: CommitFn;
  attributes: AutocompleteOption[];
  attributesLoading: boolean;
  attrTypeMap: Record<string, string>;
  linkedEntities: AutocompleteOption[];
}): React.ReactElement {
  const selectedAttrType = attrTypeMap[draft.attribute ?? ""] ?? "";
  const operators = OPERATORS_BY_TYPE[selectedAttrType] ?? OPS_ALL;
  const operator = draft.operator ?? "eq";

  const noValueOps = new Set([
    "null", "not-null",
    "eq-userid", "ne-userid", "eq-userteams", "eq-useroruserteams",
    "eq-useroruserhierarchy", "eq-useroruserhierarchyandteams",
    "eq-businessid", "ne-businessid",
    "under", "eq-or-under", "not-under", "above", "eq-or-above",
    "today", "yesterday", "tomorrow",
    "last-seven-days", "next-seven-days",
    "last-week", "this-week", "next-week",
    "last-month", "this-month", "next-month",
    "last-year", "this-year", "next-year",
    "this-fiscal-year", "this-fiscal-period",
    "next-fiscal-year", "next-fiscal-period",
    "last-fiscal-year", "last-fiscal-period",
  ]);
  const multiValueOps = new Set(["in", "not-in", "between", "not-between"]);
  const isMultiValue = multiValueOps.has(operator);

  // Local value list state for multi-value operators, derived from node children.
  const initialValues = useMemo(
    () => node.children.filter((c) => c.kind === "value").map((c) => c.text ?? ""),
    [node.id] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const [values, setValues] = useState<string[]>(initialValues);

  // Sync values when switching nodes.
  useEffect(() => {
    setValues(node.children.filter((c) => c.kind === "value").map((c) => c.text ?? ""));
  }, [node.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const commitValues = useCallback(
    (next: string[]) => {
      setValues(next);
      dispatch({
        type: "setConditionValues",
        payload: { id: node.id, values: next },
        meta: { toExtension: true },
      });
    },
    [node.id, dispatch]
  );

  const [attrQuery, setAttrQuery] = useState("");
  const filteredAttrs = useMemo(() => {
    const q = attrQuery.toLowerCase();
    return q ? attributes.filter((a) => a.label.toLowerCase().includes(q)) : attributes;
  }, [attributes, attrQuery]);

  const [leQuery, setLeQuery] = useState("");
  const filteredLinked = useMemo(() => {
    const q = leQuery.toLowerCase();
    return q ? linkedEntities.filter((e) => e.label.toLowerCase().includes(q)) : linkedEntities;
  }, [linkedEntities, leQuery]);

  return (
    <>
      <div className="field">
        <label htmlFor="condAttr">Attribute *</label>
        <Autocomplete
          fieldId="condAttr"
          value={draft.attribute ? { key: draft.attribute, label: draft.attribute } : null}
          options={filteredAttrs}
          loading={attributesLoading}
          disabled={attributesLoading}
          onSearch={setAttrQuery}
          onSelect={(opt) => {
            const value = opt?.key ?? "";
            dispatch({ type: "setField", payload: { key: "attribute", value } });
            commit({ attribute: value });
          }}
          placeholder={attributesLoading ? "Loading attributes…" : "Search attributes…"}
          debounceMs={0}
        />
      </div>
      {selectField("operator", "Operator *", operators, draft, dispatch, commit)}
      {!noValueOps.has(operator) && !isMultiValue && (
        <div className="field">
          <label htmlFor="condValue">Value</label>
          <input
            id="condValue"
            type="text"
            value={draft.value ?? ""}
            placeholder="Enter value"
            onChange={(e) =>
              dispatch({ type: "setField", payload: { key: "value", value: e.target.value } })
            }
            onBlur={(e) => commit({ value: e.target.value })}
          />
        </div>
      )}
      {isMultiValue && (
        <div className="field">
          <label>Values</label>
          <div className="value-list">
            {values.map((v, i) => (
              <div key={i} className="value-list-item">
                <input
                  type="text"
                  value={v}
                  placeholder="Enter value"
                  onChange={(e) => {
                    const next = [...values];
                    next[i] = e.target.value;
                    setValues(next);
                  }}
                  onBlur={() => commitValues(values)}
                />
                <button
                  type="button"
                  className="value-list-remove"
                  title="Remove value"
                  onClick={() => commitValues(values.filter((_, j) => j !== i))}
                >
                  <Codicon name="close" />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="value-list-add"
              onClick={() => commitValues([...values, ""])}
            >
              <Codicon name="add" /> Add value
            </button>
          </div>
        </div>
      )}
      {draft._underLinkEntity !== "true" && (
        <div className="field">
          <label htmlFor="condEntityName">Entity name (cross-link conditions)</label>
          <Autocomplete
            fieldId="condEntityName"
            value={draft.entityname ? { key: draft.entityname, label: draft.entityname } : null}
            options={filteredLinked}
            loading={false}
            clearOnBlur
            onSearch={setLeQuery}
            onSelect={(opt) => {
              const value = opt?.key ?? "";
              dispatch({ type: "setField", payload: { key: "entityname", value } });
              commit({ entityname: value });
              dispatch({
                type: "loadAttributes",
                payload: { entityName: value, nodeId: node.id },
                meta: { toExtension: true },
              });
            }}
            placeholder="Link-entity alias or name…"
            debounceMs={0}
          />
        </div>
      )}
    </>
  );
}

function OrderForm({ draft, dispatch, commit, attributes, attributesLoading }: {
  draft: Record<string, string>;
  dispatch: (a: Action) => void;
  commit: CommitFn;
  attributes: AutocompleteOption[];
  attributesLoading: boolean;
}): React.ReactElement {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return q ? attributes.filter((a) => a.label.toLowerCase().includes(q)) : attributes;
  }, [attributes, query]);

  return (
    <>
      <div className="field">
        <label htmlFor="orderAttr">Attribute *</label>
        <Autocomplete
          fieldId="orderAttr"
          value={draft.attribute ? { key: draft.attribute, label: draft.attribute } : null}
          options={filtered}
          loading={attributesLoading}
          disabled={attributesLoading}
          onSearch={setQuery}
          onSelect={(opt) => {
            const value = opt?.key ?? "";
            dispatch({ type: "setField", payload: { key: "attribute", value } });
            commit({ attribute: value });
          }}
          placeholder={attributesLoading ? "Loading attributes…" : "Search attributes…"}
          debounceMs={0}
        />
      </div>
      {textField("alias", "Alias (for aggregate ordering)", draft, dispatch, commit)}
      {checkField("descending", "Descending", draft, dispatch, commit)}
    </>
  );
}

// ── Root component ─────────────────────────────────────────────────────────────

function NodePropertiesApp(): React.ReactElement {
  const [state, dispatch] = useReducer(reducer, initial);
  const { node, draft, entities, attributes, fromAttributes, attrTypeMap, linkedEntities, relationships, relationshipsLoading, entitiesLoading, attributesLoading, fromAttributesLoading, executing, error } = state;

  // Signal ready + pre-load entities once on mount.
  useEffect(() => {
    dispatch({ type: "ready", meta: { toExtension: true } });
    dispatch({ type: "loadEntities", meta: { toExtension: true } });
  }, []);

  // Load attributes + linked entities when switching to a node that needs them.
  useEffect(() => {
    if (!node) { return; }
    if (
      node.kind === "attribute" ||
      node.kind === "condition" ||
      node.kind === "order"
    ) {
      // For conditions: if entityname is already set, load attributes from that
      // cross-link entity instead of the parent entity.
      const entityName =
        node.kind === "condition" ? (draft.entityname ?? "") : "";
      dispatch({
        type: "loadAttributes",
        payload: { entityName, nodeId: node.id },
        meta: { toExtension: true },
      });
    }
    if (node.kind === "condition") {
      dispatch({ type: "loadLinkedEntities", meta: { toExtension: true } });
    }
    if (node.kind === "link-entity") {
      // 'to' field: attributes of the parent entity (_parentEntity context flag)
      dispatch({
        type: "loadAttributes",
        payload: { entityName: draft._parentEntity ?? "", nodeId: node.id },
        meta: { toExtension: true },
      });
      // 'from' field: attributes of the related entity (draft.name)
      if (draft.name) {
        dispatch({
          type: "loadFromAttributes",
          payload: { entityName: draft.name, nodeId: node.id },
          meta: { toExtension: true },
        });
      }
      // Relationships for the parent entity (for the relationship picker)
      if (draft._parentEntity) {
        dispatch({
          type: "loadRelationships",
          payload: { parentEntity: draft._parentEntity },
          meta: { toExtension: true },
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.id]);

  const commit = useCallback(
    (override?: Record<string, string>) => {
      if (!node) { return; }
      dispatch({
        type: "updateNode",
        payload: { id: node.id, attrs: buildAttrs(draft, override) },
        meta: { toExtension: true },
      });
    },
    [node, draft, dispatch]
  );

  const kindIcon: Record<string, string> = {
    fetch: "list-tree",
    entity: "database",
    attribute: "symbol-field",
    "link-entity": "link",
    filter: "filter",
    condition: "symbol-operator",
    order: "arrow-swap",
  };

  const kindLabel: Record<string, string> = {
    fetch: "Fetch",
    entity: "Entity",
    attribute: "Attribute",
    "link-entity": "Link Entity",
    filter: "Filter",
    condition: "Condition",
    order: "Order",
  };

  if (!node) {
    return (
      <div className="props-empty">
        <div className="props-empty-icon">
          <Codicon name="symbol-property" />
        </div>
        <span className="props-empty-text">
          Select a node in the FetchXML Builder tree to edit its properties.
        </span>
      </div>
    );
  }

  const isLoading = entitiesLoading || attributesLoading || fromAttributesLoading || relationshipsLoading;
  const isDisabled = executing || isLoading;

  return (
    <div className={`props-form${isDisabled ? " disabled" : ""}`}>
      <div className="props-header">
        <span className="props-header-icon">
          <Codicon name={kindIcon[node.kind] ?? "symbol-misc"} />
        </span>
        <h2>&lt;{node.kind}&gt;</h2>
      </div>
      <p className="props-subtitle">
        {kindLabel[node.kind] ?? node.kind} properties
        {executing && (
          <span className="props-status-badge">
            <Codicon name="loading~spin" />
            Executing…
          </span>
        )}
        {!executing && isLoading && (
          <span className="props-status-badge">
            <Codicon name="loading~spin" />
            Loading…
          </span>
        )}
      </p>

      <ErrorBanner error={error} />

      {node.kind === "fetch" && (
        <FetchForm draft={draft} dispatch={dispatch} commit={commit} />
      )}
      {node.kind === "entity" && (
        <EntityForm
          draft={draft} dispatch={dispatch} commit={commit}
          entities={entities} entitiesLoading={entitiesLoading}
        />
      )}
      {node.kind === "attribute" && (
        <AttributeForm
          draft={draft} dispatch={dispatch} commit={commit}
          attributes={attributes} attributesLoading={attributesLoading}
        />
      )}
      {node.kind === "link-entity" && (
        <LinkEntityForm
          draft={draft} dispatch={dispatch} commit={commit}
          entities={entities} entitiesLoading={entitiesLoading}
          fromAttributes={fromAttributes} fromAttributesLoading={fromAttributesLoading}
          attributes={attributes} attributesLoading={attributesLoading}
          nodeId={node.id}
          relationships={relationships} relationshipsLoading={relationshipsLoading}
        />
      )}
      {node.kind === "filter" && (
        <FilterForm draft={draft} dispatch={dispatch} commit={commit} />
      )}
      {node.kind === "condition" && (
        <ConditionForm
          node={node} draft={draft} dispatch={dispatch} commit={commit}
          attributes={attributes} attributesLoading={attributesLoading}
          attrTypeMap={attrTypeMap}
          linkedEntities={linkedEntities}
        />
      )}
      {node.kind === "order" && (
        <OrderForm
          draft={draft} dispatch={dispatch} commit={commit}
          attributes={attributes} attributesLoading={attributesLoading}
        />
      )}
    </div>
  );
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(<ErrorBoundary><NodePropertiesApp /></ErrorBoundary>);
}
