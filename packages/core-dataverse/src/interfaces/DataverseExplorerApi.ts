import type * as vscode from "vscode";
import type { DetailItem } from "../types/dataverse";
import type { ExplorerContext, ExplorerNode } from "../types/explorer";

// ─── NodeProvider (implemented by contributor extensions) ─────────────────────

/**
 * Interface that contributor extensions implement to supply subtrees
 * to the unified Dataverse Explorer.
 *
 * The framework calls {@link getRoots} to get top-level nodes, and
 * {@link getChildren} to lazily expand nodes that declared `children: "lazy"`.
 *
 * ## Lifecycle
 * 1. Extension activates and obtains a `DataverseExplorerApi` reference
 * 2. Extension creates a `NodeProvider` and calls `api.registerProvider()`
 * 3. Framework calls `getRoots(context)` on full refresh (env change, manual refresh)
 * 4. Framework calls `getChildren(node, context)` when a lazy node is expanded
 * 5. When the extension deactivates, the `Disposable` from `registerProvider()` is disposed
 *
 * ## Error handling
 * If `getRoots()` or `getChildren()` throws, the framework catches the error
 * and shows an error node for this provider's section. Other providers are unaffected.
 *
 * ## Caching
 * Providers MAY cache data internally, but MUST invalidate when the framework
 * calls `getRoots()` with a new context (e.g. after environment change).
 */
export interface NodeProvider {
  /**
   * Unique provider ID used as a namespace for node IDs and as the
   * registration key. Must be stable across sessions.
   * Convention: lowercase kebab-case, e.g. `"plugins"`, `"entities"`.
   */
  readonly id: string;

  /**
   * Human-readable label shown as the top-level group header.
   * e.g. `"Assemblies"`, `"Entities"`, `"Web Resources"`.
   */
  readonly label: string;

  /**
   * Codicon name for the group header icon, e.g. `"package"`, `"table"`.
   */
  readonly icon: string;

  /**
   * Sort order for positioning relative to other providers.
   * Lower numbers appear first in the tree. Default: `100`.
   */
  readonly sortOrder?: number;

  /**
   * When `true`, this provider only contributes children to other providers'
   * nodes (via {@link canContributeChildren}/{@link contributeChildren}).
   * It will NOT appear as a top-level group in the explorer tree.
   *
   * Contribution-only providers still need `getRoots()` (return `[]`),
   * but the framework skips them when building the root group list.
   */
  readonly contributionOnly?: boolean;

  /**
   * Return the top-level nodes for this provider's subtree.
   *
   * Called on initial load, after environment/solution change, and on manual
   * refresh. The context is always fresh — do not compare to a previous one.
   *
   * Return an empty array for "no items" — the framework shows an
   * appropriate empty state under this provider's group.
   */
  getRoots(context: ExplorerContext): Promise<ExplorerNode[]>;

  /**
   * Return the children of a node that declared `children: "lazy"`.
   *
   * Only called for nodes produced by THIS provider (the framework routes
   * by the provider ID prefix on the node's `id`).
   */
  getChildren(node: ExplorerNode, context: ExplorerContext): Promise<ExplorerNode[]>;

  /**
   * Build a {@link DetailItem} for the shared Details panel when this node
   * is selected. If not implemented or returns `undefined`, the framework
   * shows a generic detail view based on the node's label and description.
   */
  getDetailItem?(node: ExplorerNode): DetailItem | undefined;

  /**
   * Called when the framework is about to refresh this provider's subtree.
   * Providers can use this to invalidate internal caches before `getRoots()`
   * is called again. If not implemented, the framework simply re-calls `getRoots()`.
   */
  onRefresh?(): void;

  /**
   * Synchronous check: can this provider contribute children to nodes
   * with the given `contextValue` from other providers?
   *
   * The framework calls this when building tree items to determine whether
   * nodes that normally have no children should show an expand arrow.
   */
  canContributeChildren?(contextValue: string): boolean;

  /**
   * Return children to inject under a node from another provider.
   *
   * Called by the framework alongside the owning provider's `getChildren()`.
   * Returned nodes are tagged with THIS provider's ID for routing, so
   * subsequent `getChildren()` calls on contributed nodes are dispatched
   * back to the contributing provider.
   */
  contributeChildren?(node: ExplorerNode, context: ExplorerContext): Promise<ExplorerNode[]>;
}

// ─── DataverseExplorerApi (exported by the framework host) ───────────────────

/**
 * Explorer tree framework API, provided by `dataverse-environments` via
 * `DataverseAccountApi.explorer`.
 *
 * Other extensions obtain this via:
 * ```ts
 * const api = vscode.extensions.getExtension<DataverseAccountApi>(
 *   ExtensionIds.Environments
 * )?.exports;
 * api.explorer.registerProvider(myProvider);
 * ```
 */
export interface DataverseExplorerApi {
  /**
   * Register a {@link NodeProvider} to contribute a subtree to the explorer.
   *
   * Returns a `Disposable` that unregisters the provider when disposed.
   * Extensions should push this into `context.subscriptions`.
   *
   * Multiple providers can be registered; each gets its own collapsible
   * group in the explorer tree, sorted by `provider.sortOrder`.
   */
  registerProvider(provider: NodeProvider): vscode.Disposable;

  /**
   * Get the current explorer context, or `undefined` if no environment
   * is selected. Useful for command handlers that need the active env/solution.
   */
  getContext(): ExplorerContext | undefined;

  /**
   * Fires whenever the explorer context changes (environment, solution,
   * or filter change). Providers generally don't need this — the framework
   * re-calls `getRoots()` automatically. This is for command handlers or
   * other UI that needs to react to context changes.
   */
  readonly onDidChangeContext: vscode.Event<ExplorerContext | undefined>;

  /**
   * Refresh the explorer tree.
   *
   * @param providerId  If specified, only refresh this provider's subtree.
   *                    If omitted, refresh all providers.
   */
  refresh(providerId?: string): void;

  /**
   * Programmatically reveal and select a node in the explorer tree.
   *
   * @param nodeId   The globally unique node ID to reveal
   * @param options  Focus and/or select the node
   */
  reveal(
    nodeId: string,
    options?: { focus?: boolean; select?: boolean },
  ): Promise<void>;
}
