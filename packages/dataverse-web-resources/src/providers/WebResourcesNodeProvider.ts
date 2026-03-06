import {
  SolutionComponentType,
  Logger,
  type DetailItem,
  type DetailProperty,
  type ExplorerContext,
  type ExplorerNode,
  type NodeProvider,
} from "core-dataverse";
import type { IWebResourceService, WebResource, WebResourceType } from "../interfaces/IWebResourceService";

// ── Category definitions ──────────────────────────────────────────────────────

interface Category {
  readonly key: string;
  readonly label: string;
  readonly icon: string;
  readonly types: WebResourceType[];
}

const CATEGORIES: Category[] = [
  { key: "scripts", label: "Scripts",  icon: "file-code",    types: [3] },
  { key: "styles",  label: "Styles",   icon: "symbol-color", types: [2] },
  { key: "html",    label: "HTML",     icon: "browser",      types: [1] },
  { key: "images",  label: "Images",   icon: "file-media",   types: [5, 6, 7, 10, 11] },
  { key: "data",    label: "Data",     icon: "file-code",    types: [4, 9, 12] },
  { key: "other",   label: "Other",    icon: "file",         types: [8] },
];

const TYPE_EXTENSION: Record<number, string> = {
  1: "html", 2: "css", 3: "js", 4: "xml",
  5: "png",  6: "jpg", 7: "gif", 8: "xap",
  9: "xsl", 10: "ico", 11: "svg", 12: "resx",
};

/** Types that can be opened as text in the editor (not binary). */
const TEXT_TYPES = new Set([1, 2, 3, 4, 9, 12]);

const TYPE_ICON: Record<number, string> = {
  1: "file-code",   // html
  2: "symbol-color",// css
  3: "file-code",   // js
  4: "file-code",   // xml
  5: "file-media",  // png
  6: "file-media",  // jpg
  7: "file-media",  // gif
  8: "file",        // xap
  9: "file-code",   // xsl
  10: "file-media", // ico
  11: "file-media", // svg
  12: "file-code",  // resx
};

// ── Virtual folder tree ───────────────────────────────────────────────────────

interface FolderNode {
  readonly type: "folder";
  readonly segment: string;
  readonly children: (FolderNode | LeafNode)[];
}

interface LeafNode {
  readonly type: "leaf";
  readonly segment: string;
  readonly resource: WebResource;
}

/**
 * Build an in-memory tree from a flat list of web resources.
 * Splits each resource's `name` by `/` to produce virtual folders.
 *
 * Example: `new_/scripts/utils/helper.js`
 *   → folder "new_" → folder "scripts" → folder "utils" → leaf "helper.js"
 */
function buildTree(resources: WebResource[]): (FolderNode | LeafNode)[] {
  const root: FolderNode = { type: "folder", segment: "", children: [] };

  for (const r of resources) {
    const segments = r.name.split("/");
    let current = root;

    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i];
      let child = current.children.find(
        (c): c is FolderNode => c.type === "folder" && c.segment === seg,
      );
      if (!child) {
        child = { type: "folder", segment: seg, children: [] };
        (current.children as (FolderNode | LeafNode)[]).push(child);
      }
      current = child;
    }

    const fileName = segments[segments.length - 1];
    (current.children as (FolderNode | LeafNode)[]).push({
      type: "leaf",
      segment: fileName,
      resource: r,
    });
  }

  return root.children;
}

/**
 * Convert the in-memory tree into {@link ExplorerNode}s.
 * Folder nodes store their children in `data.children` so expansion is instant
 * (no additional API call needed).
 */
function treeToNodes(
  categoryKey: string,
  pathPrefix: string,
  nodes: (FolderNode | LeafNode)[],
): ExplorerNode[] {
  return [...nodes]
    .sort((a, b) => {
      // Folders first, then leaves; alphabetical within each group
      if (a.type !== b.type) { return a.type === "folder" ? -1 : 1; }
      return a.segment.localeCompare(b.segment);
    })
    .map((n) => {
      if (n.type === "leaf") {
        return resourceNode(categoryKey, n.resource);
      }
      const fullPath = pathPrefix ? `${pathPrefix}/${n.segment}` : n.segment;
      const children = treeToNodes(categoryKey, fullPath, n.children);
      return folderNode(categoryKey, fullPath, n.segment, children);
    });
}

// ── Node builders ─────────────────────────────────────────────────────────────

function categoryNode(cat: Category): ExplorerNode {
  return {
    id: `webresources:category:${cat.key}`,
    label: cat.label,
    icon: cat.icon,
    contextValue: "webresource-category",
    children: "lazy",
    data: { types: cat.types, categoryKey: cat.key },
  };
}

function folderNode(
  categoryKey: string,
  path: string,
  label: string,
  children: ExplorerNode[],
): ExplorerNode {
  return {
    id: `webresources:folder:${categoryKey}:${path}`,
    label,
    description: `${children.length}`,
    icon: "folder",
    contextValue: "webresource-folder",
    // "lazy" so the tree shows the expand arrow; children are already in data
    children: "lazy",
    data: { children },
  };
}

