import * as React from "react";
import { useMemo } from "react";
import { Codicon } from "shared-views";
import type { TableColumnDefinition, ResultsViewerProps, ResultsViewerTab } from "shared-views";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface QueryResults {
  fetchXml: string;
  columns: string[];
  rows: Record<string, unknown>[];
  totalCount?: number;
  durationMs?: number;
  friendlyNames?: Record<string, string>;
  columnTypes?: Record<string, "number" | "date">;
  error?: string;
}

export type NameMode = "logical" | "friendly" | "both";

/** Suffix Dataverse appends to a field key when FormattedValue annotation is requested. */
const FMTVAL = "@OData.Community.Display.V1.FormattedValue";

// ── Helpers ───────────────────────────────────────────────────────────────────

function cellToString(val: unknown): string {
  if (val === null || val === undefined) { return ""; }
  if (typeof val === "object") { return JSON.stringify(val); }
  return String(val);
}

// ── Adapter hook ──────────────────────────────────────────────────────────────

type AdapterResult = Pick<
  ResultsViewerProps<Record<string, unknown>>,
  "columns" | "rows" | "totalRows" | "durationMs" | "error" | "tabs" |
  "filterPredicate" | "csvCellFormatter" | "filterBarTrailing" | "exportFileName"
>;

export function useFetchXmlAdapter(
  results: QueryResults | null,
  nameMode: NameMode,
  onNameModeChange: (mode: NameMode) => void,
): AdapterResult | null {
  const hasFriendlyNames = results
    ? results.friendlyNames && Object.keys(results.friendlyNames).length > 0
    : false;

  const columns: TableColumnDefinition<Record<string, unknown>>[] = useMemo(() => {
    if (!results) { return []; }
    return results.columns.map((col) => {
      const friendly = results.friendlyNames?.[col];
      const logicalLabel = (col.startsWith("_") && col.endsWith("_value") ? col.slice(1, -6) : col)
        .replace(/_x002e_/g, ".");
      let label: string;
      if (nameMode === "friendly" && friendly) {
        label = friendly;
      } else if (nameMode === "both" && friendly && friendly !== logicalLabel) {
        label = `${friendly} (${logicalLabel})`;
      } else {
        label = logicalLabel;
      }

      return {
        key: col,
        label,
        type: results.columnTypes?.[col] ?? "text",
        valueFormatter: (val: unknown, row: Record<string, unknown>) => {
          if (nameMode !== "logical") {
            const formatted = row[col + FMTVAL];
            if (formatted !== null && formatted !== undefined) {
              if (nameMode === "both") {
                const raw = val === null || val === undefined ? "" : typeof val === "object" ? JSON.stringify(val) : String(val);
                const fmtStr = String(formatted);
                return raw === fmtStr ? fmtStr : `${fmtStr} (${raw})`;
              }
              return String(formatted);
            }
          }
          if (val === null || val === undefined) { return "—"; }
          if (typeof val === "object") { return JSON.stringify(val); }
          return String(val);
        },
      };
    });
  }, [results, nameMode]);

  const filterPredicate = useMemo(() => {
    if (!results) { return undefined; }
    return (row: Record<string, unknown>, text: string): boolean => {
      const lower = text.toLowerCase();
      return results.columns.some((col) => {
        const raw = cellToString(row[col]);
        const fmt = row[col + FMTVAL];
        const fmtStr = fmt !== null && fmt !== undefined ? String(fmt) : "";
        return raw.toLowerCase().includes(lower) || fmtStr.toLowerCase().includes(lower);
      });
    };
  }, [results]);

  const csvCellFormatter = useMemo(() => {
    return (col: TableColumnDefinition<Record<string, unknown>>, row: Record<string, unknown>): string => {
      const val = row[col.key];
      const display = col.valueFormatter ? col.valueFormatter(val, row) : cellToString(val);
      return display === "—" ? "" : display;
    };
  }, []);

  const tabs: ResultsViewerTab[] = useMemo(() => {
    if (!results) { return []; }
    return [
      {
        id: "xml",
        label: "FetchXML",
        icon: React.createElement(Codicon, { name: "code" }),
        content: results.fetchXml,
        isCodeBlock: true,
      },
      {
        id: "json",
        label: "JSON",
        icon: React.createElement(Codicon, { name: "json" }),
        content: JSON.stringify(results.rows, null, 2),
        isCodeBlock: true,
      },
    ];
  }, [results]);

  const filterBarTrailing = useMemo(() => {
    if (!hasFriendlyNames) { return undefined; }
    return React.createElement("div", { className: "name-mode-toggle" },
      (["logical", "friendly", "both"] as NameMode[]).map((mode) =>
        React.createElement("button", {
          key: mode,
          type: "button",
          className: `name-mode-btn${nameMode === mode ? " active" : ""}`,
          onClick: () => onNameModeChange(mode),
          title: mode === "logical" ? "Show logical attribute names"
            : mode === "friendly" ? "Show display names and formatted values"
            : "Show both display name and logical name",
        }, mode === "logical" ? "Logical" : mode === "friendly" ? "Friendly" : "Both")
      )
    );
  }, [hasFriendlyNames, nameMode, onNameModeChange]);

  if (!results) { return null; }

  return {
    columns,
    rows: results.rows,
    totalRows: results.totalCount ?? results.rows.length,
    durationMs: results.durationMs,
    error: results.error,
    tabs,
    filterPredicate,
    csvCellFormatter,
    filterBarTrailing,
    exportFileName: "results",
  };
}
