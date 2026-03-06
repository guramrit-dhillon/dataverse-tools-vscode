import * as vscode from "vscode";
import {
  Logger,
  ExtensionIds,
  type DataverseAccountApi,
} from "core-dataverse";
import { WebResourceService } from "./services/WebResourceService";
import { WebResourcesNodeProvider } from "./providers/WebResourcesNodeProvider";
import { WebResourceFileSystemProvider } from "./fs/WebResourceFileSystemProvider";
import type { WebResource } from "./interfaces/IWebResourceService";

/** Web resource types that can be opened as text (not binary). */
const TEXT_TYPES = new Set([1, 2, 3, 4, 9, 12]);

/**
 * Dataverse Web Resources Extension
 *
 * Contributes the "Web Resources" provider to the explorer tree framework
 * hosted by `dataverse-environments`.
 *
 * Performance model:
 *  - Root category nodes are hardcoded — no API call on tree open.
 *  - Each category fetches only its web resource types on first expand.
 *  - Virtual folder nodes hold pre-fetched children in memory — no API
 *    call when navigating sub-folders.
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const outputChannel = vscode.window.createOutputChannel("Dataverse Tools: Web Resources");
  Logger.init(outputChannel);
  context.subscriptions.push(outputChannel);

  Logger.info("Dataverse Tools: Web Resources extension activating…");

  // ── Account API (from dataverse-environments) ────────────────────────────────
  const accountExt = vscode.extensions.getExtension<DataverseAccountApi>(
    ExtensionIds.Environments,
  );
  if (!accountExt) {
    vscode.window.showErrorMessage(
      "Dataverse Tools: Web Resources requires the Dataverse Tools: Environments extension.",
    );
    return;
  }
  const api = accountExt.isActive ? accountExt.exports : await accountExt.activate();

  // ── Register provider with the explorer framework ─────────────────────────────
  const service = new WebResourceService(api.getAccessToken.bind(api));
  const provider = new WebResourcesNodeProvider(service);
  context.subscriptions.push(api.explorer.registerProvider(provider));

  // ── Register virtual file system for editable web resource documents ──────────
  const fsProvider = new WebResourceFileSystemProvider(service, api);
  context.subscriptions.push(
    vscode.workspace.registerFileSystemProvider(
      WebResourceFileSystemProvider.SCHEME,
      fsProvider,
      { isCaseSensitive: true, isReadonly: false },
    ),
  );

  // ── Commands ──────────────────────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "dataverse-tools.webresources.refresh",
      () => api.explorer.refresh(provider.id),
    ),
  );

  type TreeArg = { node?: { id: string; data?: Record<string, unknown> } };

  // Open web resource as a linked, editable document via the virtual file system
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "dataverse-tools.webresources.openContent",
      async (item: TreeArg) => {
        const explorerCtx = api.explorer.getContext();
        if (!explorerCtx) {
          vscode.window.showWarningMessage("No Dataverse environment selected.");
          return;
        }
        const webResource = item?.node?.data?.webResource as WebResource | undefined;
        if (!webResource) { return; }

        if (!TEXT_TYPES.has(webResource.webresourcetype)) {
          vscode.window.showWarningMessage(
            `Cannot open binary web resource "${webResource.name}" as text.`,
          );
          return;
        }

        const uri = WebResourceFileSystemProvider.buildUri(
          explorerCtx.environment.id,
          webResource.webresourceid,
          webResource.name,
        );
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, { preview: false });
      },
    ),
  );

  /**
   * URIs for which a publish is already in-flight via "Save and Publish".
   * Used to suppress the post-save notification for those documents.
   */
  const suppressPublishPrompt = new Set<string>();

  // After every Ctrl+S on a web resource, ask the user if they want to publish
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (doc) => {
      if (doc.uri.scheme !== WebResourceFileSystemProvider.SCHEME) { return; }
      if (suppressPublishPrompt.has(doc.uri.toString())) { return; }

      const filename = doc.uri.path.split("/").pop() ?? doc.uri.path;
      const choice = await vscode.window.showInformationMessage(
        `"${filename}" saved. Publish to make changes live?`,
        "Publish",
        "Not now",
      );

      if (choice !== "Publish") { return; }

      const parsed = WebResourceFileSystemProvider.parseUri(doc.uri);
      if (!parsed) { return; }
      const env = api.getEnvironments().find((e) => e.id === parsed.envId);
      if (!env) { return; }

      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `Publishing ${filename}…`, cancellable: false },
        () => service.publishWebResource(env, parsed.webResourceId),
      );
      vscode.window.showInformationMessage(`\u2714 Published: ${filename}`);
    }),
  );

  // Save and Publish — saves + publishes without showing the prompt
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "dataverse-tools.webresources.saveAndPublish",
      async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.uri.scheme !== WebResourceFileSystemProvider.SCHEME) {
          return;
        }

        const uri = editor.document.uri;
        const parsed = WebResourceFileSystemProvider.parseUri(uri);
        if (!parsed) { return; }

        const env = api.getEnvironments().find((e) => e.id === parsed.envId);
        if (!env) {
          vscode.window.showWarningMessage("Could not resolve Dataverse environment.");
          return;
        }

        const filename = uri.path.split("/").pop() ?? uri.path;

        // Suppress the post-save notification since we publish immediately after
        suppressPublishPrompt.add(uri.toString());
        try {
          await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: `Saving and publishing ${filename}…`, cancellable: false },
            async () => {
              await vscode.commands.executeCommand("workbench.action.files.save");
              await service.publishWebResource(env, parsed.webResourceId);
            },
          );
          vscode.window.showInformationMessage(`\u2714 Published: ${filename}`);
        } finally {
          suppressPublishPrompt.delete(uri.toString());
        }
      },
    ),
  );

  Logger.info("Dataverse Tools: Web Resources extension activated.");
}

export function deactivate(): void {
  Logger.info("Dataverse Tools: Web Resources extension deactivated.");
}
