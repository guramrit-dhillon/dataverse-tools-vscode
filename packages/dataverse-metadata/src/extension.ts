import * as vscode from "vscode";
import {
  Logger,
  ExtensionIds,
  type DataverseAccountApi,
} from "core-dataverse";
import { MetadataService } from "./services/MetadataService";
import { EntitiesNodeProvider } from "./providers/EntitiesNodeProvider";

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

  Logger.info("Dataverse Tools: Metadata extension activated.");
}

export function deactivate(): void {
  Logger.info("Dataverse Tools: Metadata extension deactivated.");
}
