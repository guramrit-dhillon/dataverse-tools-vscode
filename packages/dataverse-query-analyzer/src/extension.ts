import * as vscode from "vscode";
import {
  Logger,
  Commands,
  ExtensionIds,
  type DataverseAccountApi,
  type DataverseEnvironment,
  registerCommand,
} from "core-dataverse";
import { ServiceContainer } from "./container/ServiceContainer";
import { QueryPanel } from "./webviews/QueryPanel";

const WS_KEY_ENV_ID = "queryAnalyzer.envId";

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel("Dataverse Tools: Query Analyzer");
  Logger.init(outputChannel);
  context.subscriptions.push(outputChannel);

  Logger.info("Dataverse Tools: Query Analyzer extension activating...");

  const accountExt =
    vscode.extensions.getExtension<DataverseAccountApi>(
      ExtensionIds.Environments
    );
  if (!accountExt) {
    vscode.window.showErrorMessage(
      "Dataverse Tools: Query Analyzer requires the Dataverse Tools: Environments extension."
    );
    return;
  }

  const api = accountExt.exports;
  setupExtension(context, api);
}

function setupExtension(
  context: vscode.ExtensionContext,
  api: DataverseAccountApi
): void {
  const container = new ServiceContainer(api);
  context.subscriptions.push({ dispose: () => container.queryService.dispose() });

  // ── Active environment tracking ─────────────────────────────────────────
  let activeEnv: DataverseEnvironment | undefined;
  const resolveEnv = (): DataverseEnvironment | undefined => {
    const savedId = context.workspaceState.get<string>(WS_KEY_ENV_ID);
    const all = api.getEnvironments();
    if (savedId) {
      const saved = all.find((e) => e.id === savedId);
      if (saved) {
        return saved;
      }
    }
    return all.length === 1 ? all[0] : undefined;
  };
  activeEnv = resolveEnv();

  // ── React to global env changes ─────────────────────────────────────────
  context.subscriptions.push(
    api.onDidChangeEnvironments(() => {
      activeEnv = resolveEnv();
    })
  );

  // ── Helper: open panel ──────────────────────────────────────────────────
  const openPanel = (initialSql?: string): void => {
    QueryPanel.render(
      context.extensionUri,
      activeEnv,
      api,
      container.queryService,
      container.metadataCache,
      context.workspaceState,
      initialSql
    );
  };

  // ── Commands ────────────────────────────────────────────────────────────
  registerCommand(context, Commands.QueryAnalyzerOpen, async (item?: unknown) => {
    // When invoked from environments tree, use the clicked environment
    const envItem = item as { environment?: { id: string } } | undefined;
    if (envItem?.environment?.id) {
      const env = api.getEnvironments().find((e) => e.id === envItem.environment!.id);
      if (env) {
        activeEnv = env;
        await context.workspaceState.update(WS_KEY_ENV_ID, activeEnv.id);
      }
    }
    openPanel();
  });

  registerCommand(
    context,
    Commands.QueryAnalyzerSelectEnvironment,
    async () => {
      const result = await api.pickEnvironment({ activeEnvironmentId: activeEnv?.id });
      if (!result) {
        return;
      }
      activeEnv = result.environment;
      await context.workspaceState.update(WS_KEY_ENV_ID, activeEnv.id);
    }
  );

  registerCommand(context, Commands.QueryAnalyzerChangeEnvironment, () => QueryPanel.changeEnvironment());

  // Cross-extension: "Query This Entity" from explorer
  registerCommand(
    context,
    Commands.QueryAnalyzerQueryEntity,
    (item?: unknown) => {
      const entityItem = item as
        | { entity?: { LogicalName: string } }
        | undefined;
      const logicalName = entityItem?.entity?.LogicalName;
      if (!logicalName) {
        return;
      }
      openPanel(`SELECT TOP 50 * FROM ${logicalName}`);
    }
  );

  Logger.info("Dataverse Tools: Query Analyzer extension activated.");
}

export function deactivate(): void {
  Logger.info("Dataverse Tools: Query Analyzer extension deactivated.");
}
