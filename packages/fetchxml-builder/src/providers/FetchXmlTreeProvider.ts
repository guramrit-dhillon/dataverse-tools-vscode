import * as vscode from "vscode";
import {
  type FetchNode,
  type FetchNodeKind,
  ALLOWED_CHILDREN,
  DEFAULT_ATTRS,
  createFetchNode,
  deleteNode,
  findNode,
  duplicateNode,
  moveNode,
} from "../model/FetchXmlNode";
import { FetchXmlTreeItem } from "./FetchXmlTreeItem";

export class FetchXmlTreeProvider
  implements vscode.TreeDataProvider<FetchXmlTreeItem>
{
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    FetchXmlTreeItem | undefined
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private root: FetchNode | null = null;

  // ── Public API ─────────────────────────────────────────────────────────────

  getRoot(): FetchNode | null {
    return this.root;
  }

  setRoot(root: FetchNode | null): void {
    this.root = root;
    this._onDidChangeTreeData.fire(undefined);
  }

  addChild(parentId: string, kind: FetchNodeKind): FetchNode | null {
    if (!this.root) { return null; }
    const [parent] = findNode(this.root, parentId);
    if (!parent) { return null; }
    if (!ALLOWED_CHILDREN[parent.kind].includes(kind)) { return null; }

    const child = createFetchNode(kind, { ...DEFAULT_ATTRS[kind] });
    parent.children.push(child);
    this.refresh();
    return child;
  }

  removeNode(id: string): boolean {
    if (!this.root) { return false; }
    if (this.root.id === id) {
      this.root = null;
      this.refresh();
      return true;
    }
    const removed = deleteNode(this.root, id);
    if (removed) { this.refresh(); }
    return removed;
  }

  duplicateNode(id: string): FetchNode | null {
    if (!this.root) { return null; }
    const clone = duplicateNode(this.root, id);
    if (clone) { this.refresh(); }
    return clone;
  }

  moveNodeUp(id: string): boolean {
    if (!this.root) { return false; }
    const moved = moveNode(this.root, id, "up");
    if (moved) { this.refresh(); }
    return moved;
  }

  moveNodeDown(id: string): boolean {
    if (!this.root) { return false; }
    const moved = moveNode(this.root, id, "down");
    if (moved) { this.refresh(); }
    return moved;
  }

  updateNodeAttrs(id: string, attrs: Record<string, string>): boolean {
    if (!this.root) { return false; }
    const [node] = findNode(this.root, id);
    if (!node) { return false; }
    node.attrs = { ...node.attrs, ...attrs };
    this.refresh();
    return true;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * Collect the alias (or name if no alias) of every link-entity in the tree.
   * Used to populate the `entityname` autocomplete in condition nodes.
   */
  getAllLinkedEntityNames(): string[] {
    if (!this.root) { return []; }
    const results: string[] = [];
    this.#collectLinkedEntities(this.root, results);
    return results;
  }

  #collectLinkedEntities(node: FetchNode, results: string[]): void {
    if (node.kind === "link-entity") {
      const label = node.attrs.alias || node.attrs.name;
      if (label) { results.push(label); }
    }
    for (const child of node.children) {
      this.#collectLinkedEntities(child, results);
    }
  }

  /**
   * Walk the tree to find the logical name of the nearest ancestor entity or
   * link-entity for the node with the given id.
   * For entity/link-entity nodes themselves, returns their own name attribute.
   */
  getParentEntityName(nodeId: string): string | undefined {
    if (!this.root) { return undefined; }
    return this.#findEntityContext(this.root, nodeId, undefined);
  }

  /**
   * Returns the entity name of the nearest *containing* ancestor entity or
   * link-entity — always the parent's entity, never the node itself.
   * Used for the `to` attribute on link-entity nodes.
   */
  getContainingEntityName(nodeId: string): string | undefined {
    if (!this.root) { return undefined; }
    return this.#findContainingEntity(this.root, nodeId, undefined);
  }

  #findContainingEntity(
    node: FetchNode,
    targetId: string,
    entityCtx: string | undefined
  ): string | undefined {
    if (node.id === targetId) {
      return entityCtx; // parent context, not the node itself
    }
    const nextCtx =
      (node.kind === "entity" || node.kind === "link-entity") && node.attrs.name
        ? node.attrs.name
        : entityCtx;
    for (const child of node.children) {
      const result = this.#findContainingEntity(child, targetId, nextCtx);
      if (result !== undefined) { return result; }
    }
    return undefined;
  }

  #findEntityContext(
    node: FetchNode,
    targetId: string,
    entityCtx: string | undefined
  ): string | undefined {
    const nextCtx =
      (node.kind === "entity" || node.kind === "link-entity") && node.attrs.name
        ? node.attrs.name
        : entityCtx;

    if (node.id === targetId) {
      // For entity/link-entity, return the node's own name; for children, return parent ctx
      return (node.kind === "entity" || node.kind === "link-entity")
        ? node.attrs.name
        : entityCtx;
    }

    for (const child of node.children) {
      const result = this.#findEntityContext(child, targetId, nextCtx);
      if (result !== undefined) { return result; }
    }
    return undefined;
  }

  /**
   * Returns true when the node with nodeId is nested inside a link-entity scope.
   * Used to hide the `entityname` field on conditions that are already scoped to
   * a specific linked entity (the field only makes sense at the root entity level).
   */
  isUnderLinkEntity(nodeId: string): boolean {
    if (!this.root) { return false; }
    return this.#findUnderLinkEntity(this.root, nodeId, false) ?? false;
  }

  #findUnderLinkEntity(
    node: FetchNode,
    targetId: string,
    underLink: boolean
  ): boolean | undefined {
    // Track whether we're currently inside a link-entity scope.
    // Root entity resets the flag; link-entity sets it.
    const nextUnder =
      node.kind === "entity" ? false
      : node.kind === "link-entity" ? true
      : underLink;

    if (node.id === targetId) { return underLink; }

    for (const child of node.children) {
      const result = this.#findUnderLinkEntity(child, targetId, nextUnder);
      if (result !== undefined) { return result; }
    }
    return undefined;
  }

  // ── TreeDataProvider ───────────────────────────────────────────────────────

  getTreeItem(element: FetchXmlTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: FetchXmlTreeItem): FetchXmlTreeItem[] {
    if (!this.root) { return []; }
    if (!element) {
      return [new FetchXmlTreeItem(this.root, { isRoot: true })];
    }
    const children = element.node.children;
    return children.map((c, i) =>
      new FetchXmlTreeItem(c, {
        isRoot: false,
        siblingIndex: i,
        siblingCount: children.length,
        parentKind: element.node.kind,
      })
    );
  }

  getParent(element: FetchXmlTreeItem): FetchXmlTreeItem | undefined {
    if (!this.root) { return undefined; }
    const [, parentNode] = findNode(this.root, element.node.id);
    if (!parentNode) { return undefined; }
    if (parentNode === this.root) {
      return new FetchXmlTreeItem(parentNode, { isRoot: true });
    }
    const [, grandparent] = findNode(this.root, parentNode.id);
    const siblings = grandparent?.children ?? [];
    const idx = siblings.indexOf(parentNode);
    return new FetchXmlTreeItem(parentNode, {
      isRoot: false,
      siblingIndex: idx >= 0 ? idx : 0,
      siblingCount: siblings.length,
      parentKind: grandparent?.kind,
    });
  }
}
