import * as vscode from "vscode";
import { Panel } from "core-dataverse";

export interface QueryResults {
  fetchXml: string;
  columns: string[];
  rows: Record<string, unknown>[];
  totalCount?: number;
  durationMs?: number;
  /** Map of logical attribute name → display (friendly) name from entity metadata. */
  friendlyNames?: Record<string, string>;
  /** Map of OData column key → column type ("number" | "date"); omitted columns are "text". */
  columnTypes?: Record<string, "number" | "date">;
  error?: string;
}

export class ResultsPanel extends Panel {
  private static readonly panels = new Map<string, ResultsPanel>();

  static show(
    extensionUri: vscode.Uri,
    results: QueryResults,
    env: { id: string; name: string },
  ): void {
    const key = env.id;
    const existing = ResultsPanel.panels.get(key);
    if (existing) {
      existing.update(results, env.name);
    } else {
      const instance = new ResultsPanel(extensionUri, results, env);
      ResultsPanel.panels.set(key, instance);
    }
  }

  private readonly envKey: string;

  private constructor(
    extensionUri: vscode.Uri,
    results: QueryResults,
    env: { id: string; name: string },
  ) {
    const iconPath = {
      light: vscode.Uri.joinPath(extensionUri, "resources", "light", "fetchxml.svg"),
      dark: vscode.Uri.joinPath(extensionUri, "resources", "dark", "fetchxml.svg"),
    };
    super(extensionUri, "dataverse-tools.fetchxmlResults", `FetchXML Results (${env.name})`, results, { iconPath });
    this.envKey = env.id;
  }

  private update(results: QueryResults, envName: string): void {
    this.activate(`FetchXML Results (${envName})`, results);
  }

  protected override dispose(): void {
    ResultsPanel.panels.delete(this.envKey);
    super.dispose();
  }
}
