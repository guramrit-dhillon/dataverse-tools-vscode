import * as vscode from "vscode";
import { type DecompilerService, type TypeListEntry } from "../services/DecompilerService";
import { Logger } from "core-dataverse";

export const DECOMPILED_SCHEME = "dataverse-decompiled";

// ─── Directory tree ──────────────────────────────────────────────────────────

/**
 * An in-memory directory node. Namespace segments are split by "." into nested
 * folders so `Contoso.Plugins.Handlers` becomes `Contoso/Plugins/Handlers/`.
 *
 * Leaf nodes (those that map to an actual backend namespace) carry `namespace`
 * so we know which backend namespace to query for types. Intermediate nodes
 * (e.g. `Contoso/` when only `Contoso.Plugins` exists) have no `namespace`.
 */
interface DirNode {
  children: Map<string, DirNode>;
  /** Full dotted namespace string — set only for nodes that own types. */
  namespace?: string;
  /** Lazily loaded types (populated on first readDirectory). */
  types?: TypeListEntry[];
}

function createDirNode(): DirNode {
  return { children: new Map() };
}

/**
 * Build a directory tree from a flat list of dotted namespace strings.
 *
 * Example input: ["Contoso.Plugins", "Contoso.Plugins.Handlers", "Contoso.Models"]
 *
 * Produces:
 *   Contoso/
 *     Plugins/          (namespace: "Contoso.Plugins")
 *       Handlers/       (namespace: "Contoso.Plugins.Handlers")
 *     Models/           (namespace: "Contoso.Models")
 */
function buildNamespaceTree(namespaces: string[]): DirNode {
  const root = createDirNode();

  for (const ns of namespaces) {
    // "(global)" types go directly in root
    if (ns === "(global)") {
      root.namespace = "(global)";
      continue;
    }

    const parts = ns.split(".");
    let current = root;
    for (const part of parts) {
      if (!current.children.has(part)) {
        current.children.set(part, createDirNode());
      }
      current = current.children.get(part) as DirNode;
    }
    current.namespace = ns;
  }

  return root;
}

// ─── FileSystemProvider ──────────────────────────────────────────────────────

/**
 * Virtual read-only filesystem for decompiled assemblies.
 *
 * Registers as a VS Code FileSystemProvider so that decompiled assemblies
 * appear as workspace folders in the built-in Explorer. Namespace segments
 * are split into nested folders for natural C#-style browsing.
 *
 * URI layout:
 *   dataverse-decompiled:/{assemblyId}                                → root
 *   dataverse-decompiled:/{assemblyId}/Contoso/Plugins                → namespace folder
 *   dataverse-decompiled:/{assemblyId}/Contoso/Plugins/MyPlugin.cs    → decompiled file
 */
export class DecompilerFileSystemProvider implements vscode.FileSystemProvider {

  private readonly _onDidChangeFile = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  readonly onDidChangeFile = this._onDidChangeFile.event;

  /** assemblyId → namespace directory tree */
  private readonly trees = new Map<string, DirNode>();

  /** Cache of decompiled source: "assemblyId/typeFullName" → source bytes */
  private readonly sourceCache = new Map<string, Uint8Array>();

  constructor(private readonly backend: DecompilerService) {}

  // ── Public helpers ──────────────────────────────────────────────────────

  registerAssembly(assemblyId: string, namespaceList: string[]): void {
    this.trees.set(assemblyId, buildNamespaceTree(namespaceList));

    this._onDidChangeFile.fire([{
      type: vscode.FileChangeType.Changed,
      uri: vscode.Uri.parse(`${DECOMPILED_SCHEME}:/${assemblyId}`),
    }]);
  }

  static workspaceFolderUri(assemblyId: string): vscode.Uri {
    return vscode.Uri.parse(`${DECOMPILED_SCHEME}:/${assemblyId}`);
  }

  // ── FileSystemProvider ─────────────────────────────────────────────────

  watch(): vscode.Disposable {
    return new vscode.Disposable(() => {});
  }

  stat(uri: vscode.Uri): vscode.FileStat {
    const { assemblyId, pathSegments, isFile } = this.parsePath(uri);

    if (!assemblyId || !this.trees.has(assemblyId)) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }

    if (isFile) {
      return { type: vscode.FileType.File, ctime: 0, mtime: 0, size: 0 };
    }

