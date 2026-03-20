import * as React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import { TabBar } from "shared-views";
import vscode from "shared-views/vscode";
import type { EntityView } from "../../src/types/metadata";
import { parseLayoutColumns } from "../utils/parseLayoutColumns";

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase =
  | { tag: "loading" }
  | { tag: "ready"; views: EntityView[]; current: EntityView }
  | { tag: "switching"; views: EntityView[]; current: EntityView }
  | { tag: "error"; views?: EntityView[]; message: string }
  | { tag: "no-list"; current: EntityView };

type Tab = "columns" | "fetchxml";

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

// ── Component ─────────────────────────────────────────────────────────────────

export function ViewDesigner(): React.ReactElement {
  const [phase, setPhase] = useState<Phase>({ tag: "loading" });
  const [activeTab, setActiveTab] = useState<Tab>("columns");
  const [entityDisplayName, setEntityDisplayName] = useState("");
  const [copyLabel, setCopyLabel] = useState("Copy");

  // Refs to track pending data during initialization
  const pendingViewsRef = useRef<EntityView[] | null>(null);
  const pendingCurrentRef = useRef<EntityView | null>(null);
  const inFlightIdRef = useRef<string | null>(null);

  const postMessage = useCallback((msg: { type: string; [key: string]: unknown }) => {
    vscode?.postMessage(msg);
  }, []);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg?.type) { return; }

      switch (msg.type) {
        case "viewInit": {
          const views = msg.views as EntityView[];
          if (msg.entityDisplayName) {
            setEntityDisplayName(msg.entityDisplayName as string);
          }
          // If we already received a current view, transition to ready
          if (pendingCurrentRef.current) {
            const current = pendingCurrentRef.current;
            pendingCurrentRef.current = null;
            inFlightIdRef.current = null;
            setPhase({ tag: "ready", views, current });
          } else {
            pendingViewsRef.current = views;
          }
          break;
        }

        case "viewLoaded": {
          const current = msg.current as EntityView;
          inFlightIdRef.current = null;

          // If we already have a views list, transition to ready
          if (pendingViewsRef.current) {
            const views = pendingViewsRef.current;
            pendingViewsRef.current = null;
            setPhase({ tag: "ready", views, current });
          } else {
            setPhase((prev) => {
              if (prev.tag === "ready" || prev.tag === "switching") {
                return { tag: "ready", views: prev.views, current };
              }
              // No views list yet — show in no-list mode
              pendingCurrentRef.current = null;
              return { tag: "no-list", current };
            });
            // Also stash as pending in case viewInit comes later
            if (phase.tag === "loading") {
              pendingCurrentRef.current = current;
            }
          }
          break;
        }

        case "viewError": {
          const message = msg.message as string;
          inFlightIdRef.current = null;
          setPhase((prev) => {
            const views = (prev.tag === "ready" || prev.tag === "switching")
              ? prev.views
              : (prev.tag === "error" ? prev.views : undefined);
            return { tag: "error", views, message };
          });
          break;
        }

        case "setView": {
          const id = msg.savedqueryid as string;
          setPhase((prev) => {
            // If same as current, no-op
            if ((prev.tag === "ready" || prev.tag === "switching") && prev.current.savedqueryid === id) {
              return prev;
            }
            // If same as in-flight, no-op
            if (inFlightIdRef.current === id) {
              return prev;
            }
            // Post switchView and transition to switching
            inFlightIdRef.current = id;
            postMessage({ type: "switchView", savedqueryid: id });

            if (prev.tag === "ready" || prev.tag === "switching") {
              return { tag: "switching", views: prev.views, current: prev.current };
            }
            return prev;
          });
          break;
        }
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [phase.tag, postMessage]);

  // ── Dropdown change ───────────────────────────────────────────────────────

  const handleViewChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const savedqueryid = e.target.value;
    if (!savedqueryid) { return; }

    inFlightIdRef.current = savedqueryid;
    postMessage({ type: "switchView", savedqueryid });

    setPhase((prev) => {
      if (prev.tag === "ready" || prev.tag === "switching") {
        return { tag: "switching", views: prev.views, current: prev.current };
      }
      return prev;
    });
  }, [postMessage]);

  // ── Copy FetchXML ─────────────────────────────────────────────────────────

  const handleCopy = useCallback(() => {
    if (phase.tag !== "ready" && phase.tag !== "no-list") { return; }
    const xml = phase.current.fetchxml;
    if (!xml) { return; }
    navigator.clipboard.writeText(xml).then(() => {
      setCopyLabel("Copied!");
      setTimeout(() => setCopyLabel("Copy"), 1500);
    });
  }, [phase]);

  // ── Render helpers ────────────────────────────────────────────────────────

  const currentView = (phase.tag === "ready" || phase.tag === "switching" || phase.tag === "no-list")
    ? phase.current
    : null;

  const viewsList = (phase.tag === "ready" || phase.tag === "switching")
    ? phase.views
    : (phase.tag === "error" ? phase.views : undefined);

  // Group views by querytype for optgroup
  const groupedViews = React.useMemo(() => {
    if (!viewsList) { return []; }
    const groups = new Map<number, EntityView[]>();
    for (const v of viewsList) {
      const list = groups.get(v.querytype) ?? [];
      list.push(v);
      groups.set(v.querytype, list);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a - b);
  }, [viewsList]);

  // ── Loading state ─────────────────────────────────────────────────────────

  if (phase.tag === "loading") {
    return (
      <div className="view-designer">
        <div className="vd-loading">Loading view...</div>
      </div>
    );
  }

  // ── Error state (no views to fall back on) ────────────────────────────────

  if (phase.tag === "error" && !phase.views) {
    return (
      <div className="view-designer">
        <div className="vd-error">{phase.message}</div>
      </div>
    );
  }

  // ── Columns tab content ───────────────────────────────────────────────────

  const columns = currentView ? parseLayoutColumns(currentView.layoutxml) : [];

  const columnsContent = columns.length > 0 ? (
    <table className="vd-columns-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Attribute</th>
          <th>Width</th>
        </tr>
      </thead>
      <tbody>
        {columns.map((col, i) => (
          <tr key={col.name}>
            <td>{i + 1}</td>
            <td>{col.name}</td>
            <td>{col.width}</td>
          </tr>
        ))}
      </tbody>
    </table>
  ) : (
    <div className="vd-empty">No column data available</div>
  );

  // ── FetchXML tab content ──────────────────────────────────────────────────

  const fetchxml = currentView?.fetchxml;
  const fetchxmlContent = fetchxml ? (
    <div className="vd-fetchxml-wrap">
      <button className="vd-copy-btn" onClick={handleCopy} type="button">{copyLabel}</button>
      <pre className="vd-fetchxml-pre">{fetchxml}</pre>
    </div>
  ) : (
    <div className="vd-empty">No FetchXML available</div>
  );

  // ── Main render ───────────────────────────────────────────────────────────

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
          <span className="vd-no-list-note">Single view mode</span>
        ) : null}
      </div>

      {/* Meta row */}
      {currentView && (
        <div className="vd-meta-row">
          <span className="vd-meta-item">Type:<span>{viewTypeLabel(currentView.querytype)}</span></span>
          {currentView.isdefault && (
            <span className="vd-meta-item">Default:<span>Yes</span></span>
          )}
          {currentView.ismanaged && (
            <span className="vd-meta-item">Managed:<span>Yes</span></span>
          )}
        </div>
      )}

      {/* Error banner */}
      {phase.tag === "error" && (
        <div className="vd-error" style={{ padding: "8px 12px", flexShrink: 0 }}>{phase.message}</div>
      )}

      {/* Tab bar */}
      <TabBar
        tabs={TABS as unknown as { id: string; label: string }[]}
        active={activeTab}
        onChange={(id) => setActiveTab(id as Tab)}
      />

      {/* Content */}
      <div className={`vd-content${phase.tag === "switching" ? " switching" : ""}`}>
        {activeTab === "columns" && columnsContent}
        {activeTab === "fetchxml" && fetchxmlContent}
      </div>
    </div>
  );
}
