import * as vscode from "vscode";
import {
  Logger,
  Commands,
  ExtensionIds,
  type DataverseAccountApi,
  type DataverseEnvironment,
  type ExplorerNode,
  type PluginAssembly,
  type PluginType,
  type SdkMessageProcessingStep,
  type TraceLogTarget,
  registerCommand,
} from "core-dataverse";
import { ServiceContainer } from "./container/ServiceContainer";
import { downloadAssemblyCommand } from "./commands/downloadAssemblyCommand";
import { deployAssemblyCommand } from "./commands/deployAssemblyCommand";
import { addStepCommand } from "./commands/addStepCommand";
import { editStepCommand } from "./commands/editStepCommand";
import { toggleStepStateCommand } from "./commands/toggleStepStateCommand";
import { deleteNodeCommand } from "./commands/deleteNodeCommand";
import { manageImagesCommand } from "./commands/manageImagesCommand";
import { renameNodeCommand } from "./commands/renameNodeCommand";

/**
 * Dataverse Tools: Assemblies Extension
 *
 * Registers an "Assemblies" NodeProvider with the unified Dataverse Explorer,
 * contributing assembly → plugin type → step nodes. All plugin deployment and
 * management commands remain owned by this extension.
 *
 * Depends on:
 *  - dataverse-environments for auth and the explorer tree framework
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const outputChannel = vscode.window.createOutputChannel("Dataverse Tools: Assemblies");
  Logger.init(outputChannel);
  context.subscriptions.push(outputChannel);

  Logger.info("Dataverse Tools: Assemblies extension activating\u2026");

  // ── Dependencies ──────────────────────────────────────────────────────────
  const accountExt = vscode.extensions.getExtension<DataverseAccountApi>(ExtensionIds.Environments);
  if (!accountExt) {
    vscode.window.showErrorMessage(
      "Dataverse Tools: Assemblies requires the Dataverse Tools: Environments extension."
    );
    return;
  }
  const api = accountExt.isActive ? accountExt.exports : await accountExt.activate();

  // ── Service Container ─────────────────────────────────────────────────────
  const container = new ServiceContainer(api, context);

  // ── Register providers with explorer framework ────────────────────────────
  context.subscriptions.push(
    api.explorer.registerProvider(container.assembliesProvider),
    api.explorer.registerProvider(container.messagesProvider),
  );
  // ── Helpers ───────────────────────────────────────────────────────────────
  const refresh = () => {
    api.explorer.refresh("assemblies");
    api.explorer.refresh("messages");
  };
  const getEnv = () => api.explorer.getContext()?.environment;

  // ── Commands ──────────────────────────────────────────────────────────────

  registerCommand(context, Commands.DeployAssembly, () => {
    return deployAssemblyCommand(
      api,
      container.analyzer,
      container.registrationService,
      refresh,
      getEnv(),
      undefined,
      context.workspaceState,
    );
  });

  registerCommand(context, Commands.DownloadAssembly, ((arg?: unknown) => {
    const node = extractNode(arg);
    if (!node || node.contextValue !== "assembly") { return; }
    const assembly = node.data?.assembly as PluginAssembly | undefined;
    if (!assembly) { return; }
    return downloadAssemblyCommand(api, container.registrationService, assembly, getEnv());
  }) as (...args: unknown[]) => unknown);

  registerCommand(context, Commands.AddStep, ((arg?: unknown) => {
    const node = extractNode(arg);
    if (!node || node.contextValue !== "pluginType") { return; }
    const pluginType = node.data?.pluginType as PluginType | undefined;
    if (!pluginType) { return; }
    return addStepCommand(
      api,
      container.registrationService,
      refresh,
      context.extensionUri,
      pluginType,
      getEnv()
    );
  }) as (...args: unknown[]) => unknown);

  registerCommand(context, Commands.EditStep, ((arg?: unknown) => {
    const node = extractNode(arg);
    if (!node || !node.contextValue.startsWith("step.")) { return; }
    const step = node.data?.step as SdkMessageProcessingStep | undefined;
    if (!step) { return; }
    return editStepCommand(
      api,
      container.registrationService,
      refresh,
      context.extensionUri,
      step,
      getEnv()
    );
  }) as (...args: unknown[]) => unknown);

  registerCommand(context, Commands.EnableStep, ((arg?: unknown) => {
    const node = extractNode(arg);
    if (!node || !node.contextValue.startsWith("step.")) { return; }
    const step = node.data?.step as SdkMessageProcessingStep | undefined;
    if (!step) { return; }
    return toggleStepStateCommand(api, container.registrationService, refresh, step, true, getEnv());
  }) as (...args: unknown[]) => unknown);

  registerCommand(context, Commands.DisableStep, ((arg?: unknown) => {
    const node = extractNode(arg);
    if (!node || !node.contextValue.startsWith("step.")) { return; }
    const step = node.data?.step as SdkMessageProcessingStep | undefined;
    if (!step) { return; }
    return toggleStepStateCommand(api, container.registrationService, refresh, step, false, getEnv());
  }) as (...args: unknown[]) => unknown);

  registerCommand(context, Commands.ManageImages, ((arg?: unknown) => {
    const node = extractNode(arg);
    if (!node || !node.contextValue.startsWith("step.")) { return; }
    const step = node.data?.step as SdkMessageProcessingStep | undefined;
    if (!step) { return; }
    return manageImagesCommand(api, container.registrationService, context.extensionUri, step, getEnv());
  }) as (...args: unknown[]) => unknown);

  registerCommand(context, Commands.DeleteNode, ((arg?: unknown) => {
    const node = extractNode(arg);
    if (!node) { return; }
    return deleteNodeCommand(api, container.registrationService, refresh, node, getEnv());
  }) as (...args: unknown[]) => unknown);

  registerCommand(context, Commands.RenameNode, ((arg?: unknown) => {
    const node = extractNode(arg);
    if (!node) { return; }
    return renameNodeCommand(api, container.registrationService, refresh, node, getEnv());
  }) as (...args: unknown[]) => unknown);

  registerCommand(context, Commands.ChangeActivityGroup, ((arg?: unknown) => {
    const node = extractNode(arg);
    if (!node || node.contextValue !== "activityType") { return; }
    const pluginType = node.data?.pluginType as PluginType | undefined;
    if (!pluginType?.plugintypeid) { return; }
    return changeActivityGroupCommand(api, container.registrationService, refresh, pluginType, getEnv());
  }) as (...args: unknown[]) => unknown);

  // ── Trace Viewer (optional, delegates to plugin-trace-viewer if installed) ──
  registerCommand(context, Commands.OpenTraceViewer, ((arg?: unknown) => {
    const traceExt = vscode.extensions.getExtension(ExtensionIds.TraceViewer);
    if (!traceExt) {
      vscode.window.showInformationMessage(
        "Install the Dataverse Tools: Trace Viewer extension to view trace logs.",
        "Open Extensions"
      ).then((choice) => {
        if (choice === "Open Extensions") {
          vscode.commands.executeCommand("workbench.extensions.search", "dataverse tools trace viewer");
        }
      });
      return;
    }

    const node = extractNode(arg);
    let target: TraceLogTarget | undefined;
    if (node?.contextValue === "assembly") {
      const assembly = node.data?.assembly as PluginAssembly | undefined;
      if (assembly) {
        target = { kind: "assembly", assemblyName: assembly.name };
      }
    } else if (node?.contextValue === "pluginType" || node?.contextValue === "activityType") {
      const pluginType = node.data?.pluginType as PluginType | undefined;
      if (pluginType) {
        target = { kind: "pluginType", pluginTypeName: pluginType.typename };
      }
    }
    const envId = getEnv()?.id;
    return vscode.commands.executeCommand(Commands.TraceLog, target, envId);
  }) as (...args: unknown[]) => unknown);

  // ── Managed filter toggle ──────────────────────────────────────────────────
  registerCommand(context, Commands.ShowManaged, () =>
    vscode.commands.executeCommand(Commands.ExplorerShowAll));
  registerCommand(context, Commands.HideManaged, () =>
    vscode.commands.executeCommand(Commands.ExplorerFilterUnmanaged));

  // ── Build task watcher ─────────────────────────────────────────────────────
  const taskWatcher = vscode.tasks.onDidEndTaskProcess(async (e) => {
    if (e.exitCode !== 0) { return; }

    const isBuild =
      e.execution.task.group === vscode.TaskGroup.Build ||
      e.execution.task.name.toLowerCase().includes("build");

    if (!isBuild) { return; }

    const deployOnBuild = vscode.workspace
      .getConfiguration("dataverse-tools")
      .get<boolean>("deployOnBuild", true);

    if (!deployOnBuild) { return; }
    if (!getEnv()) { return; }

    const choice = await vscode.window.showInformationMessage(
      "Build succeeded. Deploy plugin assembly to Dataverse?",
      "Deploy",
      "Not now"
    );

    if (choice === "Deploy") {
      await deployAssemblyCommand(
        api,
        container.analyzer,
        container.registrationService,
        refresh,
        getEnv(),
        undefined,
        context.workspaceState,
      );
    }
  });

  context.subscriptions.push(taskWatcher);

  // ── Analyzer availability check ────────────────────────────────────────────
  container.analyzer.isAvailable().then((available) => {
    if (!available) {
      vscode.window.showWarningMessage(
        "Dataverse Tools: Assemblies: analyzer tool not found. " +
        "Build the analyzer or configure `dataverse-tools.analyzerPath`.",
        "Open Settings"
      ).then((choice) => {
        if (choice === "Open Settings") {
          vscode.commands.executeCommand(
            "workbench.action.openSettings",
            "dataverse-tools.analyzerPath"
          );
        }
      });
    }
  });

  Logger.info("Dataverse Tools: Assemblies extension activated.");
}

export function deactivate(): void {
  Logger.info("Dataverse Tools: Assemblies extension deactivated.");
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract the {@link ExplorerNode} from a tree item argument.
 *
 * VS Code passes the TreeItem directly to command handlers invoked from
 * context menus. The explorer framework wraps ExplorerNodes in
 * UnifiedTreeItem which has a public `node` property. We duck-type here
 * so that dataverse-assemblies doesn't need to import UnifiedTreeItem.
 */
