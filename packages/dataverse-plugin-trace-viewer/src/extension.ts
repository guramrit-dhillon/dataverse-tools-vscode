import * as vscode from "vscode";
import {
  Logger,
  Commands,
  ExtensionIds,
  type DataverseAccountApi,
  type TraceLogTarget,
  type TraceLogFilter,
  registerCommand,
} from "core-dataverse";
import { TraceLogService } from "./services/TraceLogService";
import { TraceLogPanel } from "./webviews/TraceLogPanel";

/**
 * Dataverse Tools: Trace Viewer Extension
 *
 * Owns the TraceLog command (Commands.TraceLog). Can be invoked:
 *  - Directly from the command palette (opens without a filter)
 *  - From dataverse-assemblies' context menu, which passes the clicked
 *    tree item as a duck-typed argument to extract the plugin type filter
 */
export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel("Dataverse Tools: Trace Viewer");
  Logger.init(outputChannel);
  context.subscriptions.push(outputChannel);

  Logger.info("Dataverse Tools: Trace Viewer extension activating…");

  const accountExt = vscode.extensions.getExtension<DataverseAccountApi>(ExtensionIds.Environments);
  if (!accountExt) {
    vscode.window.showErrorMessage(
      "Dataverse Tools: Trace Viewer requires the Dataverse Tools: Environments extension to be installed."
    );
    return;
  }
  const api = accountExt.exports;

  const traceLogSvc = new TraceLogService(api.getAccessToken.bind(api));

  // ── TraceLog command ───────────────────────────────────────────────────────
  // Sole owner of Commands.TraceLog ("dataverse-tools.traceLog").
  // dataverse-assemblies passes a TraceLogTarget + optional environmentId
  // so both sides share a strongly-typed contract with no duck typing.
  registerCommand(context, Commands.TraceLog, (async (target?: unknown, environmentId?: string) => {
    // Resolve environment: tree item → passed ID → single-env auto-select → pickEnvironment()
    const envItem = target as { environment?: { id: string } } | undefined;
    let env = envItem?.environment?.id
      ? api.getEnvironments().find((e) => e.id === envItem.environment!.id)
      : environmentId
        ? api.getEnvironments().find((e) => e.id === environmentId)
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

    let initialFilter: Partial<TraceLogFilter> | undefined;
    const typedTarget = target as TraceLogTarget | undefined;
    if (typedTarget?.kind === "assembly") {
      initialFilter = { pluginTypeName: typedTarget.assemblyName };
    } else if (typedTarget?.kind === "pluginType") {
      initialFilter = { pluginTypeName: typedTarget.pluginTypeName };
    }

    TraceLogPanel.render(context.extensionUri, env, api, traceLogSvc, initialFilter);
  }) as (...args: unknown[]) => unknown);

  registerCommand(context, Commands.TraceLogChangeEnvironment, () => TraceLogPanel.changeEnvironment());

  Logger.info("Dataverse Tools: Trace Viewer extension activated.");
}

export function deactivate(): void {
  Logger.info("Dataverse Tools: Trace Viewer extension deactivated.");
}
