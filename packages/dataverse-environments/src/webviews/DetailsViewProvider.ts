import type * as vscode from "vscode";
import { type DetailItem, View } from "core-dataverse";
/**
 * Generic Details panel — shared across all Dataverse extensions.
 *
 * Registered as "dataverse-tools.details" in dataverse-environments/package.json.
 * Any extension can update it by calling showItem() via DataverseAccountApi.showDetails().
 */
export class DetailsViewProvider extends View {
  static readonly viewId = "dataverse-tools.details";

  constructor(extensionUri: vscode.Uri) {
    super(extensionUri, DetailsViewProvider.viewId);
  }

  showItem(item: DetailItem | null): void {
    this.setInitPayload(item);
  }
}
