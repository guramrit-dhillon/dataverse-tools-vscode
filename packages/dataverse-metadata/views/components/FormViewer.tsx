import * as React from "react";
import { useCallback, useEffect, useMemo } from "react";
import { useReducer, TabBar, DataTable, TreeView } from "shared-views";
import type { TableColumnDefinition, TreeNode } from "shared-views";
import type { EntityForm, EntityFormDetails } from "../../src/types/metadata";
import { parseFormStructure, type FormField, type FormLibrary, type FormEvent } from "../utils/parseFormStructure";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = "structure" | "libraries" | "formxml";

type Phase =
  | { tag: "loading" }
  | { tag: "ready"; forms: EntityForm[]; current: EntityFormDetails }
  | { tag: "switching"; forms: EntityForm[]; current: EntityFormDetails }
  | { tag: "error"; forms?: EntityForm[]; current?: EntityFormDetails; message: string }
  | { tag: "no-list"; current: EntityFormDetails };

interface State {
  entityDisplayName: string;
  phase: Phase;
  activeTab: Tab;
  inFlightId: string | null;
  pendingForms: EntityForm[] | null;
  pendingCurrent: EntityFormDetails | null;
  pendingSetFormId: string | null;
  copyLabel: string;
}

type Action =
  | { type: "init"; payload?: undefined }
  | { type: "formInit"; payload: { forms: EntityForm[]; entityDisplayName: string } }
  | { type: "formLoaded"; payload: { current: EntityFormDetails } }
  | { type: "formError"; payload: { message: string } }
  | { type: "setForm"; payload: { formid: string } }
  | { type: "ready"; meta: { toExtension: true } }
  | { type: "switchForm"; payload: { formid: string }; meta: { toExtension: true } }
  | { type: "switchTab"; payload: Tab }
  | { type: "copyDone" }
  | { type: "copyReset" };

const FORM_TYPE_LABELS: Record<number, string> = {
  2: "Main", 5: "Mobile Express", 6: "Quick View Form", 7: "Quick Create",
  8: "Dialog", 9: "Task Flow Form", 11: "Card", 12: "Main - Interactive",
  100: "Other",
};

function formTypeGroupLabel(type: number): string {
  return FORM_TYPE_LABELS[type] ?? `Type ${type}`;
}

const TABS = [
  { id: "structure",  label: "Structure" },
  { id: "libraries",  label: "Libraries & Events" },
  { id: "formxml",    label: "FormXML" },
] as const;

// ── XML formatter ─────────────────────────────────────────────────────────────

function serializeXmlNode(el: Element, depth: number): string {
  const indent = "  ".repeat(depth);
  const tag = el.tagName;
  const attrStr = el.attributes.length > 0
    ? " " + Array.from(el.attributes).map((a) => `${a.name}="${a.value.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`).join(" ")
    : "";
  const childEls = Array.from(el.children);
  if (childEls.length === 0) {
    const text = el.textContent?.trim() ?? "";
    return text
      ? `${indent}<${tag}${attrStr}>${text}</${tag}>`
      : `${indent}<${tag}${attrStr} />`;
  }
  const inner = childEls.map((c) => serializeXmlNode(c, depth + 1)).join("\n");
  return `${indent}<${tag}${attrStr}>\n${inner}\n${indent}</${tag}>`;
}

function formatXml(xml: string): string {
  try {
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    if (doc.querySelector("parsererror")) { return xml; }
    return serializeXmlNode(doc.documentElement, 0);
  } catch {
    return xml;
  }
}

// Column definitions for sub-tables
const LIBRARY_COLS: TableColumnDefinition<FormLibrary>[] = [
  { key: "webResourceName", label: "Web Resource" },
  { key: "displayName", label: "Display Name" },
];

const EVENT_COLS: TableColumnDefinition<FormEvent & { field: string }>[] = [
  { key: "event", label: "Event" },
  { key: "field", label: "Field" },
  { key: "functionName", label: "Function" },
  { key: "libraryName", label: "Library" },
];

// ── Initial state ─────────────────────────────────────────────────────────────

const initialState: State = {
  entityDisplayName: "",
  phase: { tag: "loading" },
  activeTab: "structure",
  inFlightId: null,
  pendingForms: null,
  pendingCurrent: null,
  pendingSetFormId: null,
  copyLabel: "Copy",
};

