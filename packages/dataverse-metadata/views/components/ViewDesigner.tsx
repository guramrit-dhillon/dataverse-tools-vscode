import * as React from "react";
import { useCallback, useEffect, useMemo } from "react";
import { useReducer, TabBar, DataTable } from "shared-views";
import type { TableColumnDefinition } from "shared-views";
import type { EntityView } from "../../src/types/metadata";
import { parseLayoutColumns, type LayoutColumn } from "../utils/parseLayoutColumns";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = "columns" | "fetchxml";

type Phase =
  | { tag: "loading" }
  | { tag: "ready"; views: EntityView[]; current: EntityView }
  | { tag: "switching"; views: EntityView[]; current: EntityView }
  | { tag: "error"; views?: EntityView[]; current?: EntityView; message: string }
  | { tag: "no-list"; current: EntityView };

interface State {
  entityDisplayName: string;
  phase: Phase;
  activeTab: Tab;
  inFlightId: string | null;
  pendingViews: EntityView[] | null;
  pendingCurrent: EntityView | null;
  pendingSwitchViewId: string | null;
  copyLabel: string;
}

type Action =
  // Extension → webview (no meta)
  | { type: "init"; payload?: undefined }
  | { type: "viewInit"; payload: { views: EntityView[]; entityDisplayName: string } }
  | { type: "viewLoaded"; payload: { current: EntityView } }
  | { type: "viewError"; payload: { message: string } }
  | { type: "setView"; payload: { savedqueryid: string } }
  // Webview → extension
  | { type: "ready"; meta: { toExtension: true } }
  | { type: "switchView"; payload: { savedqueryid: string }; meta: { toExtension: true } }
  // Local only
  | { type: "switchTab"; payload: Tab }
  | { type: "copyDone" }
  | { type: "copyReset" };

const QUERY_TYPE_LABELS: Record<number, string> = {
  0: "Public Views",
  1: "Advanced Find",
  2: "Associated",
  4: "Quick Find",
  64: "Lookup",
};

const VIEW_TYPE_LABEL: Record<number, string> = {
  0: "Public View",
  1: "Advanced Find",
  2: "Associated",
  4: "Quick Find",
  64: "Lookup",
};

function queryTypeGroupLabel(qt: number): string {
  return QUERY_TYPE_LABELS[qt] ?? "Other";
}

function viewTypeLabel(qt: number): string {
  return VIEW_TYPE_LABEL[qt] ?? `Type ${qt}`;
}

const TABS = [
  { id: "columns", label: "Columns" },
  { id: "fetchxml", label: "FetchXML" },
] as const;

const LAYOUT_COLS: TableColumnDefinition<LayoutColumn>[] = [
  { key: "name", label: "Logical Name" },
  { key: "width", label: "Width", type: "number" },
];

function formatXml(xml: string): string {
  const INDENT = "  ";
  try {
    const normalized = xml.replace(/>\s+</g, "><").trim();
    const tokens = normalized.match(/<[^>]+>|[^<]+/g) ?? [];
    let level = 0;
    const lines: string[] = [];
    for (const token of tokens) {
      if (!token.trim()) { continue; }
      if (token.startsWith("</")) {
        level = Math.max(0, level - 1);
        lines.push(INDENT.repeat(level) + token);
      } else if (token.startsWith("<") && !token.startsWith("<?") && !token.endsWith("/>")) {
        lines.push(INDENT.repeat(level) + token);
        level++;
      } else {
        lines.push(INDENT.repeat(level) + token);
      }
    }
    return lines.join("\n");
  } catch {
    return xml;
  }
}

// ── Initial state ─────────────────────────────────────────────────────────────

const initialState: State = {
  entityDisplayName: "",
  phase: { tag: "loading" },
  activeTab: "columns",
  inFlightId: null,
  pendingViews: null,
  pendingCurrent: null,
  pendingSwitchViewId: null,
  copyLabel: "Copy",
};