function resourceNode(categoryKey: string, r: WebResource): ExplorerNode {
  const ext = TYPE_EXTENSION[r.webresourcetype] ?? "";
  const displayLabel = r.displayname || r.name.split("/").pop() || r.name;

  return {
    id: `webresources:resource:${r.webresourceid}`,
    label: displayLabel,
    description: r.name,
    tooltip: [
      `Name: ${r.name}`,
      r.displayname ? `Display: ${r.displayname}` : null,
      `Type: ${ext.toUpperCase() || r.webresourcetype}`,
      r.description ? `Description: ${r.description}` : null,
      r.modifiedon ? `Modified: ${new Date(r.modifiedon).toLocaleString()}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    icon: TYPE_ICON[r.webresourcetype] ?? "file",
    contextValue: "webresource",
    children: "none",
    solutionComponent: {
      componentType: SolutionComponentType.WebResource,
      componentId: r.webresourceid,
    },
    data: { webResource: r, categoryKey },
    command: TEXT_TYPES.has(r.webresourcetype)
      ? {
          command: "dataverse-tools.webresources.openContent",
          title: "Open",
          arguments: [{ node: { id: `webresources:resource:${r.webresourceid}`, data: { webResource: r } } }],
        }
      : undefined,
  };
}

// ── Provider ──────────────────────────────────────────────────────────────────

/**
 * Contributes the "Web Resources" group to the unified Dataverse Explorer.
 *
 * ## Performance strategy
 * - `getRoots()` returns hardcoded category nodes — **zero API calls**.
 * - `getChildren(categoryNode)` fetches only that category's types on first expand.
 * - Virtual folder nodes store their children in `data.children` so sub-folder
 *   navigation is instant (no additional API calls).
 *
 * ## Tree structure
 * ```
 * ► Web Resources
 *   ► Scripts
 *     ► prefix_
 *       ► folder
 *         ● file.js
 *   ► Styles
 *     ● main.css
 *   ► HTML
 *   ► Images
 *   ► Data
 *   ► Other
 * ```
 */
export class WebResourcesNodeProvider implements NodeProvider {
  readonly id = "webresources";
  readonly label = "Web Resources";
  readonly icon = "globe";
  readonly sortOrder = 30;

  private readonly cache = new Map<string, ExplorerNode[]>();
  private readonly inflight = new Map<string, Promise<ExplorerNode[]>>();

  constructor(private readonly service: IWebResourceService) {}

  // ── NodeProvider ────────────────────────────────────────────────────────────

  /**
   * Returns the fixed category nodes immediately — no network call.
   * The tree is fully populated without any loading delay at the root level.
   */
  async getRoots(): Promise<ExplorerNode[]> {
    return CATEGORIES.map(categoryNode);
  }

  async getChildren(
    node: ExplorerNode,
    context: ExplorerContext,
  ): Promise<ExplorerNode[]> {
    // Category → fetch web resources of this type, build virtual folder tree
    if (node.contextValue === "webresource-category") {
      const types = node.data?.types as WebResourceType[] | undefined;
      const categoryKey = node.data?.categoryKey as string | undefined;
      if (!types || !categoryKey) { return []; }

      const cacheKey = `${categoryKey}:${context.filter.componentScope}`;
      return this.fetchCached(cacheKey, async () => {
        const unmanagedOnly = context.filter.componentScope === "unmanaged";
        const resources = await this.service.listWebResources(
          context.environment,
          types,
          unmanagedOnly,
        );
        const tree = buildTree(resources);
        return treeToNodes(categoryKey, "", tree);
      });
    }

    // Folder → children are already in memory from when the category was fetched
    if (node.contextValue === "webresource-folder") {
      return (node.data?.children as ExplorerNode[] | undefined) ?? [];
    }

    return [];
  }

  getDetailItem(node: ExplorerNode): DetailItem | undefined {
    if (node.contextValue !== "webresource") { return undefined; }
    const r = node.data?.webResource as WebResource | undefined;
    if (!r) { return undefined; }

    const ext = TYPE_EXTENSION[r.webresourcetype] ?? String(r.webresourcetype);
    const props: DetailProperty[] = [
      { label: "Name", value: r.name, mono: true },
      ...(r.displayname ? [{ label: "Display Name", value: r.displayname }] : []),
      { label: "Type", value: ext.toUpperCase() },
      ...(r.ismanaged !== undefined
        ? [{
            label: "Managed",
            value: r.ismanaged ? "Managed" : "Unmanaged",
            badge: (r.ismanaged ? "orange" : "grey") as DetailProperty["badge"],
          }]
        : []),
      ...(r.description ? [{ label: "Description", value: r.description }] : []),
      ...(r.createdon ? [{ label: "Created", value: new Date(r.createdon).toLocaleString() }] : []),
      ...(r.modifiedon ? [{ label: "Modified", value: new Date(r.modifiedon).toLocaleString() }] : []),
      { label: "ID", value: r.webresourceid, mono: true },
    ];

    return {
      icon: "$(globe)",
      label: r.displayname || r.name,
      properties: props,
    };
  }

  onRefresh(): void {
    this.cache.clear();
    this.inflight.clear();
  }

  // ── Caching ─────────────────────────────────────────────────────────────────

  private fetchCached(
    key: string,
    loader: () => Promise<ExplorerNode[]>,
  ): Promise<ExplorerNode[]> {
    const cached = this.cache.get(key);
    if (cached) { return Promise.resolve(cached); }

    const existing = this.inflight.get(key);
    if (existing) { return existing; }

    const promise = loader()
      .then((items) => {
        this.cache.set(key, items);
        this.inflight.delete(key);
        return items;
      })
      .catch((err) => {
        this.inflight.delete(key);
        Logger.error(`WebResourcesNodeProvider: failed to load "${key}"`, err);
        throw err;
      });

    this.inflight.set(key, promise);
    return promise;
  }
}
