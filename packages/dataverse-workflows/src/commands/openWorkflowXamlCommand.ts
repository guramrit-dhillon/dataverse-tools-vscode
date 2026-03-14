import * as vscode from "vscode";
import { Logger, type DataverseEnvironment } from "core-dataverse";
import type { WorkflowProcess } from "../types/dataverse";
import type { IWorkflowService } from "../interfaces/IWorkflowService";

export const WORKFLOW_XAML_SCHEME = "dataverse-workflow-xaml";

export class WorkflowXamlContentProvider implements vscode.TextDocumentContentProvider {
  private readonly contentStore = new Map<string, string>();

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.contentStore.get(uri.path) ?? "";
  }

  store(key: string, content: string): void {
    this.contentStore.set(key, content);
  }
}

function formatXaml(raw: string): string {
  let formatted = "";
  let indent = 0;
  const tokens = raw.replace(/>\s*</g, ">\n<").split("\n");
  for (const token of tokens) {
    const line = token.trim();
    if (!line) { continue; }
    if (line.startsWith("</")) { indent = Math.max(indent - 1, 0); }
    formatted += "  ".repeat(indent) + line + "\n";
    if (line.startsWith("<") && !line.startsWith("</") && !line.endsWith("/>") && !line.includes("</")) {
      indent++;
    }
  }
  return formatted.trimEnd();
}

export async function openWorkflowXamlCommand(
  svc: IWorkflowService,
  provider: WorkflowXamlContentProvider,
  workflow: WorkflowProcess,
  env: DataverseEnvironment | undefined,
): Promise<void> {
  if (!env) { return; }

  const xaml = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: `Loading XAML for "${workflow.name}"…` },
    () => svc.getWorkflowXaml(env, workflow.workflowid),
  );

  if (!xaml) {
    vscode.window.showWarningMessage(`No XAML content found for "${workflow.name}".`);
    return;
  }

  try {
    const key = `/${workflow.workflowid}/${workflow.name}.xaml`;
    provider.store(key, formatXaml(xaml));
    const uri = vscode.Uri.parse(`${WORKFLOW_XAML_SCHEME}:${key}`);
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, { preview: true });
  } catch (err) {
    Logger.error("Failed to open workflow XAML", err);
    vscode.window.showErrorMessage(
      `Failed to open XAML: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
