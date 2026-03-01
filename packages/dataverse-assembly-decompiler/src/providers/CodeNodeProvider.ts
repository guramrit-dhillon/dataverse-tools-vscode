import {
  type NodeProvider,
  type ExplorerNode,
  type ExplorerContext,
  type DataverseEnvironment,
  type PluginAssembly,
  DataverseWebApiClient,
  Commands,
  Logger,
} from "core-dataverse";
import { type DecompilerService, type LoadAssemblyResult } from "../services/DecompilerService";
import { type DecompilerFileSystemProvider, DECOMPILED_SCHEME } from "./DecompilerFileSystemProvider";

const OPEN_TYPE_COMMAND = Commands.BrowseAssemblyCode + ".openType";

// ─── Namespace folder tree ──────────────────────────────────────────────────

interface FolderNode {
  children: Map<string, FolderNode>;
  /** Full dotted namespace — set only on nodes that own types. */
  namespace?: string;
}

function buildFolderTree(namespaces: string[]): FolderNode {
  const root: FolderNode = { children: new Map() };

  for (const ns of namespaces) {
    if (ns === "(global)") {
      root.namespace = "(global)";
      continue;
    }

    const parts = ns.split(".");
    let current = root;
    for (const part of parts) {
      if (!current.children.has(part)) {
        current.children.set(part, { children: new Map() });
      }
      current = current.children.get(part) as FolderNode;
    }
    current.namespace = ns;
  }

  return root;
}

/**
 * Collapse single-child namespace chains into a dotted label.
 *
 * If `aNS` only contains `bNS` which only contains `cNS` (and none of the
 * intermediate nodes own types), the chain collapses into a single tree node
 * labelled `aNS.bNS.cNS`.  If `bNS` has types or multiple children the
 * collapsing stops there.
 */
function collapseSingleChildChain(
  name: string,
  node: FolderNode,
  basePath: string[]
): { label: string; node: FolderNode; path: string[] } {
  let label = name;
  let current = node;
  const path = [...basePath, name];

  while (!current.namespace && current.children.size === 1) {
    const [childName, childNode] = current.children.entries().next().value as [string, FolderNode];
    label += "." + childName;
    path.push(childName);
    current = childNode;
  }

  return { label, node: current, path };
}

// ─── Provider ───────────────────────────────────────────────────────────────

/**
 * Contributes a "Code" child node under each assembly in the Dataverse Explorer.
 *
 * The provider has no top-level roots — it only participates via
 * {@link canContributeChildren} / {@link contributeChildren}.
 *
 * Tree structure contributed under assembly nodes (single-child chains collapsed):
 *   ► Code
 *     ├─ Microsoft.CDS.Plugins
 *     │   ├─ ClassA       → click opens decompiled .cs
 *     │   └─ InterfaceB
 *     └─ Contoso.Models
 *         └─ StructC
 */
export class CodeNodeProvider implements NodeProvider {
  readonly id = "decompiler";
  readonly label = "Decompiler";
  readonly icon = "code";
  readonly sortOrder = 999;
  readonly contributionOnly = true;

  /** assemblyId → loaded result (namespaces). */
  private readonly loaded = new Map<string, LoadAssemblyResult>();

  /** assemblyId → folder tree built from namespace list. */
  private readonly folderTrees = new Map<string, FolderNode>();

  /** In-flight loads to deduplicate concurrent requests. */
  private readonly inflight = new Map<string, Promise<LoadAssemblyResult>>();

  constructor(
    private readonly backend: DecompilerService,
    private readonly getToken: (env: DataverseEnvironment) => Promise<string>,
    private readonly fsProvider: DecompilerFileSystemProvider,
  ) {}

  // ── NodeProvider — top-level (empty, this provider only contributes) ────

  async getRoots(): Promise<ExplorerNode[]> {
    return [];
  }

  async getChildren(node: ExplorerNode, context: ExplorerContext): Promise<ExplorerNode[]> {
    // "Code" node under an assembly → load assembly and list top-level folders
    if (node.contextValue === "decompiler.code") {
      return this.getCodeChildren(node, context);
    }

    // Folder node → list child folders + types
    if (node.contextValue === "decompiler.folder") {
      return this.getFolderChildren(node);
    }

    return [];
  }

  // ── Cross-provider contribution under assembly nodes ────────────────────

  canContributeChildren(contextValue: string): boolean {
    return contextValue === "assembly";
  }

  async contributeChildren(node: ExplorerNode): Promise<ExplorerNode[]> {
    if (node.contextValue !== "assembly") { return []; }
    const assembly = node.data?.assembly as PluginAssembly | undefined;
    if (!assembly?.pluginassemblyid) {
      return [];
    }

    return [{
      id: `decompiler:code:${assembly.pluginassemblyid}`,
      label: "Code",
      icon: "code",
      contextValue: "decompiler.code",
      children: "lazy",
      data: { assembly },
    }];
  }

  onRefresh(): void {
    this.loaded.clear();
    this.folderTrees.clear();
    this.inflight.clear();
  }

  // ── Private ─────────────────────────────────────────────────────────────

