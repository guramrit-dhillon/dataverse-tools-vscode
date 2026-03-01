import * as vscode from "vscode";
import {
  Logger,
  DataverseWebApiClient,
  type DataverseAccountApi,
  type DataverseSolution,
  type ExplorerContext,
  type ExplorerFilter,
  type ExplorerNode,
} from "core-dataverse";
import { type ContributionRegistry } from "./ContributionRegistry";
import { UnifiedTreeItem } from "./UnifiedTreeItem";

const ACTIVE_ENV_KEY = "dataverse-tools.explorer.activeEnvironmentId";
const ACTIVE_SOLUTION_KEY = "dataverse-tools.explorer.activeSolution";
const FILTER_KEY = "dataverse-tools.explorer.filter";

const DEFAULT_FILTER: ExplorerFilter = {
  componentScope: "unmanaged",
  showOutOfSolution: false,
};

/**
 * Unified tree data provider for the Dataverse Explorer.
 *
 * Delegates to registered {@link NodeProvider}s via the
 * {@link ContributionRegistry}. Each provider gets its own collapsible
 * group header; expanding a group calls `provider.getRoots()`.
 */
export class UnifiedTreeProvider
  implements vscode.TreeDataProvider<UnifiedTreeItem>
{
  private readonly _onDidChangeTreeData =
    new vscode.EventEmitter<UnifiedTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private readonly _onDidChangeContext =
    new vscode.EventEmitter<ExplorerContext | undefined>();
  readonly onDidChangeContext = this._onDidChangeContext.event;

  private context: ExplorerContext | undefined;

  /** Cached solution component IDs — invalidated only on env/solution change. */
  private cachedSolutionComponentIds = new Map<string, number | undefined>();
  private cachedSolutionId: string | undefined;

  /**
   * Cached group items keyed by provider ID.
   * VS Code requires the same object reference for targeted
   * `onDidChangeTreeData.fire(element)` calls.
   */
  private groupItems = new Map<string, UnifiedTreeItem>();

  constructor(
    private readonly registry: ContributionRegistry,
    private readonly api: DataverseAccountApi,
    private readonly workspaceState: vscode.Memento,
  ) {
    // Refresh tree when providers are registered / unregistered
    registry.onDidChange(() => {
      this.groupItems.clear();
      this._onDidChangeTreeData.fire();
    });

    // Re-evaluate context when environments change (e.g. env removed)
    api.onDidChangeEnvironments(() => void this.rebuildContext());

    // Build initial context from persisted state
    void this.rebuildContext();
  }

  // ── Context management ─────────────────────────────────────────────────

  getContext(): ExplorerContext | undefined {
    return this.context;
  }

  async setEnvironment(
    envId: string,
    solution?: DataverseSolution,
  ): Promise<void> {
    await this.workspaceState.update(ACTIVE_ENV_KEY, envId);
    await this.workspaceState.update(
      ACTIVE_SOLUTION_KEY,
      solution ?? undefined,
    );
    await this.rebuildContext();
  }

  async setFilter(partial: Partial<ExplorerFilter>): Promise<void> {
    const current =
      this.workspaceState.get<ExplorerFilter>(FILTER_KEY) ?? DEFAULT_FILTER;
    const merged: ExplorerFilter = { ...current, ...partial };
    await this.workspaceState.update(FILTER_KEY, merged);
    await this.rebuildContext();
  }

  getFilter(): ExplorerFilter {
    return (
      this.workspaceState.get<ExplorerFilter>(FILTER_KEY) ?? DEFAULT_FILTER
    );
  }

  private async rebuildContext(): Promise<void> {
    const envId = this.workspaceState.get<string>(ACTIVE_ENV_KEY);
    const env = envId
      ? this.api.getEnvironments().find((e) => e.id === envId)
      : undefined;
    const solution =
      this.workspaceState.get<DataverseSolution>(ACTIVE_SOLUTION_KEY);
    const filter =
      this.workspaceState.get<ExplorerFilter>(FILTER_KEY) ?? DEFAULT_FILTER;

    if (!env) {
      this.context = undefined;
    } else {
      const activeSolution =
        solution && solution.uniquename !== "Default" ? solution : undefined;

      // Only re-query solution components when the solution actually changed
      if (activeSolution?.solutionid !== this.cachedSolutionId) {
        this.cachedSolutionId = activeSolution?.solutionid;
        this.cachedSolutionComponentIds = new Map<string, number | undefined>();

        if (activeSolution) {
          try {
            const client = new DataverseWebApiClient(
              env,
              (e) => this.api.getAccessToken(e),
            );
            const components = await client.getAll<{
              componenttype: number;
              objectid: string;
              rootcomponentbehavior: number | null;
            }>(
              "solutioncomponents",
              `$filter=_solutionid_value eq ${activeSolution.solutionid}&$select=componenttype,objectid,rootcomponentbehavior`,
            );
            this.cachedSolutionComponentIds = new Map(
              components.map((c) => [`${c.componenttype}:${c.objectid}`, c.rootcomponentbehavior ?? undefined]),
            );
          } catch (err) {
            Logger.error("Explorer: failed to fetch solution components", err);
          }
        }
      }

      this.context = {
        environment: env,
        solution: activeSolution,
        filter,
        solutionComponentIds: this.cachedSolutionComponentIds,
      };
    }

    this._onDidChangeContext.fire(this.context);

    // Notify all providers so they can invalidate caches
    for (const p of this.registry.getProviders()) {
      p.onRefresh?.();
    }

    this.groupItems.clear();
    this._onDidChangeTreeData.fire();
  }

  // ── TreeDataProvider ───────────────────────────────────────────────────

  getTreeItem(element: UnifiedTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(
    element?: UnifiedTreeItem,
  ): Promise<UnifiedTreeItem[]> {
    // ── Root level ─────────────────────────────────────────────────────
    if (!element) {
      if (!this.context) {
        return [
          UnifiedTreeItem.empty(
            "No environment selected. Click \u2630 to select one.",
          ),
        ];
      }

      const providers = this.registry.getProviders()
        .filter((p) => !p.contributionOnly);
      if (providers.length === 0) {
        return [UnifiedTreeItem.empty("No providers registered.")];
      }

      return providers.map((p) => {
        let group = this.groupItems.get(p.id);
        if (!group) {
          group = UnifiedTreeItem.providerGroup(p);
          this.groupItems.set(p.id, group);
        }
        return group;
      });
    }

    // ── Provider group → call getRoots() ───────────────────────────────
    if (element.itemType === "provider-group" && element.providerId) {
      const provider = this.registry.getProvider(element.providerId);
      if (!provider || !this.context) {
        return [];
      }
      try {
        let nodes = await provider.getRoots(this.context);
        nodes = this.filterBySolution(nodes);
        if (nodes.length === 0) {
          return [UnifiedTreeItem.empty("No items")];
        }
        return nodes.map((n) => UnifiedTreeItem.fromNode(n, provider.id, this.registry, this.context));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        Logger.error(
          `Explorer: provider "${provider.id}" getRoots failed`,
          err,
        );
        return [UnifiedTreeItem.error(`Error: ${msg}`)];
      }
    }

    // ── Provider node with lazy children → call getChildren() ──────────
    if (
      element.itemType === "provider-node" &&
      element.providerId &&
      this.context
    ) {
      const allChildren: UnifiedTreeItem[] = [];

      // Own children (from owning provider)
      if (element.node?.children === "lazy") {
        const provider = this.registry.getProvider(element.providerId);
        if (provider) {
          try {
            let nodes = await provider.getChildren(element.node, this.context);
            nodes = this.filterBySolution(nodes);
            allChildren.push(
              ...nodes.map((n) => UnifiedTreeItem.fromNode(n, provider.id, this.registry, this.context)),
            );
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            Logger.error(
              `Explorer: provider "${provider.id}" getChildren failed`,
              err,
            );
            allChildren.push(UnifiedTreeItem.error(`Error: ${msg}`));
          }
        }
      }

      // Cross-provider contributions
      if (element.node) {
        for (const p of this.registry.getProviders()) {
          if (p.id === element.providerId) { continue; }
          if (!p.contributeChildren) { continue; }
          if (p.canContributeChildren && !p.canContributeChildren(element.node.contextValue)) { continue; }
          try {
            let contributed = await p.contributeChildren(element.node, this.context);
            contributed = this.filterBySolution(contributed);
            allChildren.push(
              ...contributed.map((n) => UnifiedTreeItem.fromNode(n, p.id, this.registry, this.context)),
            );
          } catch (err) {
            Logger.error(
              `Explorer: provider "${p.id}" contributeChildren failed`,
              err,
            );
          }
        }
      }

      if (allChildren.length === 0) {
        return [UnifiedTreeItem.empty("No items")];
      }
      return allChildren;
    }

    return [];
  }

  // ── Solution filtering ─────────────────────────────────────────────────

  /**
   * When a solution is active and `showOutOfSolution` is false, remove nodes
   * that have a `solutionComponent` annotation but are NOT in the solution.
   * Non-annotated nodes always pass through.
   */
  private filterBySolution(nodes: ExplorerNode[]): ExplorerNode[] {
    if (
      !this.context?.solution ||
      this.context.filter.showOutOfSolution ||
      this.context.solutionComponentIds.size === 0
    ) {
      return nodes;
    }

    return nodes.filter((n) => {
      if (!n.solutionComponent) { return true; }
      const key = `${n.solutionComponent.componentType}:${n.solutionComponent.componentId}`;
      return this.context!.solutionComponentIds.has(key);
    });
  }

  // ── Solution cache ───────────────────────────────────────────────────

  /** Invalidate cached solution component IDs and rebuild context. */
  async refreshSolutionComponents(): Promise<void> {
    this.cachedSolutionId = undefined;
    await this.rebuildContext();
  }

  // ── Refresh ────────────────────────────────────────────────────────────

  /** Refresh all providers, or a specific provider's subtree. */
  refresh(providerId?: string): void {
    if (providerId) {
      const provider = this.registry.getProvider(providerId);
      provider?.onRefresh?.();
      const group = this.groupItems.get(providerId);
      if (group) {
        this._onDidChangeTreeData.fire(group);
        return;
      }
    }

    // Full refresh
    for (const p of this.registry.getProviders()) {
      p.onRefresh?.();
    }
    this._onDidChangeTreeData.fire();
  }
}
