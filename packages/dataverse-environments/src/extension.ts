import * as vscode from "vscode";
import {
  Logger,
  Views,
  Commands,
  DataverseWebApiClient,
  SolutionComponentType,
  type DataverseAccountApi,
  type DataverseEnvironment,
  type DetailItem,
  type DetailProperty,
  registerCommand,
} from "core-dataverse";
import { ServiceContainer } from "./container/ServiceContainer";
import { EnvironmentTreeItem } from "./providers/EnvironmentTreeItem";
import { addEnvironmentCommand } from "./commands/addEnvironmentCommand";
import { pickEnvironmentCommand } from "./commands/pickEnvironmentCommand";
import { removeEnvironmentCommand } from "./commands/removeEnvironmentCommand";
import { editEnvironmentCommand } from "./commands/editEnvironmentCommand";
import { testConnectionCommand } from "./commands/testConnectionCommand";
import { DetailsViewProvider } from "./webviews/DetailsViewProvider";
import { UnifiedTreeProvider } from "./framework/UnifiedTreeProvider";
import type { UnifiedTreeItem } from "./framework/UnifiedTreeItem";
import { ListEnvironmentsTool } from "./tools/ListEnvironmentsTool";
import { GetEnvironmentDetailsTool } from "./tools/GetEnvironmentDetailsTool";
import { TestConnectionTool } from "./tools/TestConnectionTool";

/**
 * Dataverse Environments Extension
 *
 * Single owner of authentication, environment management, and the explorer
 * tree framework. Returns a typed DataverseAccountApi (with `explorer` property)
 * so other extensions can acquire tokens, read environments, and register
 * NodeProviders without owning any auth or framework code themselves.
 */
