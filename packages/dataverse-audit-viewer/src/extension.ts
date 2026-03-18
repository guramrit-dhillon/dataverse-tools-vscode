import * as vscode from "vscode";
import {
  Logger,
  ExtensionIds,
  type DataverseAccountApi,
  registerCommand,
} from "core-dataverse";
import { Commands } from "./constants";
import { AuditService } from "./services/AuditService";
import { AuditPanel } from "./webviews/AuditPanel";

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel("Dataverse Tools: Audit Viewer");
  Logger.init(outputChannel);
  context.subscriptions.push(outputChannel);

  Logger.info("Dataverse Tools: Audit Viewer extension activating\u2026");

  const accountExt = vscode.extensions.getExtension<DataverseAccountApi>(ExtensionIds.Environments);
  if (!accountExt) {
    vscode.window.showErrorMessage(
      "Dataverse Tools: Audit Viewer requires the Dataverse Tools: Environments extension to be installed."
    );
    return;
  }
  const api = accountExt.exports;

  const auditSvc = new AuditService(api.getAccessToken.bind(api));

  // ── Open Audit Viewer (from environment context menu or command palette) ──
  registerCommand(context, Commands.AuditViewerOpen, (async (item?: unknown) => {
    const envItem = item as { environment?: { id: string } } | undefined;
    let env = envItem?.environment?.id
      ? api.getEnvironments().find((e) => e.id === envItem.environment!.id)
      : undefined;
    if (!env) {
      const all = api.getEnvironments();
      if (all.length === 1) { env = all[0]; }
    }
    if (!env) {
      const result = await api.pickEnvironment();
      if (!result) { return; }
      env = result.environment;
    }

    AuditPanel.render(context.extensionUri, env, api, auditSvc);
  }) as (...args: unknown[]) => unknown);

  // ── View Audit History for a specific entity (from explorer context menu) ──
  // The explorer tree item carries entity data in node.data; the active
  // environment is available via api.explorer.getContext().
  registerCommand(context, Commands.AuditViewerViewEntityAudit, (async (item?: unknown) => {
    const node = (item as { node?: { data?: Record<string, unknown> } } | undefined)?.node;
    const entity = node?.data?.entity as { name?: string } | undefined;
    const logicalName = entity?.name;

    // Use the explorer's current environment — no picker needed
    const env = api.explorer.getContext()?.environment;
    if (!env) {
      vscode.window.showWarningMessage("No environment selected in the explorer.");
      return;
    }

    AuditPanel.render(context.extensionUri, env, api, auditSvc, logicalName);
  }) as (...args: unknown[]) => unknown);

  // ── Change environment on active panel ──
  registerCommand(context, Commands.AuditViewerChangeEnvironment, () => AuditPanel.changeEnvironment());

  // ── Manage entity auditing — opens the audit panel then triggers the QuickPick ──
  registerCommand(context, Commands.AuditViewerManageEntityAuditing, (async (item?: unknown) => {
    const envItem = item as { environment?: { id: string } } | undefined;
    let env = envItem?.environment?.id
      ? api.getEnvironments().find((e) => e.id === envItem.environment!.id)
      : api.explorer.getContext()?.environment;
    if (!env) {
      const all = api.getEnvironments();
      if (all.length === 1) { env = all[0]; }
    }
    if (!env) {
      const result = await api.pickEnvironment();
      if (!result) { return; }
      env = result.environment;
    }
    AuditPanel.render(context.extensionUri, env, api, auditSvc);
  }) as (...args: unknown[]) => unknown);

  Logger.info("Dataverse Tools: Audit Viewer extension activated.");
}

export function deactivate(): void {
  Logger.info("Dataverse Tools: Audit Viewer extension deactivated.");
}
