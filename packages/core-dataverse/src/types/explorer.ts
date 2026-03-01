/**
 * Explorer Framework types.
 *
 * These define the contribution-point model where extensions register
 * NodeProviders that supply subtrees to the unified Dataverse Explorer.
 * All types here are plain data — no vscode dependency.
 */

import type { DataverseEnvironment } from "./dataverse";
import type { DataverseSolution } from "./entity";

// ─── Solution Component ──────────────────────────────────────────────────────

/**
 * Dataverse solution component type codes.
 * Values from the `componenttype` field on the `solutioncomponent` entity.
 *
 * Only types relevant to the explorer framework are listed here.
 * @see https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/solutioncomponent
 */
export const SolutionComponentType = {
  Entity: 1,
  OptionSet: 9,
  EntityRelationship: 10,
  Workflow: 26,
  SystemForm: 60,
  WebResource: 61,
  PluginType: 90,
  PluginAssembly: 91,
  SdkMessageProcessingStep: 92,
  SdkMessageProcessingStepImage: 93,
  ServiceEndpoint: 95,
} as const;

export type SolutionComponentType =
  (typeof SolutionComponentType)[keyof typeof SolutionComponentType];

/**
 * Annotation that providers attach to an {@link ExplorerNode} to declare its
 * corresponding Dataverse solution component. The framework uses this to:
 *   1. Check whether the component is in the active solution
 *   2. Apply `FileDecorationProvider` dimming for out-of-solution items
 *   3. Show a "+" badge for items that can be added to the solution
 *
 * Nodes without this annotation are excluded from solution-awareness features.
 */
export interface SolutionComponentRef {
  /** Dataverse component type code (e.g. `SolutionComponentType.PluginAssembly`). */
  readonly componentType: SolutionComponentType;
  /**
   * Unique identifier of the component record in Dataverse.
   * For entities this is `MetadataId`; for plugin assemblies `pluginassemblyid`; etc.
   */
  readonly componentId: string;
}

// ─── Explorer Filter ─────────────────────────────────────────────────────────

/**
 * Which components are visible based on managed/unmanaged status.
 * - `"all"` — show both managed and unmanaged components
 * - `"unmanaged"` — hide managed components (default)
 */
export type ComponentScope = "all" | "unmanaged";

/**
 * Framework-level filter state passed to providers as part of {@link ExplorerContext}.
 * Extensible — future filters (text search, tag filters) go here without
 * breaking the provider contract.
 */
export interface ExplorerFilter {
  /** Managed/unmanaged visibility scope. Default: `"unmanaged"`. */
  readonly componentScope: ComponentScope;
  /**
   * When `true` and a non-default solution is selected, providers return ALL
   * components (not just in-solution). The framework decorates out-of-solution
   * items as dimmed with a "+" badge. Has no effect when `solution` is `undefined`.
   */
  readonly showOutOfSolution: boolean;
}

// ─── Explorer Context ────────────────────────────────────────────────────────

/**
 * Immutable snapshot of the framework state passed to every {@link NodeProvider} call.
 *
 * Providers use this to know which environment to query, whether a solution
 * is active, and what filters apply. Providers must NOT mutate or retain
 * this beyond the current call — the framework creates a new instance on
 * every invocation.
 */
export interface ExplorerContext {
  /** The active Dataverse environment. Always present when providers are called. */
  readonly environment: DataverseEnvironment;

  /**
   * Active non-default solution, or `undefined` when the default solution
   * is selected (meaning: no solution filtering, no decorations).
   */
  readonly solution?: DataverseSolution;

  /** Current filter state. */
  readonly filter: ExplorerFilter;

  /**
   * Map of component IDs belonging to the active solution → their
   * `rootcomponentbehavior` value. Populated by the framework before calling
   * providers — empty when `solution` is `undefined`.
   *
   * Keyed as `"componentType:componentId"` for O(1) lookup, e.g.
   * `"91:00000000-0000-0000-0000-000000000001"`.
   *
   * Behavior values: `0` = Include Subcomponents, `1` = Do not include
   * subcomponents, `2` = Include As Shell Only, `undefined` = not set.
   *
   * Providers can use this to annotate nodes or to decide what to return when
   * `filter.showOutOfSolution` is `false`, but should NOT populate it themselves.
   */
  readonly solutionComponentIds: ReadonlyMap<string, number | undefined>;
}

// ─── Explorer Node ───────────────────────────────────────────────────────────

/**
 * A node in the unified explorer tree. All {@link NodeProvider}s return these.
 *
 * This is a pure data interface — the framework host converts it to a
 * `vscode.TreeItem` in the tree data provider. Providers never import
 * `vscode` to build nodes.
 *
 * ## ID uniqueness
 * The `id` must be globally unique across ALL providers. Use a
 * provider-scoped prefix: `"{providerId}:{kind}:{recordId}"`.
 *
 * ## Children
 * Nodes with `children: "lazy"` cause the framework to call back into
 * the provider's `getChildren(node)` when the user expands the node.
 * Nodes with `children: "none"` are leaves.
 */
export interface ExplorerNode {
  /**
   * Globally unique, stable ID. Must produce the same value for the same
   * Dataverse record across refreshes so VS Code preserves expansion state.
   *
   * Convention: `"{providerId}:{kind}:{recordId}"`, e.g.
   * `"plugins:assembly:00000000-0000-0000-0000-000000000001"`.
   */
  readonly id: string;

  /** Display label shown in the tree. */
  readonly label: string;

  /** Secondary text shown after the label (greyed). */
  readonly description?: string;

  /** Tooltip on hover. Can be multi-line (newline-separated). */
  readonly tooltip?: string;

  /**
   * Codicon name without the `$(...)` wrapper, e.g. `"package"`, `"zap"`.
   * The framework wraps this in a `ThemeIcon`.
   */
  readonly icon?: string;

  /**
   * Optional theme color ID applied to the icon, e.g. `"disabledForeground"`.
   */
  readonly iconColor?: string;

  /**
   * Context value for `when` clauses in `package.json` menu contributions.
   * Must match what command contributions expect, e.g. `"assembly"`,
   * `"step.enabled"`, `"entity"`.
   */
  readonly contextValue: string;

  /**
   * Whether this node has children.
   * - `"lazy"` — collapsible; framework calls `provider.getChildren()` on expand
   * - `"none"` — leaf node, not expandable
   */
  readonly children: "lazy" | "none";

  /**
   * Solution component annotation. When present, the framework checks
   * membership in the active solution and applies decorations automatically.
   */
  readonly solutionComponent?: SolutionComponentRef;

  /**
   * Arbitrary provider-specific payload. The framework never inspects this —
   * it passes the node back to the provider in `getChildren()` and to
   * command handlers via the tree item.
   *
   * Providers should store the raw Dataverse entity here so command handlers
   * can access it without refetching, e.g. `{ assembly: PluginAssembly }`.
   */
  readonly data?: Record<string, unknown>;

  /**
   * Optional command to execute on single-click.
   * Most nodes leave this `undefined` (no click action).
   */
  readonly command?: {
    readonly command: string;
    readonly title: string;
    readonly arguments?: readonly unknown[];
  };
}