// ── Reducer ───────────────────────────────────────────────────────────────────

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "init": return state;

    case "formInit": {
      const { forms, entityDisplayName } = action.payload;
      if (state.pendingCurrent) {
        return { ...state, entityDisplayName, phase: { tag: "ready", forms, current: state.pendingCurrent }, pendingCurrent: null, pendingForms: null };
      }
      return { ...state, entityDisplayName, pendingForms: forms };
    }

    case "formLoaded": {
      const { current } = action.payload;
      if (state.pendingForms) {
        return { ...state, phase: { tag: "ready", forms: state.pendingForms, current }, pendingForms: null, pendingCurrent: null, inFlightId: null };
      }
      const p = state.phase;
      if (p.tag === "ready" || p.tag === "switching") {
        return { ...state, phase: { tag: "ready", forms: p.forms, current }, inFlightId: null };
      }
      // Also set pendingCurrent so that a late-arriving formInit can promote to "ready"
      return { ...state, phase: { tag: "no-list", current }, pendingCurrent: current, inFlightId: null };
    }

    case "formError": {
      const { message } = action.payload;
      const prev = state.phase;
      const existingForms = (prev.tag === "ready" || prev.tag === "switching" || prev.tag === "error") ? prev.forms : undefined;
      const existingCurrent = (prev.tag === "ready" || prev.tag === "switching") ? prev.current : prev.tag === "error" ? prev.current : undefined;
      return { ...state, phase: { tag: "error", forms: existingForms, current: existingCurrent, message }, inFlightId: null };
    }

    case "setForm": {
      const { formid } = action.payload;
      const p = state.phase;
      if ((p.tag === "ready" || p.tag === "switching") && p.current.formid === formid) { return state; }
      if (state.inFlightId === formid) { return state; }
      return { ...state, pendingSetFormId: formid };
    }

    case "switchForm": {
      const p = state.phase;
      const newPhase: Phase =
        (p.tag === "ready" || p.tag === "switching") ? { tag: "switching", forms: p.forms, current: p.current }
        : (p.tag === "error" && p.forms && p.current) ? { tag: "switching", forms: p.forms, current: p.current }
        : p;
      return { ...state, phase: newPhase, inFlightId: action.payload.formid, pendingSetFormId: null };
    }

    case "switchTab": return { ...state, activeTab: action.payload };
    case "copyDone": return { ...state, copyLabel: "Copied!" };
    case "copyReset": return { ...state, copyLabel: "Copy" };

    default: return state;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FormViewer(): React.ReactElement {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { phase, activeTab, entityDisplayName, copyLabel } = state;

  useEffect(() => {
    dispatch({ type: "ready", meta: { toExtension: true } });
  }, []);

  useEffect(() => {
    if (state.pendingSetFormId) {
      dispatch({ type: "switchForm", payload: { formid: state.pendingSetFormId }, meta: { toExtension: true } });
    }
  }, [state.pendingSetFormId]);

  const handleFormChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>): void => {
    const formid = e.target.value;
    if (!formid) { return; }
    dispatch({ type: "setForm", payload: { formid } });
  }, []);

  const handleCopy = (): void => {
    if (phase.tag !== "ready" && phase.tag !== "no-list") { return; }
    const xml = phase.current.formxml;
    if (!xml) { return; }
    navigator.clipboard.writeText(formatXml(xml)).then(() => {
      dispatch({ type: "copyDone" });
      setTimeout(() => dispatch({ type: "copyReset" }), 1500);
    });
  };

  const currentForm =
    phase.tag === "ready" || phase.tag === "switching" || phase.tag === "no-list" ? phase.current
    : phase.tag === "error" && phase.current ? phase.current : null;

  const formsList =
    phase.tag === "ready" || phase.tag === "switching" ? phase.forms
    : phase.tag === "error" ? phase.forms : undefined;

  // Group forms by type for <optgroup>
  const groupedForms = useMemo(() => {
    if (!formsList) { return []; }
    const groups = new Map<number, EntityForm[]>();
    for (const f of formsList) {
      const list = groups.get(f.type) ?? [];
      list.push(f);
      groups.set(f.type, list);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a - b);
  }, [formsList]);

  // Parse formxml for Structure tab
  const formStructure = useMemo(
    () => parseFormStructure(currentForm?.formxml),
    [currentForm?.formxml],
  );

  // ── Structure tree nodes (must be before early returns) ──────────────────
  const structureNodes = useMemo((): TreeNode[] => {
    return formStructure.tabs.map((tab, ti) => ({
      id: `t${ti}`,
      label: tab.label || <span className="fv-label-empty">(unnamed tab)</span>,
      defaultExpanded: true,
      children: tab.sections.map((sec, si) => {
        const isSpecial = sec.name === "header" || sec.name === "footer";
        return {
          id: `t${ti}s${si}`,
          label: sec.label || <span className="fv-label-empty">(unnamed section)</span>,
          badges: isSpecial ? <span className="fv-section-type-badge">{sec.name}</span> : undefined,
          defaultExpanded: true,
          children: sec.fields.map((f: FormField, fi) => ({
            id: `t${ti}s${si}f${fi}`,
            label: <span className="fv-field-logical">{f.logicalName}</span>,
            secondary: f.label !== f.logicalName ? f.label : undefined,
            badges: f.isPcf ? <span className="fv-pcf-badge">PCF</span> : undefined,
          })),
        };
      }),
    }));
  }, [formStructure.tabs]);

  if (phase.tag === "loading") {
    return <div className="form-viewer"><div className="fv-loading">Loading…</div></div>;
  }
  if (phase.tag === "error" && !phase.forms) {
    return <div className="form-viewer"><div className="fv-error">{phase.message}</div></div>;
  }

  const structureContent = structureNodes.length === 0 ? (
    <div className="fv-empty">No structure data available</div>
  ) : (
    <TreeView nodes={structureNodes} className="fv-structure" />
  );

  // ── Libraries & Events tab ───────────────────────────────────────────────
  const eventRows = formStructure.events.map((e) => ({ ...e, field: e.field ?? "" }));
  const libEventsContent = (
    <div className="fv-lib-events">
      <div className="fv-section-heading">Libraries</div>
      <DataTable<FormLibrary>
        columns={LIBRARY_COLS}
        rows={formStructure.libraries}
        keyFormatter={(l) => l.webResourceName}
        emptyMessage="No libraries registered"
      />
      <div className="fv-section-heading" style={{ marginTop: 16 }}>Event Handlers</div>
      <DataTable<FormEvent & { field: string }>
        columns={EVENT_COLS}
        rows={eventRows}
        keyFormatter={(e, i) => `${e.event}-${e.field}-${i}`}
        emptyMessage="No event handlers"
      />
    </div>
  );

  // ── FormXML tab ───────────────────────────────────────────────────────────
  const rawXml = currentForm?.formxml;
  const prettyXml = rawXml ? formatXml(rawXml) : null;
  const formXmlContent = prettyXml ? (
    <div className="vd-fetchxml-wrap">
      <button className="vd-copy-btn" onClick={handleCopy} type="button">{copyLabel}</button>
      <textarea className="vd-fetchxml-textarea" readOnly value={prettyXml} spellCheck={false} />
    </div>
  ) : (
    <div className="fv-empty">No FormXML available</div>
  );

  return (
    <div className="form-viewer">
      {/* Header */}
      <div className="vd-header">
        {entityDisplayName && <span className="vd-entity-label">{entityDisplayName}</span>}
        {formsList && formsList.length > 0 ? (
          <select
            className="vd-view-select"
            value={currentForm?.formid ?? ""}
            onChange={handleFormChange}
            disabled={phase.tag === "switching"}
          >
            {groupedForms.map(([type, forms]) => (
              <optgroup key={type} label={formTypeGroupLabel(type)}>
                {forms.map((f) => (
                  <option key={f.formid} value={f.formid}>{f.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        ) : phase.tag === "no-list" ? (
          <span className="vd-no-list-note">Form list unavailable</span>
        ) : null}
      </div>

      {/* Meta row */}
      {currentForm && (
        <div className="vd-meta-row">
          <span className="vd-meta-item">Type:<span>{formTypeGroupLabel(currentForm.type)}</span></span>
          {currentForm.ismanaged && <span className="vd-meta-item">Managed:<span>Yes</span></span>}
          {currentForm.description && (
            <span className="fv-meta-description" title={currentForm.description}>{currentForm.description}</span>
          )}
        </div>
      )}

      {/* Tab bar */}
      <TabBar
        tabs={TABS as unknown as { id: string; label: string }[]}
        active={activeTab}
        onChange={(id) => dispatch({ type: "switchTab", payload: id as Tab })}
      />

      {/* Content */}
      <div className={`vd-content${phase.tag === "switching" ? " switching" : ""}`}>
        {phase.tag === "error" && (
          <div className="fv-error" style={{ padding: "8px 12px", flexShrink: 0 }}>{phase.message}</div>
        )}
        {activeTab === "structure"  && structureContent}
        {activeTab === "libraries"  && libEventsContent}
        {activeTab === "formxml"    && formXmlContent}
      </div>
    </div>
  );
}
