import * as vscode from "vscode";
import {
  Logger,
  Commands,
  ExtensionIds,
  type DataverseAccountApi,
  registerCommand,
} from "core-dataverse";
import { DecompilerService } from "./services/DecompilerService";
import {
  DecompilerFileSystemProvider,
  DECOMPILED_SCHEME,
} from "./providers/DecompilerFileSystemProvider";
import { CodeNodeProvider } from "./providers/CodeNodeProvider";

/**
 * Dataverse Tools: Decompiler Extension
 *
 * Contributes a "Code" child node under each assembly in the Dataverse Explorer.
 * Expanding it downloads the assembly from Dataverse, sends it to a .NET backend
 * for decompilation using ICSharpCode.Decompiler, and shows namespaces → types.
 * Clicking a type opens its decompiled C# source as a read-only virtual document.
 *
 * Depends on:
 *  - dataverse-environments for auth & the explorer tree framework
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const outputChannel = vscode.window.createOutputChannel("Dataverse Tools: Decompiler");
  Logger.init(outputChannel);
  context.subscriptions.push(outputChannel);

  Logger.info("Dataverse Tools: Decompiler extension activating…");

  // ── Core services (no external dependencies) ───────────────────────────

  const backend = new DecompilerService(context.extensionPath);
  context.subscriptions.push(backend);

  const fsProvider = new DecompilerFileSystemProvider(backend);
  context.subscriptions.push(
    vscode.workspace.registerFileSystemProvider(DECOMPILED_SCHEME, fsProvider, {
      isReadonly: true,
    })
  );

  // ── Dependencies ──────────────────────────────────────────────────────────

  const accountExt = vscode.extensions.getExtension<DataverseAccountApi>(ExtensionIds.Environments);
  if (!accountExt) {
    vscode.window.showErrorMessage(
      "Dataverse Tools: Decompiler requires the Dataverse Tools: Environments extension."
    );
    return;
  }
  const api = accountExt.isActive ? accountExt.exports : await accountExt.activate();

  // ── Register code node provider with explorer framework ─────────────────

  const codeProvider = new CodeNodeProvider(backend, api.getAccessToken.bind(api), fsProvider);
  context.subscriptions.push(api.explorer.registerProvider(codeProvider));

  // ── Internal command: open decompiled source via FS URI ─────────────────

  registerCommand(context, Commands.BrowseAssemblyCode + ".openType", (async (
    uri?: string
  ) => {
    if (!uri) {
      return;
    }
    try {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(uri));
      await vscode.languages.setTextDocumentLanguage(doc, "csharp");
      await vscode.window.showTextDocument(doc, { preview: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Logger.error("Failed to open decompiled document", { uri, error: message });
      vscode.window.showErrorMessage(`Failed to open decompiled source: ${message}`);
    }
  }) as (...args: unknown[]) => unknown);

  Logger.info("Dataverse Tools: Decompiler extension activated.");
}

export function deactivate(): void {
  Logger.info("Dataverse Tools: Decompiler extension deactivated.");
}