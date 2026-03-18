import * as vscode from "vscode";
import {
  type DataverseAccountApi,
  type DataverseEnvironment,
  Logger,
  Panel,
} from "core-dataverse";
import type { AuditFilter } from "../types/dataverse";
import type { OrgAuditStatus, EntityAuditStatus } from "../types/dataverse";
import type { AuditService } from "../services/AuditService";

/** Options sent to the webview on init / re-activate. */
interface AuditInitPayload {
  envName: string;
  entityLogicalName?: string;
}

/**
 * Multi-instance Webview panel for Audit History, keyed by environment ID.
 *
 * Can be opened from the environment context menu or from an entity node
 * in the explorer tree. When opened from an entity, the entity logical name
 * is pre-filled.
 */
export class AuditPanel extends Panel {
  private static readonly panels = new Map<string, AuditPanel>();

  private envKey: string;

  private constructor(
    extensionUri: vscode.Uri,
    private env: DataverseEnvironment,
    private api: DataverseAccountApi,
    private auditSvc: AuditService,
    entityLogicalName?: string,
  ) {
    const initPayload: AuditInitPayload = { envName: env.name, entityLogicalName };
    const iconPath = {
      light: vscode.Uri.joinPath(extensionUri, "resources", "light", "audit.svg"),
      dark: vscode.Uri.joinPath(extensionUri, "resources", "dark", "audit.svg"),
    };
    super(
      extensionUri,
      "dataverse-tools.auditViewer",
      `Audit History (${env.name})`,
      initPayload,
      { iconPath },
    );
    this.envKey = env.id;

    this.initListeners({
      retrieve: this.handleRetrieve.bind(this),
      getDetails: this.handleGetDetails.bind(this),
      entitySearch: this.handleEntitySearch.bind(this),
      changeEnvironment: this.handleChangeEnvironment.bind(this),
      getOrgAuditStatus: this.handleGetOrgAuditStatus.bind(this),
      setOrgAuditStatus: this.handleSetOrgAuditStatus.bind(this),
      getEntityAuditStatus: this.handleGetEntityAuditStatus.bind(this),
      setEntityAuditStatus: this.handleSetEntityAuditStatus.bind(this),
    });
  }

  /** Open or focus the panel, optionally pre-filling the entity. */
  static render(
    extensionUri: vscode.Uri,
    env: DataverseEnvironment,
    api: DataverseAccountApi,
    auditSvc: AuditService,
    entityLogicalName?: string,
  ): void {
    const key = env.id;
    const existing = AuditPanel.panels.get(key);
    if (existing) {
      existing.env = env;
      existing.api = api;
      existing.auditSvc = auditSvc;
      const payload: AuditInitPayload = { envName: env.name, entityLogicalName };
      existing.activate(`Audit History (${env.name})`, payload);
      return;
    }
    const instance = new AuditPanel(extensionUri, env, api, auditSvc, entityLogicalName);
    AuditPanel.panels.set(key, instance);
  }

  /** Trigger environment change on the currently visible panel. */
  static async changeEnvironment(): Promise<void> {
    for (const panel of AuditPanel.panels.values()) {
      if (panel.visible) {
        const result = await panel.handleChangeEnvironment();
        if (result) {
          panel.postMessage({ type: "changeEnvironment:response", payload: result });
        }
        return;
      }
    }
  }

  // ── Message handlers ───────────────────────────────────────────────────────

  private async handleRetrieve(filter: AuditFilter) {
    try {
      return await this.auditSvc.getRecordAuditHistory(this.env, filter);
    } catch (err) {
      Logger.error("Failed to retrieve audit history", err);
      throw new Error(err instanceof Error ? err.message : String(err));
    }
  }

  private async handleGetDetails(payload: { auditId: string }) {
    try {
      return await this.auditSvc.getAuditDetails(this.env, payload.auditId);
    } catch (err) {
      Logger.warn("Failed to retrieve audit details", err instanceof Error ? { message: err.message } : {});
      throw new Error(err instanceof Error ? err.message : String(err));
    }
  }

  private async handleEntitySearch() {
    try {
      return await this.auditSvc.listAuditableEntities(this.env);
    } catch (err) {
      Logger.warn("Failed to load auditable entities", err instanceof Error ? { message: err.message } : {});
      throw new Error(err instanceof Error ? err.message : String(err));
    }
  }

  private async handleGetOrgAuditStatus(): Promise<OrgAuditStatus> {
    try {
      return await this.auditSvc.getOrgAuditStatus(this.env);
    } catch (err) {
      Logger.warn("Failed to get org audit status", err instanceof Error ? { message: err.message } : {});
      throw new Error(err instanceof Error ? err.message : String(err));
    }
  }

  private async handleSetOrgAuditStatus(payload: { orgId: string; isEnabled: boolean }): Promise<{ isEnabled: boolean }> {
    try {
      await this.auditSvc.setOrgAuditStatus(this.env, payload.orgId, payload.isEnabled);
      return { isEnabled: payload.isEnabled };
    } catch (err) {
      Logger.error("Failed to set org audit status", err);
      throw new Error(err instanceof Error ? err.message : String(err));
    }
  }

  private async handleGetEntityAuditStatus(payload: { entityLogicalName: string }): Promise<EntityAuditStatus> {
    try {
      return await this.auditSvc.getEntityAuditStatus(this.env, payload.entityLogicalName);
    } catch (err) {
      Logger.warn("Failed to get entity audit status", err instanceof Error ? { message: err.message } : {});
      throw new Error(err instanceof Error ? err.message : String(err));
    }
  }

  private async handleSetEntityAuditStatus(payload: { metadataId: string; entityLogicalName: string; isEnabled: boolean }): Promise<{ isEnabled: boolean }> {
    try {
      await this.auditSvc.setEntityAuditStatus(this.env, payload.metadataId, payload.entityLogicalName, payload.isEnabled);
      return { isEnabled: payload.isEnabled };
    } catch (err) {
      Logger.error("Failed to set entity audit status", err);
      throw new Error(err instanceof Error ? err.message : String(err));
    }
  }

  private async handleChangeEnvironment() {
    const result = await this.api.pickEnvironment({ activeEnvironmentId: this.env.id });
    if (!result) { return; }

    const newEnv = result.environment;
    const newKey = newEnv.id;

    // If a panel already exists for the target environment, reveal it instead
    if (newKey !== this.envKey && AuditPanel.panels.has(newKey)) {
      const existing = AuditPanel.panels.get(newKey)!;
      existing.activate(`Audit History (${newEnv.name})`, { envName: newEnv.name });
      return;
    }

    // Re-key in the map
    AuditPanel.panels.delete(this.envKey);
    this.envKey = newKey;
    this.env = newEnv;
    AuditPanel.panels.set(newKey, this);

    this.setTitle(`Audit History (${newEnv.name})`);

    return { envName: newEnv.name };
  }

  protected override dispose(): void {
    AuditPanel.panels.delete(this.envKey);
    super.dispose();
  }
}
