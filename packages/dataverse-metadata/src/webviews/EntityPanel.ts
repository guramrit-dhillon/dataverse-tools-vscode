import * as vscode from "vscode";
import { type DataverseEnvironment, Logger, Panel } from "core-dataverse";
import type { IMetadataService } from "../interfaces/IMetadataService";

export type EntityTab = "attributes" | "relationships" | "forms" | "views";

interface EntityInitPayload {
  envName: string;
  entityLogicalName: string;
  entityDisplayName?: string;
  tab: EntityTab;
}

/**
 * Unified entity metadata panel showing Attributes, Relationships, Forms,
 * and Views in a single tabbed webview. Keyed by `{envId}:{entityLogicalName}`
 * so each entity × environment gets its own tab. Tabs load lazily.
 */
export class EntityPanel extends Panel {
  private static readonly panels = new Map<string, EntityPanel>();

  private panelKey: string;

  private constructor(
    extensionUri: vscode.Uri,
    private env: DataverseEnvironment,
    private metadataSvc: IMetadataService,
    private entityLogicalName: string,
    entityDisplayName: string | undefined,
    tab: EntityTab,
  ) {
    super(
      extensionUri,
      "dataverse-tools.entityMetadata",
      EntityPanel.title(entityDisplayName, entityLogicalName, env.name),
      { envName: env.name, entityLogicalName, entityDisplayName, tab } satisfies EntityInitPayload,
    );
    this.panelKey = `${env.id}:${entityLogicalName}`;

    this.initListeners({
      retrieveAttributes:    this.handleRetrieveAttributes.bind(this),
      retrieveRelationships: this.handleRetrieveRelationships.bind(this),
      retrieveForms:         this.handleRetrieveForms.bind(this),
      retrieveViews:         this.handleRetrieveViews.bind(this),
    });
  }

  static render(
    extensionUri: vscode.Uri,
    env: DataverseEnvironment,
    metadataSvc: IMetadataService,
    entityLogicalName: string,
    entityDisplayName: string | undefined,
    tab: EntityTab,
  ): void {
    const key = `${env.id}:${entityLogicalName}`;
    const existing = EntityPanel.panels.get(key);
    if (existing) {
      existing.env = env;
      existing.metadataSvc = metadataSvc;
      const payload: EntityInitPayload = { envName: env.name, entityLogicalName, entityDisplayName, tab };
      existing.activate(EntityPanel.title(entityDisplayName, entityLogicalName, env.name), payload);
      return;
    }
    const instance = new EntityPanel(extensionUri, env, metadataSvc, entityLogicalName, entityDisplayName, tab);
    EntityPanel.panels.set(key, instance);
  }

  // ── Message handlers ────────────────────────────────────────────────────────

  private async handleRetrieveAttributes() {
    try {
      return await this.metadataSvc.listAttributes(this.env, this.entityLogicalName);
    } catch (err) {
      Logger.error("Failed to retrieve attributes", err);
      throw new Error(err instanceof Error ? err.message : String(err));
    }
  }

  private async handleRetrieveRelationships() {
    try {
      return await this.metadataSvc.listRelationships(this.env, this.entityLogicalName);
    } catch (err) {
      Logger.error("Failed to retrieve relationships", err);
      throw new Error(err instanceof Error ? err.message : String(err));
    }
  }

  private async handleRetrieveForms() {
    try {
      return await this.metadataSvc.listForms(this.env, this.entityLogicalName);
    } catch (err) {
      Logger.error("Failed to retrieve forms", err);
      throw new Error(err instanceof Error ? err.message : String(err));
    }
  }

  private async handleRetrieveViews() {
    try {
      return await this.metadataSvc.listViews(this.env, this.entityLogicalName);
    } catch (err) {
      Logger.error("Failed to retrieve views", err);
      throw new Error(err instanceof Error ? err.message : String(err));
    }
  }

  protected override dispose(): void {
    EntityPanel.panels.delete(this.panelKey);
    super.dispose();
  }

  private static title(displayName: string | undefined, logicalName: string, envName: string): string {
    return `${displayName || logicalName} (${envName})`;
  }
}
