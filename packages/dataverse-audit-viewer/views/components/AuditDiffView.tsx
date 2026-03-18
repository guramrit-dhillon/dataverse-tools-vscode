import * as React from "react";
import { Codicon, IconButton } from "shared-views";
import type { AuditRow } from "../adapters/auditAdapter";

interface AuditChange {
  attributeName: string;
  displayName: string;
  oldValue: string | null;
  newValue: string | null;
}

interface AuditDiffViewProps {
  record: AuditRow;
  changes: AuditChange[] | null;
  detailLoading: boolean;
  onClose: () => void;
  onCopy: (text: string, field: string) => void;
  copiedField: string | null;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function AuditDiffView({ record, changes, detailLoading, onClose, onCopy, copiedField }: AuditDiffViewProps): React.ReactElement {
  const hasChanges = changes !== null && changes.length > 0;

  const diffText = changes
    ? changes.map((c) => `${c.displayName}: ${c.oldValue ?? "(empty)"} \u2192 ${c.newValue ?? "(empty)"}`)
      .join("\n")
    : "";

  return (
    <div className="diff-pane">
      <div className="diff-header">
        <span className="diff-header-title">Audit Details</span>
        <div className="diff-header-actions">
          {hasChanges && (
            <IconButton
              icon={copiedField === "diff" ? "check" : "copy"}
              label="Copy changes"
              onClick={() => onCopy(diffText, "diff")}
            />
          )}
          <IconButton icon="close" label="Close" onClick={onClose} />
        </div>
      </div>

      {/* ── Meta badges ── */}
      <div className="diff-meta">
        <span className="diff-badge">{formatTime(record.createdon)}</span>
        <span className="diff-badge">{record.userDisplayName}</span>
        <span className="diff-badge diff-badge-operation">{record.operation}</span>
        {record.action && <span className="diff-badge">{record.action}</span>}
        {record.transactionId && (
          <span className="diff-badge diff-badge-txn" title="Transaction ID">{record.transactionId}</span>
        )}
      </div>

      {/* ── Loading state ── */}
      {detailLoading && (
        <div className="diff-loading">
          <Codicon name="loading~spin" />
          <span>Loading change details…</span>
        </div>
      )}

      {/* ── Changes ── */}
      {!detailLoading && hasChanges && (
        <div className="diff-table-wrapper">
          <table className="diff-table">
            <thead>
              <tr>
                <th className="diff-col-attr">Field</th>
                <th className="diff-col-old">Old Value</th>
                <th className="diff-col-arrow"></th>
                <th className="diff-col-new">New Value</th>
              </tr>
            </thead>
            <tbody>
              {changes!.map((change) => (
                <tr key={change.attributeName} className="diff-row">
                  <td className="diff-attr-name" title={change.attributeName}>
                    {change.displayName}
                  </td>
                  <td className="diff-old">
                    {change.oldValue ?? <span className="diff-empty">(empty)</span>}
                  </td>
                  <td className="diff-arrow">{"\u2192"}</td>
                  <td className="diff-new">
                    {change.newValue ?? <span className="diff-empty">(empty)</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── No changes ── */}
      {!detailLoading && changes !== null && changes.length === 0 && (
        <div className="diff-no-changes">
          <span className="diff-no-changes-text">No field-level changes recorded for this audit entry.</span>
          <span className="diff-no-changes-hint">
            This may be a create, delete, share, or relationship operation.
          </span>
        </div>
      )}
    </div>
  );
}