export function activate(context: vscode.ExtensionContext): DataverseAccountApi {
  const outputChannel = vscode.window.createOutputChannel("Dataverse Tools: Environments");
  Logger.init(outputChannel);
  context.subscriptions.push(outputChannel);

  Logger.info("Dataverse Tools: Environments extension activating…");

  const container = new ServiceContainer(context);

  // ── Shared Details Panel ───────────────────────────────────────────────────
  const detailsProvider = new DetailsViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      DetailsViewProvider.viewId,
      detailsProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  // ── Environments Tree View ─────────────────────────────────────────────────
  const envView = vscode.window.createTreeView("dataverse-tools.environments", {
    treeDataProvider: container.environmentTreeProvider,
    showCollapseAll: false,
  });
  context.subscriptions.push(envView);

  // Show environment details in the Details panel when an item is selected.
  context.subscriptions.push(
    envView.onDidChangeSelection((e) => {
      const item = e.selection[0];
      if (item instanceof EnvironmentTreeItem && item.environment) {
        detailsProvider.showItem(buildEnvDetailItem(item.environment));
      } else {
        detailsProvider.showItem(null);
      }
    })
  );

  // ── Environment Commands ─────────────────────────────────────────────────
  registerCommand(context, Commands.AddEnvironment, () =>
    addEnvironmentCommand(container.envManager, container.authService, container.secretStorage)
  );

  registerCommand(context, Commands.RemoveEnvironment, ((item?: EnvironmentTreeItem) => {
    const envId = item?.environment?.id;
    if (!envId) { return; }
    return removeEnvironmentCommand(container.envManager, container.authService, container.secretStorage, envId);
  }) as (...args: unknown[]) => unknown);

  registerCommand(context, Commands.EditEnvironment, ((item?: EnvironmentTreeItem) => {
    const envId = item?.environment?.id;
    if (!envId) { return; }
    return editEnvironmentCommand(container.envManager, container.authService, container.secretStorage, envId);
  }) as (...args: unknown[]) => unknown);

  registerCommand(context, Commands.TestConnection, ((item?: EnvironmentTreeItem) => {
    const env = item?.environment;
    if (!env) { return; }
    return testConnectionCommand(env, container.authService, container.envManager);
  }) as (...args: unknown[]) => unknown);

  // ── Build the API (needed before creating the tree provider) ───────────────
  const api: DataverseAccountApi = {
    getAccessToken: (env) => container.authService.getAccessToken(env),
    getEnvironments: () => container.envManager.getAll(),
    onDidChangeEnvironments: container.envManager.onDidChange,
    pickEnvironment: (options) =>
      pickEnvironmentCommand(container.envManager, container.authService, options),
    showDetails: (item) => detailsProvider.showItem(item),
    // explorer is assigned below after treeProvider is created
    explorer: undefined as never,
  };

  // ── Explorer Tree Framework ────────────────────────────────────────────────
  const treeProvider = new UnifiedTreeProvider(
    container.registry,
    api,
    context.workspaceState,
  );

  const treeView = vscode.window.createTreeView(Views.Explorer, {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  // View description
  function updateViewDescription(): void {
    const ctx = treeProvider.getContext();
    if (!ctx) {
      treeView.description = "No environment selected";
    } else if (ctx.solution) {
      treeView.description = `${ctx.environment.name} \u2022 ${ctx.solution.friendlyname}`;
    } else {
      treeView.description = ctx.environment.name;
    }
  }
  updateViewDescription();
  context.subscriptions.push(
    treeProvider.onDidChangeContext(() => updateViewDescription()),
  );

  // Selection → Details panel
  context.subscriptions.push(
    treeView.onDidChangeSelection((e) => {
      const item = e.selection[0] as UnifiedTreeItem | undefined;
      if (!item?.node || !item.providerId) {
        api.showDetails(null);
        return;
      }
      const provider = container.registry.getProvider(item.providerId);
      const detail = provider?.getDetailItem?.(item.node);
      api.showDetails(detail ?? fallbackDetail(item.node.label));
    }),
  );

  // Filter context keys
  const UNMANAGED_FILTER_KEY = "dataverse-tools.explorer.unmanagedFilterActive";
  const SOLUTION_ACTIVE_KEY = "dataverse-tools.explorer.solutionActive";
  const SHOW_OUT_OF_SOLUTION_KEY = "dataverse-tools.explorer.showOutOfSolutionActive";

  function syncFilterContextKeys(): void {
    const filter = treeProvider.getFilter();
    const ctx = treeProvider.getContext();
    void vscode.commands.executeCommand(
      "setContext",
      UNMANAGED_FILTER_KEY,
      filter.componentScope === "unmanaged",
    );
    void vscode.commands.executeCommand(
      "setContext",
      SOLUTION_ACTIVE_KEY,
      !!ctx?.solution,
    );
    void vscode.commands.executeCommand(
      "setContext",
      SHOW_OUT_OF_SOLUTION_KEY,
      filter.showOutOfSolution,
    );
  }
  syncFilterContextKeys();
  context.subscriptions.push(
    treeProvider.onDidChangeContext(() => syncFilterContextKeys()),
  );

  // Explorer commands
  registerCommand(
    context,
    Commands.ExplorerSelectEnvironment,
    async () => {
      const result = await api.pickEnvironment({ showSolutions: true, activeEnvironmentId: treeProvider.getContext()?.environment.id });
      if (!result) { return; }
      await treeProvider.setEnvironment(
        result.environment.id,
        result.solution,
      );
    },
  );

  registerCommand(context, Commands.ExplorerRefresh, () => {
    treeProvider.refresh();
  });

  registerCommand(context, Commands.ExplorerShowAll, async () => {
    await treeProvider.setFilter({ componentScope: "all" });
  });

  registerCommand(context, Commands.ExplorerFilterUnmanaged, async () => {
    await treeProvider.setFilter({ componentScope: "unmanaged" });
  });

  registerCommand(context, Commands.ExplorerShowGlobal, async () => {
    await treeProvider.setFilter({ showOutOfSolution: true });
  });

  registerCommand(context, Commands.ExplorerShowSolutionOnly, async () => {
    await treeProvider.setFilter({ showOutOfSolution: false });
  });

  registerCommand(context, Commands.AddToSolution, (async (arg?: unknown) => {
    const item = arg as UnifiedTreeItem | undefined;
    const node = item?.node;
    if (!node?.solutionComponent) { return; }

    const solutionComponent = node.solutionComponent;

    const ctx = treeProvider.getContext();
    if (!ctx?.solution || !ctx.environment) { return; }
    const solution = ctx.solution;
    const env = ctx.environment;

    const isEntity = solutionComponent.componentType === SolutionComponentType.Entity;
    const isAlreadyInSolution = item?.contextValue?.endsWith(".inSolution") ?? false;

    // For entities, offer three inclusion modes; for others, a simple confirm.
    let selectedBehavior: number | undefined;
    if (isEntity) {
      const actionLabel = isAlreadyInSolution ? "Change to" : "Add with";

      // Look up current behavior to pre-select in the picker
      const compKey = `${solutionComponent.componentType}:${solutionComponent.componentId}`;
      const currentBehavior = ctx.solutionComponentIds?.get(compKey);

      type BehaviorItem = vscode.QuickPickItem & { behavior: number };
      const options: BehaviorItem[] = [
        { label: "$(package) Include all objects", description: "All forms, views, fields, charts, etc.", behavior: 0 },
        { label: "$(symbol-structure) Include entity metadata", description: "Entity definition only, no subcomponents", behavior: 1 },
        { label: "$(symbol-reference) Do not include any objects", description: "Without metadata", behavior: 2 },
      ];

      const pick = await new Promise<BehaviorItem | undefined>((resolve) => {
        const qp = vscode.window.createQuickPick<BehaviorItem>();
        qp.title = `${actionLabel}: "${node.label}" → "${solution.friendlyname}"`;
        qp.placeholder = "Choose inclusion mode";
        qp.items = options;
        if (currentBehavior !== undefined) {
          const active = options.find((o) => o.behavior === currentBehavior);
          if (active) { qp.activeItems = [active]; }
        }
        qp.onDidAccept(() => { resolve(qp.selectedItems[0]); qp.dispose(); });
        qp.onDidHide(() => { resolve(undefined); qp.dispose(); });
        qp.show();
      });
      if (!pick) { return; }
      if (isAlreadyInSolution && pick.behavior === currentBehavior) { return; } // No change

      // Warn when downgrading from "all objects" — subcomponents will be removed
      if (isAlreadyInSolution && currentBehavior === 0 && pick.behavior !== 0) {
        const proceed = await vscode.window.showWarningMessage(
          `This will remove all subcomponents (forms, views, fields, etc.) of "${node.label}" from the solution. You will need to add them back manually if needed.`,
          { modal: true },
          "Continue",
        );
        if (proceed !== "Continue") { return; }
      }

      selectedBehavior = pick.behavior;
    } else {
      const confirm = await vscode.window.showInformationMessage(
        `Add "${node.label}" to solution "${solution.friendlyname}"?`,
        "Add",
        "Cancel",
      );
      if (confirm !== "Add") { return; }
    }

    const progressLabel = isAlreadyInSolution ? "Updating" : "Adding";
    try {
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `${progressLabel} "${node.label}" in ${solution.friendlyname}…` },
        async () => {
          const client = new DataverseWebApiClient(env, (e) => api.getAccessToken(e));

          // Only remove first when going from "all objects" (0) to a lower mode —
          // subcomponents need to be stripped. Other transitions (metadata ↔ shell,
          // or upgrading to all objects) can be done with AddSolutionComponent alone.
          const compKey = `${solutionComponent.componentType}:${solutionComponent.componentId}`;
          const currentBehavior = ctx.solutionComponentIds?.get(compKey);
          if (isAlreadyInSolution && isEntity && currentBehavior === 0 && selectedBehavior !== 0) {
            await client.post("RemoveSolutionComponent", {
              SolutionComponent: {
                "@odata.type": "Microsoft.Dynamics.CRM.solutioncomponent",
                solutioncomponentid: solutionComponent.componentId,
              },
              ComponentType: solutionComponent.componentType,
              SolutionUniqueName: solution.uniquename,
            });
          }

          const payload: Record<string, unknown> = {
            ComponentId: solutionComponent.componentId,
            ComponentType: solutionComponent.componentType,
            SolutionUniqueName: solution.uniquename,
            AddRequiredComponents: false,
          };
          if (selectedBehavior === 1) {
            // Metadata only: exclude subcomponents but include metadata
            payload.DoNotIncludeSubcomponents = true;
          } else if (selectedBehavior === 2) {
            // Shell only: exclude subcomponents AND metadata
            payload.DoNotIncludeSubcomponents = true;
            payload.IncludedComponentSettingsValues = [];
          }
          await client.post("AddSolutionComponent", payload);
          await treeProvider.refreshSolutionComponents();
        },
      );
      const doneLabel = isAlreadyInSolution ? "Updated" : "Added";
      vscode.window.showInformationMessage(
        `${doneLabel} "${node.label}" in ${solution.friendlyname}.`,
      );
    } catch (err) {
      Logger.error("Add to solution failed", err);
      vscode.window.showErrorMessage(
        `Failed to add to solution: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }) as (...args: unknown[]) => unknown);

  registerCommand(context, Commands.RemoveFromSolution, (async (arg?: unknown) => {
    const item = arg as UnifiedTreeItem | undefined;
    const node = item?.node;
    if (!node?.solutionComponent) { return; }

    const solutionComponent = node.solutionComponent;

    const ctx = treeProvider.getContext();
    if (!ctx?.solution || !ctx.environment) { return; }
    const solution = ctx.solution;
    const env = ctx.environment;

    const confirm = await vscode.window.showWarningMessage(
      `Remove "${node.label}" from solution "${solution.friendlyname}"?`,
      { modal: true },
      "Remove",
    );
    if (confirm !== "Remove") { return; }

    try {
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `Removing "${node.label}" from ${solution.friendlyname}…` },
        async () => {
          const client = new DataverseWebApiClient(env, (e) => api.getAccessToken(e));
          await client.post("RemoveSolutionComponent", {
            SolutionComponent: {
              "@odata.type": "Microsoft.Dynamics.CRM.solutioncomponent",
              solutioncomponentid: solutionComponent.componentId,
            },
            ComponentType: solutionComponent.componentType,
            SolutionUniqueName: solution.uniquename,
          });
          await treeProvider.refreshSolutionComponents();
        },
      );
      vscode.window.showInformationMessage(
        `Removed "${node.label}" from ${solution.friendlyname}.`,
      );
    } catch (err) {
      Logger.error("Remove from solution failed", err);
      vscode.window.showErrorMessage(
        `Failed to remove from solution: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }) as (...args: unknown[]) => unknown);

  // Wire up the explorer API
  (api as { explorer: DataverseAccountApi["explorer"] }).explorer = {
    registerProvider: (provider) => container.registry.register(provider),
    getContext: () => treeProvider.getContext(),
    onDidChangeContext: treeProvider.onDidChangeContext,
    refresh: (providerId) => treeProvider.refresh(providerId),
    reveal: async (_nodeId, _options) => {
      // TODO (Phase 2b): implement node reveal via TreeView.reveal()
      Logger.warn("DataverseExplorerApi.reveal() is not yet implemented.");
    },
  };

  // ── Language Model Tools (Copilot Chat integration) ─────────────────────
  context.subscriptions.push(
    vscode.lm.registerTool(
      "dataverse-tools_listEnvironments",
      new ListEnvironmentsTool(container.envManager)
    ),
    vscode.lm.registerTool(
      "dataverse-tools_getEnvironmentDetails",
      new GetEnvironmentDetailsTool(container.envManager)
    ),
    vscode.lm.registerTool(
      "dataverse-tools_testConnection",
      new TestConnectionTool(container.envManager, container.authService)
    ),
  );

  Logger.info("Dataverse Tools: Environments extension activated.");

  return api;
}

export function deactivate(): void {
  Logger.info("Dataverse Tools: Environments extension deactivated.");
}

const METHOD_LABELS: Record<string, string> = {
  vscode: "VS Code",
  azcli: "Azure CLI",
  clientcredentials: "Service Principal",
  devicecode: "Device Code",
};

function buildEnvDetailItem(env: DataverseEnvironment): DetailItem {
  const properties: DetailProperty[] = [
    { label: "URL", value: env.url, mono: true },
    { label: "Auth Method", value: METHOD_LABELS[env.authMethod] ?? env.authMethod, badge: "blue" },
  ];

  if (env.tenantId) {
    properties.push({ label: "Tenant ID", value: env.tenantId, mono: true });
  }
  if (env.clientId) {
    properties.push({ label: "Client ID", value: env.clientId, mono: true });
  }
  if (env.userId) {
    properties.push({ label: "User ID", value: env.userId, mono: true });
  }
  if (env.organizationId) {
    properties.push({ label: "Organization ID", value: env.organizationId, mono: true });
  }

  return { icon: "$(plug)", label: env.name, properties };
}

function fallbackDetail(label: string): DetailItem {
  return { icon: "$(info)", label, properties: [] };
}
