import * as vscode from "vscode";
import { SolutionComponentType, type ExplorerContext, type ExplorerNode, type NodeProvider } from "core-dataverse";
import type { ContributionRegistry } from "./ContributionRegistry";

const BEHAVIOR_LABELS: Record<number, string> = {
  0: "all objects",
  1: "with metadata",
  2: "without metadata",
};

export type UnifiedItemType =
  | "provider-group"
  | "provider-node"
  | "empty"
  | "error"
  | "loading";

/**
 * Tree item used by the unified explorer {@link TreeDataProvider}.
 * Wraps either a framework-managed group header or an {@link ExplorerNode}
 * produced by a {@link NodeProvider}.
 */
export class UnifiedTreeItem extends vscode.TreeItem {
  readonly itemType: UnifiedItemType;
  readonly providerId?: string;
  readonly node?: ExplorerNode;

  private constructor(params: {
    itemType: UnifiedItemType;
    label: string;
    collapsible?: vscode.TreeItemCollapsibleState;
    providerId?: string;
    node?: ExplorerNode;
    description?: string;
    tooltip?: string;
    iconPath?: vscode.ThemeIcon;
    contextValue?: string;
    command?: vscode.Command;
    id?: string;
  }) {
    super(params.label, params.collapsible ?? vscode.TreeItemCollapsibleState.None);
    this.itemType = params.itemType;
    this.providerId = params.providerId;
    this.node = params.node;
    if (params.id) { this.id = params.id; }
    if (params.description !== undefined) { this.description = params.description; }
    if (params.tooltip !== undefined) { this.tooltip = params.tooltip; }
    if (params.iconPath) { this.iconPath = params.iconPath; }
    if (params.contextValue) { this.contextValue = params.contextValue; }
    if (params.command) { this.command = params.command; }
  }

  // ── Factories ────────────────────────────────────────────────────────────

  /** Top-level collapsible group for a registered provider. */
  static providerGroup(provider: NodeProvider): UnifiedTreeItem {
    return new UnifiedTreeItem({
      itemType: "provider-group",
      label: provider.label,
      collapsible: vscode.TreeItemCollapsibleState.Collapsed,
      providerId: provider.id,
      iconPath: new vscode.ThemeIcon(provider.icon),
      contextValue: `providerGroup.${provider.id}`,
      id: `__group:${provider.id}`,
    });
  }

  /** Wrap an ExplorerNode produced by a provider. */
  static fromNode(
    node: ExplorerNode,
    providerId: string,
    registry?: ContributionRegistry,
    context?: ExplorerContext,
  ): UnifiedTreeItem {
    // Determine if this node is out-of-solution
    let effectiveDescription = node.description;
    let effectiveIconColor = node.iconColor;

    let isOutOfSolution = false;
    let isInSolution = false;
    if (context?.solution && node.solutionComponent && context.solutionComponentIds.size > 0) {
      const key = `${node.solutionComponent.componentType}:${node.solutionComponent.componentId}`;
      if (context.filter.showOutOfSolution && !context.solutionComponentIds.has(key)) {
        isOutOfSolution = true;
        effectiveIconColor = "disabledForeground";
        effectiveDescription = effectiveDescription
          ? `${effectiveDescription}  · not in solution`
          : "not in solution";
      } else if (context.solutionComponentIds.has(key)) {
        isInSolution = true;
        // Show inclusion mode for entities
        if (node.solutionComponent.componentType === SolutionComponentType.Entity) {
          const behavior = context.solutionComponentIds.get(key);
          const label = behavior !== undefined ? BEHAVIOR_LABELS[behavior] : undefined;
          if (label) {
            effectiveDescription = effectiveDescription
              ? `${effectiveDescription}  · ${label}`
              : label;
          }
        }
      }
    }

    const iconColor = effectiveIconColor
      ? new vscode.ThemeColor(effectiveIconColor)
      : undefined;
    const iconPath = node.icon
      ? new vscode.ThemeIcon(node.icon, iconColor)
      : undefined;

    // Determine collapsibility: "lazy" is always expandable.
    // "none" may become expandable if another provider can contribute children.
    let collapsible = vscode.TreeItemCollapsibleState.None;
    if (node.children === "lazy") {
      collapsible = vscode.TreeItemCollapsibleState.Collapsed;
    } else if (registry && node.contextValue) {
      for (const p of registry.getProviders()) {
        if (p.id === providerId) { continue; }
        if (p.canContributeChildren?.(node.contextValue)) {
          collapsible = vscode.TreeItemCollapsibleState.Collapsed;
          break;
        }
      }
    }

    return new UnifiedTreeItem({
      itemType: "provider-node",
      label: node.label,
      collapsible,
      providerId,
      node,
      id: node.id,
      description: effectiveDescription,
      tooltip: node.tooltip,
      iconPath,
      contextValue: isOutOfSolution
        ? `${node.contextValue}.outOfSolution`
        : isInSolution
          ? `${node.contextValue}.inSolution`
          : node.contextValue,
      command: node.command,
    });
  }

  /** Informational message (no icon, not collapsible). */
  static empty(message: string): UnifiedTreeItem {
    return new UnifiedTreeItem({ itemType: "empty", label: message });
  }

  /** Error message shown when a provider call fails. */
  static error(message: string): UnifiedTreeItem {
    return new UnifiedTreeItem({
      itemType: "error",
      label: message,
      iconPath: new vscode.ThemeIcon("error"),
    });
  }

  /** Transient loading indicator. */
  static loading(): UnifiedTreeItem {
    return new UnifiedTreeItem({
      itemType: "loading",
      label: "Loading\u2026",
      iconPath: new vscode.ThemeIcon("loading~spin"),
    });
  }
}