// ── Reducer ───────────────────────────────────────────────────────────────────

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "init":
      return state;

    case "viewInit": {
      const { views, entityDisplayName } = action.payload;
      if (state.pendingCurrent) {
        // viewLoaded arrived first — transition to ready now
        return {
          ...state,
          entityDisplayName,
          phase: { tag: "ready", views, current: state.pendingCurrent },
          pendingCurrent: null,
          pendingViews: null,
        };
      }
      return {
        ...state,
        entityDisplayName,
        pendingViews: views,
      };
    }

    case "viewLoaded": {
      const { current } = action.payload;
      if (state.pendingViews) {
        // viewInit arrived first — transition to ready now
        return {
          ...state,
          phase: { tag: "ready", views: state.pendingViews, current },
          pendingViews: null,
          pendingCurrent: null,
          inFlightId: null,
        };
      }
      const p = state.phase;
      if (p.tag === "ready" || p.tag === "switching") {
        return {
          ...state,
          phase: { tag: "ready", views: p.views, current },
          inFlightId: null,
        };
      }
      // No views list yet — show in no-list mode, stash for later viewInit
      return {
        ...state,
        phase: { tag: "no-list", current },
        pendingCurrent: current,
        inFlightId: null,
      };
    }

    case "viewError": {
      const { message } = action.payload;
      const prev = state.phase;
      const existingViews = (prev.tag === "ready" || prev.tag === "switching" || prev.tag === "error") ? prev.views : undefined;
      const existingCurrent = (prev.tag === "ready" || prev.tag === "switching") ? prev.current
        : prev.tag === "error" ? prev.current : undefined;
      return { ...state, phase: { tag: "error", views: existingViews, current: existingCurrent, message }, inFlightId: null };
    }

    case "setView": {
      const { savedqueryid } = action.payload;
      const p = state.phase;
      // No-op if same as current
      if (
        (p.tag === "ready" || p.tag === "switching") &&
        p.current.savedqueryid === savedqueryid
      ) {
        return state;
      }
      // No-op if same as in-flight
      if (state.inFlightId === savedqueryid) {
        return state;
      }
      return { ...state, pendingSwitchViewId: savedqueryid };
    }

    case "switchView": {
      const { savedqueryid } = action.payload;
      const p = state.phase;
      const newPhase: Phase =
        (p.tag === "ready" || p.tag === "switching")
          ? { tag: "switching", views: p.views, current: p.current }
          : (p.tag === "error" && p.views && p.current)
          ? { tag: "switching", views: p.views, current: p.current }
          : p;
      return { ...state, phase: newPhase, inFlightId: savedqueryid, pendingSwitchViewId: null };
    }

    case "switchTab":
      return { ...state, activeTab: action.payload };

    case "copyDone":
      return { ...state, copyLabel: "Copied!" };

    case "copyReset":
      return { ...state, copyLabel: "Copy" };

    default:
      return state;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ViewDesigner(): React.ReactElement {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { phase, activeTab, entityDisplayName, copyLabel } = state;

  // Signal ready on mount
  useEffect(() => {
    dispatch({ type: "ready", meta: { toExtension: true } });
  }, []);

  // Side-effect: pendingSwitchViewId → dispatch switchView (to extension)
  useEffect(() => {
    if (state.pendingSwitchViewId) {
      dispatch({
        type: "switchView",
        payload: { savedqueryid: state.pendingSwitchViewId },
        meta: { toExtension: true },
      });
    }
  }, [state.pendingSwitchViewId]);

  // ── Dropdown change ──────────────────────────────────────────────────────

  const handleViewChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>): void => {
    const savedqueryid = e.target.value;
    if (!savedqueryid) { return; }
    dispatch({ type: "setView", payload: { savedqueryid } });
  }, [dispatch]);

  // ── Copy FetchXML ────────────────────────────────────────────────────────

  const handleCopy = (): void => {
    if (phase.tag !== "ready" && phase.tag !== "no-list") { return; }
    const xml = phase.current.fetchxml;
    if (!xml) { return; }
    navigator.clipboard.writeText(xml).then(() => {
      dispatch({ type: "copyDone" });
      setTimeout(() => dispatch({ type: "copyReset" }), 1500);
    });
  };

  // ── Render helpers ───────────────────────────────────────────────────────

  const currentView =
    phase.tag === "ready" || phase.tag === "switching" || phase.tag === "no-list"
      ? phase.current
      : phase.tag === "error" && phase.current
      ? phase.current
      : null;

  const viewsList =
    phase.tag === "ready" || phase.tag === "switching"
      ? phase.views
      : phase.tag === "error"
      ? phase.views
      : undefined;

  // Group views by querytype for optgroup
  const groupedViews = useMemo(() => {
    if (!viewsList) { return []; }
    const groups = new Map<number, EntityView[]>();
    for (const v of viewsList) {
      const list = groups.get(v.querytype) ?? [];
      list.push(v);
      groups.set(v.querytype, list);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a - b);
  }, [viewsList]);

  // ── Loading state ────────────────────────────────────────────────────────

  if (phase.tag === "loading") {
    return (
      <div className="view-designer">
        <div className="vd-loading">Loading\u2026</div>
      </div>
    );
  }

  // ── Error state (no views to fall back on) ───────────────────────────────

  if (phase.tag === "error" && !phase.views) {
    return (
      <div className="view-designer">
        <div className="vd-error">{phase.message}</div>
      </div>
    );
  }

  // ── Columns tab content ──────────────────────────────────────────────────

  const columns = currentView ? parseLayoutColumns(currentView.layoutxml) : [];

  const columnsContent = (
    <DataTable<LayoutColumn>
      columns={LAYOUT_COLS}
      rows={columns}
      keyFormatter={(col) => col.name}
      emptyMessage="No column data available"
    />
  );

  // ── FetchXML tab content ─────────────────────────────────────────────────

  const fetchxml = currentView?.fetchxml;
  const fetchxmlContent = fetchxml ? (
    <div className="vd-fetchxml-wrap">
      <button className="vd-copy-btn" onClick={handleCopy} type="button">
        {copyLabel}
      </button>
      <textarea
        className="vd-fetchxml-textarea"
        readOnly
        value={formatXml(fetchxml)}
        spellCheck={false}
      />
    </div>
  ) : (
    <div className="vd-empty">No FetchXML available</div>
  );

  // ── Main render ──────────────────────────────────────────────────────────

  return (
    <div className="view-designer">
      {/* Header with entity label + dropdown */}
      <div className="vd-header">
        {entityDisplayName && (
          <span className="vd-entity-label">{entityDisplayName}</span>
        )}
        {viewsList && viewsList.length > 0 ? (
          <select
            className="vd-view-select"
            value={currentView?.savedqueryid ?? ""}
            onChange={handleViewChange}
            disabled={phase.tag === "switching"}
          >
            {groupedViews.map(([qt, views]) => (
              <optgroup key={qt} label={queryTypeGroupLabel(qt)}>
                {views.map((v) => (
                  <option key={v.savedqueryid} value={v.savedqueryid}>
                    {v.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        ) : phase.tag === "no-list" ? (
          <span className="vd-no-list-note">View list unavailable</span>
        ) : null}
      </div>

      {/* Meta row */}
      {currentView && (
        <div className="vd-meta-row">
          <span className="vd-meta-item">
            Type:<span>{viewTypeLabel(currentView.querytype)}</span>
          </span>
          {currentView.isdefault && (
            <span className="vd-meta-item">
              Default:<span>Yes</span>
            </span>
          )}
          {currentView.ismanaged && (
            <span className="vd-meta-item">
              Managed:<span>Yes</span>
            </span>
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
        {/* Error banner (inline, when views exist) */}
        {phase.tag === "error" && (
          <div className="vd-error" style={{ padding: "8px 12px", flexShrink: 0 }}>
            {phase.message}
          </div>
        )}
        {activeTab === "columns" && columnsContent}
        {activeTab === "fetchxml" && fetchxmlContent}
      </div>
    </div>
  );
}
