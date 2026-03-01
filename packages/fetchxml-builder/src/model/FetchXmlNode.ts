/** All valid FetchXML element types. */
export type FetchNodeKind =
  | "fetch"
  | "entity"
  | "attribute"
  | "link-entity"
  | "filter"
  | "condition"
  | "order";

/** An in-memory representation of a single FetchXML element. */
export interface FetchNode {
  id: string;
  kind: FetchNodeKind;
  attrs: Record<string, string>;
  children: FetchNode[];
}

let _counter = 0;

export function createFetchNode(
  kind: FetchNodeKind,
  attrs: Record<string, string> = {}
): FetchNode {
  return { id: `n${++_counter}_${Date.now()}`, kind, attrs, children: [] };
}

/** Return a fresh query containing just a fetch + empty entity. */
export function defaultQuery(): FetchNode {
  const root = createFetchNode("fetch", { top: "50" });
  root.children.push(createFetchNode("entity", { name: "" }));
  return root;
}

/** Recursively find a node by id. Returns [node, parent] or [undefined, undefined]. */
export function findNode(
  root: FetchNode,
  id: string,
  parent: FetchNode | null = null
): [FetchNode, FetchNode | null] | [undefined, undefined] {
  if (root.id === id) { return [root, parent]; }
  for (const child of root.children) {
    const result = findNode(child, id, root);
    if (result[0]) { return result; }
  }
  return [undefined, undefined];
}

/** Remove a node with the given id from anywhere in the tree. */
export function deleteNode(root: FetchNode, id: string): boolean {
  const idx = root.children.findIndex((c) => c.id === id);
  if (idx !== -1) {
    root.children.splice(idx, 1);
    return true;
  }
  for (const child of root.children) {
    if (deleteNode(child, id)) { return true; }
  }
  return false;
}

/** Deep-clone a subtree, assigning fresh IDs to every node. */
export function cloneNode(node: FetchNode): FetchNode {
  return {
    ...createFetchNode(node.kind, { ...node.attrs }),
    children: node.children.map(cloneNode),
  };
}

/**
 * Move a node within its parent's children array.
 * Returns true when a move was performed.
 */
export function moveNode(
  root: FetchNode,
  id: string,
  direction: "up" | "down"
): boolean {
  const [, parent] = findNode(root, id);
  if (!parent) { return false; }
  const idx = parent.children.findIndex((c) => c.id === id);
  if (idx === -1) { return false; }
  const target = direction === "up" ? idx - 1 : idx + 1;
  if (target < 0 || target >= parent.children.length) { return false; }
  [parent.children[idx], parent.children[target]] = [parent.children[target], parent.children[idx]];
  return true;
}

/**
 * Duplicate a node (deep-clone with fresh IDs) and insert the clone
 * immediately after the original in the parent's children array.
 * Returns the clone, or null if the node was not found.
 */
export function duplicateNode(root: FetchNode, id: string): FetchNode | null {
  // Root cannot be duplicated — it has no parent.
  const [node, parent] = findNode(root, id);
  if (!node || !parent) { return null; }
  const clone = cloneNode(node);
  const idx = parent.children.findIndex((c) => c.id === id);
  parent.children.splice(idx + 1, 0, clone);
  return clone;
}

/** Which child kinds are valid for each parent kind. */
export const ALLOWED_CHILDREN: Record<FetchNodeKind, FetchNodeKind[]> = {
  fetch: ["entity"],
  entity: ["attribute", "link-entity", "filter", "order"],
  attribute: [],
  "link-entity": ["attribute", "link-entity", "filter", "order"],
  filter: ["condition", "filter"],
  condition: [],
  order: [],
};

/** Default attributes to use when adding a new node of each kind. */
export const DEFAULT_ATTRS: Record<FetchNodeKind, Record<string, string>> = {
  fetch: { top: "50" },
  entity: { name: "" },
  attribute: { name: "" },
  "link-entity": { name: "", from: "", to: "", "link-type": "inner" },
  filter: { type: "and" },
  condition: { attribute: "", operator: "eq", value: "" },
  order: { attribute: "" },
};