  /**
   * "Code" node expanded → load assembly, build folder tree, return root children.
   */
  private async getCodeChildren(
    node: ExplorerNode,
    context: ExplorerContext
  ): Promise<ExplorerNode[]> {
    const assembly = node.data?.assembly as PluginAssembly | undefined;
    if (!assembly?.pluginassemblyid) {
      return [];
    }

    const assemblyId = assembly.pluginassemblyid;
    const result = await this.ensureLoaded(assemblyId, context);

    if (!this.folderTrees.has(assemblyId)) {
      this.folderTrees.set(assemblyId, buildFolderTree(result.namespaces));
    }

    const root = this.folderTrees.get(assemblyId) as FolderNode;
    return this.buildChildNodes(assemblyId, root, []);
  }

  /**
   * Folder node expanded → resolve tree position, return child folders + types.
   */
  private async getFolderChildren(node: ExplorerNode): Promise<ExplorerNode[]> {
    const assemblyId = node.data?.assemblyId as string | undefined;
    const folderPath = node.data?.folderPath as string[] | undefined;

    if (!assemblyId || !folderPath) {
      return [];
    }

    const folder = this.resolveFolderNode(assemblyId, folderPath);
    if (!folder) {
      return [];
    }

    return this.buildChildNodes(assemblyId, folder, folderPath);
  }

  /**
   * Build ExplorerNodes for all children of a folder: sub-folders first, then types.
   */
  private async buildChildNodes(
    assemblyId: string,
    folder: FolderNode,
    currentPath: string[]
  ): Promise<ExplorerNode[]> {
    const children: ExplorerNode[] = [];

    // Sub-folders (sorted alphabetically)
    const sortedFolders = [...folder.children.entries()].sort(
      ([a], [b]) => a.localeCompare(b)
    );

    for (const [name, child] of sortedFolders) {
      const collapsed = collapseSingleChildChain(name, child, currentPath);
      children.push({
        id: `decompiler:folder:${assemblyId}:${collapsed.path.join(".")}`,
        label: collapsed.label,
        icon: "symbol-namespace",
        contextValue: "decompiler.folder",
        children: (collapsed.node.children.size === 0 && !collapsed.node.namespace) ? "none" : "lazy",
        data: { assemblyId, folderPath: collapsed.path },
      });
    }

    // Types at this namespace level (if this folder owns a real namespace)
    if (folder.namespace) {
      try {
        const types = await this.backend.listTypes(assemblyId, folder.namespace);

        for (const t of types) {
          const nsPath = folder.namespace === "(global)"
            ? ""
            : folder.namespace.replace(/\./g, "/") + "/";
          const uri = `${DECOMPILED_SCHEME}:/${assemblyId}/${nsPath}${t.name}.cs`;

          children.push({
            id: `decompiler:type:${assemblyId}:${t.fullName}`,
            label: t.name,
            description: t.kind !== "class" ? t.kind : undefined,
            icon: typeIcon(t.kind),
            contextValue: "decompiler.type",
            children: "none",
            data: { assemblyId, typeFullName: t.fullName },
            command: {
              command: OPEN_TYPE_COMMAND,
              title: "Open Decompiled Source",
              arguments: [uri],
            },
          });
        }
      } catch (err) {
        Logger.error("Failed to list types", {
          assemblyId, namespace: folder.namespace, error: err,
        });
      }
    }

    return children;
  }

  /** Walk the cached tree to find a folder by path segments. */
  private resolveFolderNode(assemblyId: string, path: string[]): FolderNode | undefined {
    let node = this.folderTrees.get(assemblyId);
    if (!node) {
      return undefined;
    }
    for (const seg of path) {
      node = node.children.get(seg);
      if (!node) {
        return undefined;
      }
    }
    return node;
  }

  /**
   * Ensure the assembly is downloaded from Dataverse and loaded in the
   * decompiler backend. Caches the result and deduplicates in-flight requests.
   */
  private async ensureLoaded(
    assemblyId: string,
    context: ExplorerContext
  ): Promise<LoadAssemblyResult> {
    const cached = this.loaded.get(assemblyId);
    if (cached) {
      return cached;
    }

    // Deduplicate concurrent requests for the same assembly
    const existing = this.inflight.get(assemblyId);
    if (existing) {
      return existing;
    }

    const promise = this.loadAssembly(assemblyId, context);
    this.inflight.set(assemblyId, promise);

    try {
      const result = await promise;
      this.loaded.set(assemblyId, result);
      this.fsProvider.registerAssembly(assemblyId, result.namespaces);
      return result;
    } finally {
      this.inflight.delete(assemblyId);
    }
  }

  private async loadAssembly(
    assemblyId: string,
    context: ExplorerContext
  ): Promise<LoadAssemblyResult> {
    // 1. Fetch assembly content from Dataverse
    const client = new DataverseWebApiClient(context.environment, this.getToken);
    const fetched = await client.get<PluginAssembly>(
      `pluginassemblies(${assemblyId})`
    );

    if (!fetched.content) {
      throw new Error("Assembly has no stored content (only Database-sourced assemblies can be decompiled)");
    }

    // 2. Send to decompiler backend
    const result = await this.backend.loadAssembly(assemblyId, fetched.content);

    Logger.info("Assembly loaded for decompilation", {
      name: fetched.name,
      namespaces: result.namespaces.length,
      types: result.typeCount,
    });

    return result;
  }
}

function typeIcon(kind: string): string {
  switch (kind) {
  case "interface":
    return "symbol-interface";
  case "enum":
    return "symbol-enum";
  case "struct":
    return "symbol-struct";
  default:
    return "symbol-class";
  }
}
