import * as vscode from "vscode";
import { type FetchNode, type FetchNodeKind, ALLOWED_CHILDREN } from "../model/FetchXmlNode";
import { Commands } from "core-dataverse";

const KIND_ICONS: Record<FetchNodeKind, string> = {
  fetch: "file-code",
  entity: "database",
  attribute: "symbol-field",
  "link-entity": "references",
  filter: "filter",
  condition: "symbol-boolean",
  order: "list-ordered",
  value: "symbol-string",
};

function getLabel(node: FetchNode): string {
  switch (node.kind) {
    case "fetch":
      return `fetch${node.attrs.top ? ` (top ${node.attrs.top})` : ""}`;
    case "entity":
      return node.attrs.name ? `entity: ${node.attrs.name}` : "entity (unnamed)";
    case "attribute":
      return node.attrs.name
        ? node.attrs.alias
          ? `${node.attrs.name} as ${node.attrs.alias}`
          : `attr: ${node.attrs.name}`
        : "attribute (unnamed)";
    case "link-entity":
      return node.attrs.name
        ? `link: ${node.attrs.name} (${node.attrs["link-type"] ?? "inner"})`
        : "link-entity (unnamed)";
    case "filter":
      return `filter [${node.attrs.type ?? "and"}]`;
    case "condition": {
      const a = node.attrs.attribute ?? "";
      const op = node.attrs.operator ?? "eq";
      const v = node.attrs.value ?? "";
      return a ? `${a} ${op}${v ? ` '${v}'` : ""}` : "condition";
    }
    case "order":
      return node.attrs.attribute
        ? `order: ${node.attrs.attribute}${node.attrs.descending === "true" ? " ↓" : " ↑"}`
        : "order";
    case "value":
      return node.text ? `value: ${node.text}` : "value (empty)";
    default:
      return node.kind;
  }
}

export interface FetchXmlTreeItemOptions {
  /** True only for the root <fetch> node (has no parent). */
  isRoot: boolean;
  /** 0-based index among siblings. Undefined for root. */
  siblingIndex?: number;
  /** Total number of siblings. Undefined for root. */
  siblingCount?: number;
  /** Kind of the direct parent. Undefined for root. */
  parentKind?: FetchNodeKind;
}

/**
 * Compute a dot-separated contextValue that encodes which actions are valid
 * for this node so VS Code `when` clause expressions can hide/show buttons.
 *
 * Format: "fetchxml.<kind>[.canAddChild][.canDelete][.canDuplicate][.canMoveUp][.canMoveDown]"
 */
function buildContextValue(node: FetchNode, opts: FetchXmlTreeItemOptions): string {
  const { isRoot, siblingIndex = 0, siblingCount = 1, parentKind } = opts;

  // Can add a child only if:
  // • this kind allows children AND
  // • it's not "fetch" that already has its sole allowed child ("entity")
  const allowedChildren = ALLOWED_CHILDREN[node.kind];
  const fetchAlreadyHasEntity =
    node.kind === "fetch" && node.children.some((c) => c.kind === "entity");
  const canAddChild = allowedChildren.length > 0 && !fetchAlreadyHasEntity;

  // Root node cannot be deleted or moved.
  const canDelete = !isRoot;

  // Cannot duplicate:
  // • the root fetch (has no parent)
  // • an entity node whose parent is "fetch" (fetch may only have one entity)
  const canDuplicate =
    !isRoot && !(parentKind === "fetch" && node.kind === "entity");

  const canMoveUp = !isRoot && siblingIndex > 0;
  const canMoveDown = !isRoot && siblingIndex < siblingCount - 1;

  return [
    "fetchxml",
    node.kind,
    canAddChild && "canAddChild",
    canDelete && "canDelete",
    canDuplicate && "canDuplicate",
    canMoveUp && "canMoveUp",
    canMoveDown && "canMoveDown",
  ]
    .filter(Boolean)
    .join(".");
}

export class FetchXmlTreeItem extends vscode.TreeItem {
  readonly node: FetchNode;

  constructor(node: FetchNode, opts: FetchXmlTreeItemOptions) {
    const label = getLabel(node);
    const collapsible =
      node.children.length > 0
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.None;

    super(label, collapsible);

    this.node = node;
    this.id = node.id;
    this.iconPath = new vscode.ThemeIcon(KIND_ICONS[node.kind] ?? "symbol-misc");
    this.contextValue = buildContextValue(node, opts);
    this.tooltip = `<${node.kind}>`;

    this.command = {
      command: Commands.FetchXmlSelectNode,
      title: "Select Node",
      arguments: [node],
    };
  }
}
