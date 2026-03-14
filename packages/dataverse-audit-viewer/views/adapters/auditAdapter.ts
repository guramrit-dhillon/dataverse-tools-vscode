import { useMemo } from "react";
import type { TableColumnDefinition } from "shared-views";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AuditRow {
  auditid: string;
  createdon: string;
  userId: string;
  userDisplayName: string;
  operation: string;
  action: string;
  transactionId?: string;
  changes: Array<{
    attributeName: string;
    displayName: string;
    oldValue: string | null;
    newValue: string | null;
  }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

// ── Adapter hook ──────────────────────────────────────────────────────────────

export interface AuditAdapterResult {
  columns: TableColumnDefinition<AuditRow>[];
  keyFormatter: (row: AuditRow) => string;
  rowClassName: (row: AuditRow) => string;
}

export function useAuditAdapter(): AuditAdapterResult {
  const columns: TableColumnDefinition<AuditRow>[] = useMemo(() => [
    { key: "createdon", label: "Time", type: "date" as const, valueFormatter: formatTime },
    { key: "userDisplayName", label: "User" },
    { key: "operation", label: "Operation" },
    { key: "action", label: "Action" },
  ], []);

  return {
    columns,
    keyFormatter: (row: AuditRow) => row.auditid,
    rowClassName: () => "audit-row",
  };
}
