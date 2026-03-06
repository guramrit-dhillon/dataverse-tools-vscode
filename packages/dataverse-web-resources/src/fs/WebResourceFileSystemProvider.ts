import * as vscode from "vscode";
import type { DataverseAccountApi } from "core-dataverse";
import type { IWebResourceService } from "../interfaces/IWebResourceService";

/**
 * Virtual file system provider for Dataverse web resources.
 *
 * Registers the `dataverse-webresource:` URI scheme so VS Code treats
 * web resources as real files: proper tab title, syntax highlighting,
 * and Ctrl+S saves content back to Dataverse.
 *
 * URI format:
 *   dataverse-webresource:/{encodedEnvId}/{webResourceId}/{name}
 *
 * The `name` segment mirrors the Dataverse `name` field (e.g.
 * `prefix_/scripts/main.js`), so VS Code uses the last segment as the
 * tab title and infers the language from the extension.
 */
export class WebResourceFileSystemProvider implements vscode.FileSystemProvider {
  static readonly SCHEME = "dataverse-webresource";

  private readonly _onDidChangeFile = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  readonly onDidChangeFile = this._onDidChangeFile.event;

  /** Cache: uri.toString() → bytes, populated by readFile for stat(). */
  private readonly cache = new Map<string, Uint8Array>();

  constructor(
    private readonly service: IWebResourceService,
    private readonly api: DataverseAccountApi,
  ) {}

  // ── URI helpers ────────────────────────────────────────────────────────────

  /**
   * Build a URI for a web resource.
   * The `name` field is used as the path suffix so VS Code sees the right
   * filename (and therefore picks the right language for syntax highlighting).
   */
  static buildUri(envId: string, webResourceId: string, name: string): vscode.Uri {
    // Ensure the name doesn't start with a slash (the authority separator adds one)
    const safeName = name.startsWith("/") ? name.slice(1) : name;
    return vscode.Uri.from({
      scheme: WebResourceFileSystemProvider.SCHEME,
      path: `/${encodeURIComponent(envId)}/${webResourceId}/${safeName}`,
    });
  }

  static parseUri(uri: vscode.Uri): { envId: string; webResourceId: string } | undefined {
    // path = /{encodedEnvId}/{webResourceId}/...name...
    const parts = uri.path.split("/").filter(Boolean);
    if (parts.length < 2) { return undefined; }
    return {
      envId: decodeURIComponent(parts[0]),
      webResourceId: parts[1],
    };
  }

  // ── FileSystemProvider ─────────────────────────────────────────────────────

  watch(): vscode.Disposable {
    return new vscode.Disposable(() => { /* no-op: Dataverse has no push notifications */ });
  }

  stat(uri: vscode.Uri): vscode.FileStat {
    const now = Date.now();
    const cached = this.cache.get(uri.toString());
    return {
      type: vscode.FileType.File,
      ctime: now,
      mtime: now,
      size: cached?.byteLength ?? 0,
    };
  }

  readDirectory(): never {
    throw vscode.FileSystemError.NoPermissions("Directories not supported");
  }

  createDirectory(): never {
    throw vscode.FileSystemError.NoPermissions("Directories not supported");
  }

  async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    const parsed = WebResourceFileSystemProvider.parseUri(uri);
    if (!parsed) { throw vscode.FileSystemError.FileNotFound(uri); }

    const env = this.api.getEnvironments().find((e) => e.id === parsed.envId);
    if (!env) {
      throw vscode.FileSystemError.FileNotFound(
        `Environment "${parsed.envId}" not found`,
      );
    }

    const base64 = await this.service.getContent(env, parsed.webResourceId);
    const buf = base64 ? Buffer.from(base64, "base64") : Buffer.alloc(0);
    const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    this.cache.set(uri.toString(), bytes);
    return bytes;
  }

  async writeFile(
    uri: vscode.Uri,
    content: Uint8Array,
    _options: { readonly create: boolean; readonly overwrite: boolean },
  ): Promise<void> {
    const parsed = WebResourceFileSystemProvider.parseUri(uri);
    if (!parsed) { throw vscode.FileSystemError.FileNotFound(uri); }

    const env = this.api.getEnvironments().find((e) => e.id === parsed.envId);
    if (!env) {
      throw vscode.FileSystemError.FileNotFound(
        `Environment "${parsed.envId}" not found`,
      );
    }

    const base64 = Buffer.from(content).toString("base64");
    await this.service.updateContent(env, parsed.webResourceId, base64);

    this.cache.set(uri.toString(), content);
    this._onDidChangeFile.fire([{ type: vscode.FileChangeType.Changed, uri }]);
  }

  delete(): never {
    throw vscode.FileSystemError.NoPermissions("Use the Delete command to remove web resources");
  }

  rename(): never {
    throw vscode.FileSystemError.NoPermissions("Rename not supported via this provider");
  }
}
