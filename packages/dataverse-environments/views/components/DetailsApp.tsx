import * as React from "react";
import { useState, useEffect } from "react";
import { Codicon } from "shared-views";
import vscode from "shared-views/vscode";

interface DetailProperty {
  label: string;
  value: string | number;
  mono?: boolean;
  badge?: "green" | "grey" | "orange" | "blue";
}

interface DetailItem {
  icon: string;
  label: string;
  properties: DetailProperty[];
}

export function DetailsApp(): React.ReactElement {
  const [item, setItem] = useState<DetailItem | null>(null);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg?.type === "init") {
        setItem(msg.payload ?? null);
      }
    };
    window.addEventListener("message", handler);
    vscode.postMessage({ type: "ready" });
    return () => window.removeEventListener("message", handler);
  }, []);

  if (!item) {
    return <div className="placeholder">Select an item to view details</div>;
  }

  const visibleProps = item.properties.filter(
    (p) => p.value !== null && p.value !== undefined && p.value !== ""
  );

  return (
    <>
      <div className="kind-header">
        <Codicon name={item.icon} className="kind-icon" />
        <span className="kind-title">{item.label}</span>
      </div>
      <table className="props">
        <tbody>
          {visibleProps.map((p, i) => (
            <tr key={i}>
              <td>{p.label}</td>
              <td>
                {p.badge ? (
                  <span className={`badge badge-${p.badge}`}>{p.value}</span>
                ) : p.mono ? (
                  <span className="mono">{p.value}</span>
                ) : (
                  String(p.value)
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
