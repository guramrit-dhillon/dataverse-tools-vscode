import { useMemo } from "react";
import type { TableColumnDefinition } from "shared-views";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TraceLog {
  plugintracelogid: string;
  correlationid?: string;
  typename: string;
  messagename: string;
  primaryentity?: string;
  depth: number;
  mode: number;
  operationtype: number;
  exceptiondetails?: string;
  messageblock?: string;
  performanceconstructorduration?: number;
  performanceexecutionduration?: number;
  createdon: string;
  [annotation: `${string}@${string}`]: string | undefined;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortTypeName(typename: string): string {
  return typename.split(",")?.[0] ?? typename;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
}

function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) { return "\u2014"; }
  if (ms >= 1000) { return `${(ms / 1000).toFixed(1)}s`; }
  return `${ms}ms`;
}

// ── Adapter hook ──────────────────────────────────────────────────────────────

export interface TraceLogAdapterResult {
  columns: TableColumnDefinition<TraceLog>[];
  keyFormatter: (row: TraceLog) => string;
  rowClassName: (row: TraceLog) => string;
}

export function useTraceLogAdapter(): TraceLogAdapterResult {
  const columns: TableColumnDefinition<TraceLog>[] = useMemo(() => [
    { key: "createdon", label: "Time", type: "date" as const, valueFormatter: formatTime },
    { key: "performanceexecutionduration", label: "Duration", type: "number" as const, valueFormatter: (v: unknown) => formatDuration(v as number | null | undefined) },
    { key: "typename", label: "Plugin", valueFormatter: shortTypeName },
    { key: "messagename", label: "Message" },
    { key: "primaryentity", label: "Entity" },
    { key: "mode", label: "Mode", valueFormatter: (_v: unknown, row: TraceLog) => row["mode@OData.Community.Display.V1.FormattedValue"] ?? String(row.mode) },
    { key: "depth", label: "Depth", type: "number" as const },
  ], []);

  return {
    columns,
    keyFormatter: (row: TraceLog) => row.plugintracelogid,
    rowClassName: (log: TraceLog) => [
      "log-row",
      log.exceptiondetails ? "has-error" : "",
    ].filter(Boolean).join(" "),
  };
}