async function changeActivityGroupCommand(
  api: DataverseAccountApi,
  registrationSvc: IRegistrationService,
  onRefresh: () => void,
  pluginType: PluginType,
  env: DataverseEnvironment | undefined,
): Promise<void> {
  if (!env) { return; }

  const current = pluginType.workflowactivitygroupname ?? "";
  const newName = await vscode.window.showInputBox({
    title: "Change Activity Group",
    prompt: `Activity group name for "${pluginType.friendlyname || pluginType.typename}"`,
    value: current,
    valueSelection: [0, current.length],
    validateInput: (v) => v.trim() ? undefined : "Name cannot be empty.",
  });

  if (!newName || newName.trim() === current) { return; }

  try {
    await registrationSvc.changeActivityGroup(env, pluginType.plugintypeid!, newName.trim());
    onRefresh();
    vscode.window.showInformationMessage(`Activity group changed to "${newName.trim()}".`);
  } catch (err) {
    Logger.error("Change activity group failed", err);
    vscode.window.showErrorMessage(
      `Failed to change activity group: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

function extractNode(arg: unknown): ExplorerNode | undefined {
  if (arg && typeof arg === "object" && "node" in arg) {
    return (arg as { node?: ExplorerNode }).node ?? undefined;
  }
  return undefined;
}
