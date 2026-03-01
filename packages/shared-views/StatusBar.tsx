import React from "react";
import { Codicon } from "./Codicon";
import "./status-bar.css";

interface StatusBarProps {
  rowCount: number | null;
  durationMs: number | null;
  messages: string[];
  error: string | null;
  loading?: boolean;
  schemaLoading?: boolean;
}

export default function StatusBar({
  rowCount,
  durationMs,
  messages,
  error,
  loading,
  schemaLoading,
}: StatusBarProps): React.ReactElement {
  return (
    <div className={`status-bar ${error ? "status-bar-error" : ""}`}>
      {error ? (
        <div className="status-error">
          <Codicon name="error" />
          <span>{error}</span>
        </div>
      ) : loading ? (
        <span className="status-item status-executing">
          <Codicon name="loading~spin" />
          Executing query…
        </span>
      ) : (
        <>
          {rowCount !== null && (
            <span className="status-item">
              <Codicon name="table" />
              {rowCount} row{rowCount !== 1 ? "s" : ""}
            </span>
          )}
          {durationMs !== null && (
            <span className="status-item">
              <Codicon name="clock" />
              {durationMs}ms
            </span>
          )}
          {messages.length > 0 && (
            <span className="status-item status-messages">
              <Codicon name="info" />
              {messages.length} message{messages.length !== 1 ? "s" : ""}
            </span>
          )}
          {schemaLoading && (
            <span className="status-item status-schema-loading">
              <Codicon name="loading~spin" />
              Loading schema…
            </span>
          )}
        </>
      )}
    </div>
  );
}