    // Verify the directory path exists in the tree
    const node = this.resolveNode(assemblyId, pathSegments);
    if (!node) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }

    return { type: vscode.FileType.Directory, ctime: 0, mtime: 0, size: 0 };
  }

  async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
    const { assemblyId, pathSegments } = this.parsePath(uri);

    if (!assemblyId) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }

    const node = this.resolveNode(assemblyId, pathSegments);
    if (!node) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }

    const entries: [string, vscode.FileType][] = [];

    // Subdirectories (child namespace segments)
    for (const name of node.children.keys()) {
      entries.push([name, vscode.FileType.Directory]);
    }

    // Type files (if this node owns a namespace)
    if (node.namespace) {
      const types = await this.ensureTypes(assemblyId, node);
      for (const t of types) {
        entries.push([`${t.name}.cs`, vscode.FileType.File]);
      }
    }

    return entries;
  }

  async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    const { assemblyId, pathSegments, isFile, fileName } = this.parsePath(uri);

    if (!assemblyId || !isFile || !fileName) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }

    // The directory segments (everything except the file) identify the namespace node
    const dirSegments = pathSegments.slice(0, -1);
    const node = this.resolveNode(assemblyId, dirSegments);
    if (!node?.namespace) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }

    const typeName = fileName.endsWith(".cs") ? fileName.slice(0, -3) : fileName;

    // Resolve full type name from the type list
    const types = await this.ensureTypes(assemblyId, node);
    const entry = types.find((t) => t.name === typeName);
    const fullName = entry?.fullName ?? `${node.namespace}.${typeName}`;

    const cacheKey = `${assemblyId}/${fullName}`;
    const cached = this.sourceCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const source = await this.backend.decompileType(assemblyId, fullName);
      const bytes = new TextEncoder().encode(source);
      this.sourceCache.set(cacheKey, bytes);
      return bytes;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Logger.error("Decompilation failed", { fullName, error: message });
      const fallback = `// Decompilation failed for ${fullName}\n// Error: ${message}\n`;
      return new TextEncoder().encode(fallback);
    }
  }

  // ── Read-only: write operations throw ───────────────────────────────────

  writeFile(): void {
    throw vscode.FileSystemError.NoPermissions("Decompiled sources are read-only");
  }

  rename(): void {
    throw vscode.FileSystemError.NoPermissions("Decompiled sources are read-only");
  }

  delete(): void {
    throw vscode.FileSystemError.NoPermissions("Decompiled sources are read-only");
  }

  createDirectory(): void {
    throw vscode.FileSystemError.NoPermissions("Decompiled sources are read-only");
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  /** Walk the tree to find the DirNode for a given path. */
  private resolveNode(assemblyId: string, segments: string[]): DirNode | undefined {
    let node = this.trees.get(assemblyId);
    if (!node) {
      return undefined;
    }
    for (const seg of segments) {
      node = node.children.get(seg);
      if (!node) {
        return undefined;
      }
    }
    return node;
  }

  /** Lazily fetch types for a namespace node from the backend. */
  private async ensureTypes(assemblyId: string, node: DirNode): Promise<TypeListEntry[]> {
    if (node.types) {
      return node.types;
    }
    if (!node.namespace) {
      return [];
    }
    try {
      const typeList = await this.backend.listTypes(assemblyId, node.namespace);
      node.types = typeList;
      return typeList;
    } catch (err) {
      Logger.error("Failed to list types", { assemblyId, namespace: node.namespace, error: err });
      return [];
    }
  }

  /**
   * Parse a URI path into components.
   *
   * Path: /{assemblyId}/Seg1/Seg2/TypeName.cs
   * Returns assemblyId, pathSegments (all segments after assemblyId),
   * and whether the last segment is a .cs file.
   */
  private parsePath(uri: vscode.Uri): {
    assemblyId: string | undefined;
    pathSegments: string[];
    isFile: boolean;
    fileName: string | undefined;
  } {
    const segments = uri.path.split("/").filter(Boolean);
    const assemblyId = segments[0];
    const rest = segments.slice(1);
    const last = rest[rest.length - 1];
    const isFile = last?.endsWith(".cs") ?? false;

    return {
      assemblyId,
      pathSegments: rest,
      isFile,
      fileName: isFile ? last : undefined,
    };
  }
}
