import * as vscode from "vscode";
import {
  Logger,
  ExtensionIds,
  type DataverseAccountApi,
} from "core-dataverse";
import { MetadataService } from "./services/MetadataService";
import { EntitiesNodeProvider } from "./providers/EntitiesNodeProvider";
import { EntityPanel } from "./webviews/EntityPanel";

/**
 * Dataverse Metadata Extension
 *
 * Contributes metadata-related providers to the explorer tree framework
 * hosted by `dataverse-environments`. Currently provides the Entities provider.
 */
export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  const outputChannel = vscode.window.createOutputChannel("Dataverse Tools: Metadata");
  Logger.init(outputChannel);
  context.subscriptions.push(outputChannel);

  Logger.info("Dataverse Tools: Metadata extension activating…");

  // ── Account API (from dataverse-environments) ────────────────────────────
  const accountExt =
    vscode.extensions.getExtension<DataverseAccountApi>(
      ExtensionIds.Environments,
    );
  if (!accountExt) {
    vscode.window.showErrorMessage(
      "Dataverse Tools: Metadata requires the Dataverse Tools: Environments extension.",
    );
    return;
  }
  const api = accountExt.isActive
    ? accountExt.exports
    : await accountExt.activate();

  // ── Register metadata providers with explorer framework ──────────────────
  const metadataService = new MetadataService(api.getAccessToken.bind(api));
  const entitiesProvider = new EntitiesNodeProvider(metadataService);
  context.subscriptions.push(api.explorer.registerProvider(entitiesProvider));

  // ── Commands ──────────────────────────────────────────────────────────────
  const openEntityTab = (tab: Parameters<typeof EntityPanel.render>[5]) =>
    (payload: { logicalName: string; displayName?: string }) => {
      const explorerContext = api.explorer.getContext();
      if (!explorerContext) {
        vscode.window.showErrorMessage("No active Dataverse environment.");
        return;
      }
      EntityPanel.render(context.extensionUri, explorerContext.environment, metadataService, payload.logicalName, payload.displayName, tab);
    };

  context.subscriptions.push(
    vscode.commands.registerCommand("dataverse-tools.metadata.openAttributes",    openEntityTab("attributes")),
    vscode.commands.registerCommand("dataverse-tools.metadata.openRelationships", openEntityTab("relationships")),
    vscode.commands.registerCommand("dataverse-tools.metadata.openForms",         openEntityTab("forms")),
    vscode.commands.registerCommand("dataverse-tools.metadata.openViews",         openEntityTab("views")),
  );

  Logger.info("Dataverse Tools: Metadata extension activated.");
}

export function deactivate(): void {
  Logger.info("Dataverse Tools: Metadata extension deactivated.");
}
