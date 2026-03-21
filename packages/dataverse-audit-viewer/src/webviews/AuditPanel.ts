import * as vscode from "vscode";
import {
  type DataverseAccountApi,
  type DataverseEnvironment,
  type WizardPage,
  type QuickPickWizardItem,
  runWizard,
  Logger,
  Panel,
} from "core-dataverse";
import type { AuditFilter, OrgAuditStatus, EntityAuditStatus, EntityWithAuditStatus, AttributeWithAuditStatus } from "../types/dataverse";
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
      setUserAccessAuditStatus: this.handleSetUserAccessAuditStatus.bind(this),
      getEntityAuditStatus: this.handleGetEntityAuditStatus.bind(this),
      setEntityAuditStatus: this.handleSetEntityAuditStatus.bind(this),
      manageEntityAuditing: this.handleManageEntityAuditing.bind(this),
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
    const env = this.env;           // snapshot — prevents mid-flight env swap
    const auditSvc = this.auditSvc;
    try {
      return await auditSvc.getRecordAuditHistory(env, filter);
    } catch (err) {
      Logger.error("Failed to retrieve audit history", err);
      throw new Error(err instanceof Error ? err.message : String(err));
    }
  }

  private async handleGetDetails(payload: { auditId: string }) {
    const env = this.env;           // snapshot — prevents mid-flight env swap
    const auditSvc = this.auditSvc;
    try {
      return await auditSvc.getAuditDetails(env, payload.auditId);
    } catch (err) {
      Logger.warn("Failed to retrieve audit details", err instanceof Error ? { message: err.message } : {});
      throw new Error(err instanceof Error ? err.message : String(err));
    }
  }

  private async handleEntitySearch() {
    const env = this.env;           // snapshot — prevents mid-flight env swap
    const auditSvc = this.auditSvc;
    try {
      return await auditSvc.listAuditableEntities(env);
    } catch (err) {
      Logger.warn("Failed to load auditable entities", err instanceof Error ? { message: err.message } : {});
      throw new Error(err instanceof Error ? err.message : String(err));
    }
  }

  private async handleGetOrgAuditStatus(): Promise<OrgAuditStatus> {
    const env = this.env;           // snapshot — prevents mid-flight env swap
    const auditSvc = this.auditSvc;
    try {
      return await auditSvc.getOrgAuditStatus(env);
    } catch (err) {
      Logger.warn("Failed to get org audit status", err instanceof Error ? { message: err.message } : {});
      throw new Error(err instanceof Error ? err.message : String(err));
    }
  }

  private async handleSetOrgAuditStatus(payload: { orgId: string; isEnabled: boolean }): Promise<{ isEnabled: boolean }> {
    const env = this.env;           // snapshot — prevents mid-flight env swap
    const auditSvc = this.auditSvc;
    try {
      await auditSvc.setOrgAuditStatus(env, payload.orgId, payload.isEnabled);
      return { isEnabled: payload.isEnabled };
    } catch (err) {
      Logger.error("Failed to set org audit status", err);
      throw new Error(err instanceof Error ? err.message : String(err));
    }
  }

  private async handleSetUserAccessAuditStatus(payload: { orgId: string; isEnabled: boolean }): Promise<{ isEnabled: boolean }> {
    const env = this.env;           // snapshot — prevents mid-flight env swap
    const auditSvc = this.auditSvc;
    try {
      await auditSvc.setUserAccessAuditStatus(env, payload.orgId, payload.isEnabled);
      return { isEnabled: payload.isEnabled };
    } catch (err) {
      Logger.error("Failed to set user access audit status", err);
      throw new Error(err instanceof Error ? err.message : String(err));
    }
  }

  private async handleGetEntityAuditStatus(payload: { entityLogicalName: string }): Promise<EntityAuditStatus> {
    const env = this.env;           // snapshot — prevents mid-flight env swap
    const auditSvc = this.auditSvc;
    try {
      return await auditSvc.getEntityAuditStatus(env, payload.entityLogicalName);
    } catch (err) {
      Logger.warn("Failed to get entity audit status", err instanceof Error ? { message: err.message } : {});
      throw new Error(err instanceof Error ? err.message : String(err));
    }
  }

  private async handleSetEntityAuditStatus(payload: { metadataId: string; entityLogicalName: string; isEnabled: boolean }): Promise<{ isEnabled: boolean }> {
    const env = this.env;           // snapshot — prevents mid-flight env swap
    const auditSvc = this.auditSvc;
    try {
      await auditSvc.setEntityAuditStatus(env, payload.metadataId, payload.entityLogicalName, payload.isEnabled);
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

  private async handleManageEntityAuditing(): Promise<{ enabled: number; disabled: number } | null> {
    const env = this.env;           // snapshot — prevents mid-flight env swap
    const auditSvc = this.auditSvc;
    const entities = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "Loading entities…", cancellable: false },
      () => auditSvc.listAllEntitiesWithAuditStatus(env),
    );

    // Attribute cache scoped to this wizard session (keyed by entity logical name)
    const attrCache = new Map<string, AttributeWithAuditStatus[]>();

    const initiallyEnabledSet = new Set(
      entities.filter((e) => e.isAuditEnabled).map((e) => e.logicalName),
    );

    interface ManageAuditState {
      entities: EntityWithAuditStatus[];
      /** Entity selected for column drilling. */
      selectedEntityForColumns: EntityWithAuditStatus | null;
      /** Saved entity-page checkbox selections — preserved when drilling into columns. */
      entityPageSelections: string[] | null;
      /** Column changes accumulated per entity (not yet saved). Applied on entity-page confirm. */
      pendingColumnChanges: Record<string, Array<{ attribute: AttributeWithAuditStatus; isEnabled: boolean }>>;
      entityEnabled: number;
      entityDisabled: number;
    }

    const columnsButton = { iconPath: "list-flat", tooltip: "Manage column auditing" };

    const pages: WizardPage<ManageAuditState>[] = [
      {
        id: "entityPage",
        type: "quickpick",
        title: "Manage Entity Auditing",
        render: (state): import("core-dataverse").QuickPickConfig => {
          const enabledEntities = state.entities.filter((e) => e.isAuditEnabled);
          const disabledEntities = state.entities.filter((e) => !e.isAuditEnabled);

          const makeEntityItem = (e: EntityWithAuditStatus): QuickPickWizardItem => {
            const pending = state.pendingColumnChanges[e.logicalName];
            return {
              label: e.displayName,
              description: pending?.length
                ? `${e.logicalName} · ${pending.length} column change(s) pending`
                : e.logicalName,
              action: e.logicalName,
              data: e,
              buttons: [columnsButton],
            };
          };

          const items: QuickPickWizardItem[] = [
            { label: "Auditing Enabled", action: "__sep_enabled", kind: -1 },
            ...enabledEntities.map(makeEntityItem),
            { label: "Auditing Disabled", action: "__sep_disabled", kind: -1 },
            ...disabledEntities.map(makeEntityItem),
          ];

          // Restore selections saved before drilling, otherwise default to currently enabled
          const selectedActions = state.entityPageSelections
            ?? entities.filter((e) => e.isAuditEnabled).map((e) => e.logicalName);

          return {
            placeholder: "Check to enable/disable · $(list-flat) to manage columns · Enter to save all",
            canPickMany: true,
            selectedActions,
            items,
          };
        },
        onSelect: () => ({ next: undefined }),
        onItemButton: (_btn, _idx, _action, item, state, currentSelectedItems) => ({
          next: "columnPage",
          update: {
            selectedEntityForColumns: item.data as EntityWithAuditStatus,
            // Save the user's current checkbox state so it survives the round-trip
            entityPageSelections: currentSelectedItems
              .filter((i) => i.action !== "__sep_enabled" && i.action !== "__sep_disabled")
              .map((i) => i.action),
          },
        }),
        onMultiSelect: async (selectedItems, state, ui) => {
          const selectedLogicalNames = new Set(
            selectedItems
              .filter((i) => i.action !== "__sep_enabled" && i.action !== "__sep_disabled")
              .map((i) => i.action),
          );

          const toEnable = state.entities.filter(
            (e) => !initiallyEnabledSet.has(e.logicalName) && selectedLogicalNames.has(e.logicalName),
          );
          const toDisable = state.entities.filter(
            (e) => initiallyEnabledSet.has(e.logicalName) && !selectedLogicalNames.has(e.logicalName),
          );
          const columnChangeEntries = Object.entries(state.pendingColumnChanges).filter(([, c]) => c.length > 0);

          if (toEnable.length === 0 && toDisable.length === 0 && columnChangeEntries.length === 0) {
            return { next: undefined };
          }

          ui.setBusy("Saving changes…");

          const errors: string[] = [];

          for (const e of toEnable) {
            try {
              await auditSvc.setEntityAuditStatus(env, e.metadataId, e.logicalName, true);
            } catch (err) {
              errors.push(`Enable ${e.displayName}: ${err instanceof Error ? err.message : String(err)}`);
            }
          }
          for (const e of toDisable) {
            try {
              await auditSvc.setEntityAuditStatus(env, e.metadataId, e.logicalName, false);
            } catch (err) {
              errors.push(`Disable ${e.displayName}: ${err instanceof Error ? err.message : String(err)}`);
            }
          }
          for (const [entityLogicalName, changes] of columnChangeEntries) {
            const entity = state.entities.find((e) => e.logicalName === entityLogicalName);
            if (!entity) { continue; }
            const { errors: colErrors } = await auditSvc.setAttributesAuditStatus(
              env, entity.metadataId, entityLogicalName, changes,
            );
            errors.push(...colErrors.map((e) => `Columns (${entityLogicalName}): ${e}`));
          }

          if (errors.length > 0) {
            vscode.window.showErrorMessage(`Some changes failed:\n${errors.join("\n")}`);
          } else {
            const entityCount = toEnable.length + toDisable.length;
            const colBatches = columnChangeEntries.length;
            const parts: string[] = [];
            if (entityCount > 0) { parts.push(`${entityCount} entity change(s)`); }
            if (colBatches > 0) { parts.push(`column changes for ${colBatches} entity/entities`); }
            vscode.window.showInformationMessage(`Auditing updated: ${parts.join(", ")}.`);
          }

          return {
            next: undefined,
            update: { entityEnabled: toEnable.length, entityDisabled: toDisable.length },
          };
        },
      },
      {
        id: "columnPage",
        type: "quickpick",
        title: "Column Auditing",
        ephemeral: true,
        loading: { placeholder: "Loading columns…" },
        render: async (state): Promise<import("core-dataverse").QuickPickConfig> => {
          const entity = state.selectedEntityForColumns!;

          let attributes = attrCache.get(entity.logicalName);
          if (!attributes) {
            attributes = await auditSvc.listAttributesWithAuditStatus(env, entity.logicalName);
            attrCache.set(entity.logicalName, attributes);
          }

          const enabledAttrs = attributes.filter((a) => a.isAuditEnabled);
          const disabledAttrs = attributes.filter((a) => !a.isAuditEnabled);

          // Reflect previously saved pending selections for this entity
          const pending = state.pendingColumnChanges[entity.logicalName] ?? [];
          const pendingMap = new Map(pending.map((c) => [c.attribute.logicalName, c.isEnabled]));

          const makeAttrItem = (a: AttributeWithAuditStatus, defaultEnabled: boolean): QuickPickWizardItem => ({
            label: a.displayName,
            description: `${a.logicalName} · ${a.attributeType}`,
            action: a.logicalName,
            data: a,
          });

          const items: QuickPickWizardItem[] = [
            { label: "Auditing Enabled", action: "__sep_enabled", kind: -1 },
            ...enabledAttrs.map((a) => makeAttrItem(a, true)),
            { label: "Auditing Disabled", action: "__sep_disabled", kind: -1 },
            ...disabledAttrs.map((a) => makeAttrItem(a, false)),
          ];

          // Build selectedActions: start from currently-enabled, apply pending overrides
          const selectedSet = new Set(enabledAttrs.map((a) => a.logicalName));
          for (const [logicalName, isEnabled] of pendingMap) {
            if (isEnabled) { selectedSet.add(logicalName); } else { selectedSet.delete(logicalName); }
          }

          return {
            placeholder: `${entity.displayName} — check to enable, uncheck to disable · Enter to stage · Esc to go back`,
            canPickMany: true,
            selectedActions: [...selectedSet],
            items,
          };
        },
        onSelect: () => ({ next: "entityPage" }),
        onMultiSelect: (selectedItems, state) => {
          const entity = state.selectedEntityForColumns!;
          const attributes = attrCache.get(entity.logicalName) ?? [];
          const originallyEnabledSet = new Set(attributes.filter((a) => a.isAuditEnabled).map((a) => a.logicalName));
          const selectedLogicalNames = new Set(
            selectedItems
              .filter((i) => i.action !== "__sep_enabled" && i.action !== "__sep_disabled")
              .map((i) => i.action),
          );

          const changes = attributes
            .filter((a) => selectedLogicalNames.has(a.logicalName) !== originallyEnabledSet.has(a.logicalName))
            .map((a) => ({ attribute: a, isEnabled: selectedLogicalNames.has(a.logicalName) }));

          return {
            next: "entityPage",
            pop: true,
            update: {
              entityPageSelections: null, // clear saved selections — entity page will re-default on next render
              pendingColumnChanges: {
                ...state.pendingColumnChanges,
                [entity.logicalName]: changes,
              },
            },
          };
        },
      },
    ];

    const result = await runWizard<ManageAuditState>({
      title: `Manage Auditing — ${env.name}`,
      pages,
      startPage: "entityPage",
      initialState: {
        entities,
        selectedEntityForColumns: null,
        entityPageSelections: null,
        pendingColumnChanges: {},
        entityEnabled: 0,
        entityDisabled: 0,
      },
    });

    return result ? { enabled: result.entityEnabled, disabled: result.entityDisabled } : null;
  }

  protected override dispose(): void {
    AuditPanel.panels.delete(this.envKey);
    super.dispose();
  }
}
