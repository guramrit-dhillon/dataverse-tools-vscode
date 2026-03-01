import * as vscode from "vscode";
import { parseFetchXml } from "../model/FetchXmlSerializer";
import { type FetchXmlTreeProvider } from "./FetchXmlTreeProvider";

export const FETCHXML_EDIT_SCHEME = "fetchxml-edit";
export const FETCHXML_EDIT_URI = vscode.Uri.parse(`${FETCHXML_EDIT_SCHEME}://builder/query.fetchxml`);

/**
 * Writable virtual filesystem for FetchXML editing.
 *
 * Exposes a single virtual file (`query.fetchxml`) that stays in sync with the
 * FetchXML tree. The user can edit the XML directly and save (Ctrl+S) to push
 * changes back to the tree.
 *
 * A loop guard (`_suppressTreeSync`) prevents the infinite cycle:
 *   tree change → serialize → update editor → writeFile → parse → setRoot → ...
 */
export class FetchXmlFileSystemProvider implements vscode.FileSystemProvider {

  private readonly _onDidChangeFile = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  readonly onDidChangeFile = this._onDidChangeFile.event;

  private _content = new Uint8Array(0);
  private _mtime = 0;

  /**
   * When true, the next `writeFile` call will NOT sync back to the tree.
   * Set by `update()` when the tree pushes new XML to the editor.
   */
  private _suppressTreeSync = false;

  constructor(private readonly treeProvider: FetchXmlTreeProvider) {}

  // ── Public helpers ──────────────────────────────────────────────────────

  /**
   * Called when the tree changes — stores the serialized XML and notifies
   * VS Code so the editor refreshes its content.
   */
  update(xml: string): void {
    this._suppressTreeSync = true;
    this._content = new TextEncoder().encode(xml);
    this._mtime = Date.now();
    this._onDidChangeFile.fire([{
      type: vscode.FileChangeType.Changed,
      uri: FETCHXML_EDIT_URI,
    }]);
  }

  // ── FileSystemProvider ─────────────────────────────────────────────────

  watch(): vscode.Disposable {
    return new vscode.Disposable(() => {});
  }

  stat(): vscode.FileStat {
    return {
      type: vscode.FileType.File,
      ctime: 0,
      mtime: this._mtime,
      size: this._content.byteLength,
    };
  }

  readFile(): Uint8Array {
    return this._content;
  }

  writeFile(_uri: vscode.Uri, content: Uint8Array): void {
    this._content = content;
    this._mtime = Date.now();

    if (this._suppressTreeSync) {
      this._suppressTreeSync = false;
      return;
    }

    // User saved the editor — parse and sync back to tree.
    const xml = new TextDecoder().decode(content);
    const root = parseFetchXml(xml);
    if (root) {
      // setRoot fires onDidChangeTreeData → update() sets _suppressTreeSync
      this.treeProvider.setRoot(root);
    } else {
      vscode.window.showWarningMessage(
        "Invalid FetchXML — the tree was not updated. Fix the XML and save again."
      );
    }
  }

  // ── Unsupported operations ─────────────────────────────────────────────

  readDirectory(): [string, vscode.FileType][] {
    return [];
  }

  createDirectory(): void {
    throw vscode.FileSystemError.NoPermissions();
  }

  delete(): void {
    throw vscode.FileSystemError.NoPermissions();
  }

  rename(): void {
    throw vscode.FileSystemError.NoPermissions();
  }
}
