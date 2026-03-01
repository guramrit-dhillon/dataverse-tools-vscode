import * as React from "react";
import { useMemo } from "react";
import { Codicon } from "shared-views";
import type { TableColumnDefinition, ResultsViewerTab } from "shared-views";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ColumnInfo {
  name: string;
  type: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) { return "NULL"; }
  if (value instanceof Date) { return value.toISOString(); }
  if (typeof value === "object") { return JSON.stringify(value); }
  return String(value);
}

// ── Adapter hook ──────────────────────────────────────────────────────────────

export interface QueryAdapterResult {
  columns: TableColumnDefinition<Record<string, unknown>>[];
  tabs: ResultsViewerTab[];
}

export function useQueryResultsAdapter(
  columns: ColumnInfo[],
  rows: Record<string, unknown>[],
  messages: string[],
): QueryAdapterResult {
  const tableColumns: TableColumnDefinition<Record<string, unknown>>[] = useMemo(
    () =>
      columns.map((col) => ({
        key: col.name,
        label: col.name,
        valueFormatter: (v: unknown) => formatCellValue(v),
        resizable: true,
        sortable: true,
      })),
    [columns]
  );

  const tabs: ResultsViewerTab[] = useMemo(() => [
    {
      id: "messages",
      label: `Messages (${messages.length})`,
      icon: React.createElement(Codicon, { name: "output" }),
      renderTab: () => {
        if (messages.length === 0) {
          return React.createElement("div", { className: "rv-empty-state" },
            React.createElement("span", { className: "rv-empty-state-text" }, "No messages.")
          );
        }
        return React.createElement("div", { className: "rv-code-content" },
          React.createElement("pre", { className: "rv-code-block" }, messages.join("\n"))
        );
      },
    },
    {
      id: "json",
      label: "JSON",
      icon: React.createElement(Codicon, { name: "json" }),
      content: rows.length > 0 ? JSON.stringify(rows, null, 2) : "",
      isCodeBlock: true,
    },
  ], [messages, rows]);

  return { columns: tableColumns, tabs };
}
