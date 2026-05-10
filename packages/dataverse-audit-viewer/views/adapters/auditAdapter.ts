import { useMemo } from "react";
import type { TableColumnDefinition } from "shared-views";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AuditChange {
  attributeName: string;
  displayName: string;
  oldValue: string | null;
  newValue: string | null;
}

export interface AuditRow {
  auditid: string;
  createdon: string;
  userId: string;
  userDisplayName: string;
  operation: string;
  action: string;
  transactionId?: string;
  changes: AuditChange[];
}

/**
 * One display row in the table. Each AuditRow with N changes is exploded into
 * N FlatAuditRows; audits with no changes produce one row with empty change cells.
 * `audit` references the parent record so the detail panel works after selection.
 */
export interface FlatAuditRow {
  /** Stable composite key for the table row. */
  rowKey: string;
  audit: AuditRow;
  /** Index of this change within `audit.changes`. -1 when the audit has no changes. */
  changeIndex: number;
  /** True when this is the first display row of its audit — used to render audit-level cells. */
  isFirstOfAudit: boolean;
  /** Same as audit.transactionId — duplicated for adapter convenience. */
  transactionId?: string;
  /** CSS class index 0..7 when the transactionId is shared by 2+ audits, else null. */
  txGroupIndex: number | null;
  /** True when the audit immediately preceding this one had a different transactionId. */
  isTxGroupBoundary: boolean;
  /** Field/old/new for this row (empty strings when audit has no changes). */
  fieldDisplay: string;
  oldValueDisplay: string;
  newValueDisplay: string;
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

const TX_GROUP_CLASS_COUNT = 8;

/** Stable small hash → 0..N-1 bucket (FNV-1a 32-bit). */
function hashToBucket(s: string, buckets: number): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return Math.abs(h >>> 0) % buckets;
}

/**
 * Flattens AuditRows into one display row per change, annotates each with its
 * transactionId-group color index (only when the txid appears in 2+ audits),
 * and marks rows that begin a new transaction group.
 */
export function flattenAuditRows(rows: AuditRow[]): FlatAuditRow[] {
  // Count distinct audits per transactionId — only color groups with 2+ members.
  const auditsByTx = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!r.transactionId) { continue; }
    let set = auditsByTx.get(r.transactionId);
    if (!set) {
      set = new Set();
      auditsByTx.set(r.transactionId, set);
    }
    set.add(r.auditid);
  }

  const flat: FlatAuditRow[] = [];
  let prevTxId: string | undefined;
  for (const audit of rows) {
    const txId = audit.transactionId;
    const groupSize = txId ? auditsByTx.get(txId)?.size ?? 0 : 0;
    const txGroupIndex = txId && groupSize >= 2 ? hashToBucket(txId, TX_GROUP_CLASS_COUNT) : null;
    const isTxGroupBoundary = audit.transactionId !== prevTxId;
    prevTxId = audit.transactionId;

    if (audit.changes.length === 0) {
      flat.push({
        rowKey: audit.auditid,
        audit,
        changeIndex: -1,
        isFirstOfAudit: true,
        transactionId: audit.transactionId,
        txGroupIndex,
        isTxGroupBoundary,
        fieldDisplay: "",
        oldValueDisplay: "",
        newValueDisplay: "",
      });
      continue;
    }

    audit.changes.forEach((c, i) => {
      flat.push({
        rowKey: `${audit.auditid}#${i}`,
        audit,
        changeIndex: i,
        isFirstOfAudit: i === 0,
        transactionId: audit.transactionId,
        txGroupIndex,
        // Only flag the boundary on the first row of the audit, otherwise the
        // multi-row audit looks like its own boundary internally.
        isTxGroupBoundary: i === 0 && isTxGroupBoundary,
        fieldDisplay: c.displayName,
        oldValueDisplay: c.oldValue ?? "",
        newValueDisplay: c.newValue ?? "",
      });
    });
  }
  return flat;
}

// ── Adapter hook ──────────────────────────────────────────────────────────────

export interface AuditAdapterResult {
  columns: TableColumnDefinition<FlatAuditRow>[];
  keyFormatter: (row: FlatAuditRow) => string;
  rowClassName: (row: FlatAuditRow) => string;
}

export function useAuditAdapter(): AuditAdapterResult {
  const columns: TableColumnDefinition<FlatAuditRow>[] = useMemo(() => [
    {
      key: "createdon",
      label: "Time",
      type: "date" as const,
      valueFormatter: (_v, row) => row.isFirstOfAudit ? formatTime(row.audit.createdon) : "",
    },
    {
      key: "userDisplayName",
      label: "User",
      valueFormatter: (_v, row) => row.isFirstOfAudit ? row.audit.userDisplayName : "",
    },
    {
      key: "operation",
      label: "Operation",
      valueFormatter: (_v, row) => row.isFirstOfAudit ? row.audit.operation : "",
    },
    {
      key: "action",
      label: "Action",
      valueFormatter: (_v, row) => row.isFirstOfAudit ? row.audit.action : "",
    },
    { key: "fieldDisplay", label: "Field" },
    { key: "oldValueDisplay", label: "Old Value" },
    { key: "newValueDisplay", label: "New Value" },
  ], []);

  return {
    columns,
    keyFormatter: (row: FlatAuditRow) => row.rowKey,
    rowClassName: (row: FlatAuditRow) => {
      const parts = ["audit-row"];
      if (row.txGroupIndex !== null) { parts.push(`tx-group-${row.txGroupIndex}`); }
      if (row.isTxGroupBoundary) { parts.push("tx-group-boundary"); }
      if (!row.isFirstOfAudit) { parts.push("audit-row-continuation"); }
      return parts.join(" ");
    },
  };
}
