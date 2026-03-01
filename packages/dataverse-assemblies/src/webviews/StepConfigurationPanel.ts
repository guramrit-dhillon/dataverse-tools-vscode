import * as vscode from "vscode";
import {
  type SdkMessage,
  type SdkMessageProcessingStep,
  type SdkMessageProcessingStepImage,
  type DataverseEnvironment,
  Logger,
  Panel,
} from "core-dataverse";
import { type IRegistrationService } from "../interfaces/IRegistrationService";
export interface StepPanelOptions {
  mode: "create" | "edit";
  pluginTypeId: string;
  pluginTypeName: string;
  messages?: SdkMessage[];
  step: Partial<SdkMessageProcessingStep>;
  images?: SdkMessageProcessingStepImage[];
}

type SaveCallback = (step: SdkMessageProcessingStep) => Promise<void>;

/**
 * Singleton Webview panel for step configuration.
 *
 * Architecture:
 *  - HTML shell: thin host providing CSS (VS Code variables) + <div id="root">
 *  - React bundle: webview-dist/webview.js compiled by esbuild from webview-src/
 *  - Message protocol: bidirectional JSON over postMessage
 *
 * Extension → Webview:
 *   { type: "init", payload: StepPanelOptions }
 *   { type: "loadEntities:response", payload: string[] }
 *   { type: "loadMessages:response", payload: { entityCode, messages } }
 *   { type: "pickAttributes:response", payload: string | null }
 *
 * Webview → Extension:
 *   { type: "ready" }
 *   { type: "save", payload: SdkMessageProcessingStep }
 *   { type: "cancel" }
 *   { type: "loadEntities" }
 *   { type: "loadMessages", payload: entityCode }
 *   { type: "pickAttributes", payload: { entityCode, current } }
 */
export class StepConfigurationPanel extends Panel {
  private static readonly panels = new Map<string, StepConfigurationPanel>();

  private constructor(
    extensionUri: vscode.Uri,
    private readonly itemKey: string,
    private options: StepPanelOptions,
    private onSave: SaveCallback,
    private env: DataverseEnvironment,
    private registrationSvc: IRegistrationService
  ) {
    super(
      extensionUri,
      "dataverse-tools.stepConfig",
      panelTitle(options),
      options,
    );

    this.initListeners({
      save: this.handleSave.bind(this),
      cancel: () => this.dispose(),
      loadEntities: this.handleLoadEntities.bind(this),
      loadMessages: this.handleLoadMessages.bind(this),
      pickAttributes: this.handlePickAttributes.bind(this),
      saveImage: this.handleSaveImage.bind(this),
      deleteImage: this.handleDeleteImage.bind(this),
    });
  }

  static render(
    extensionUri: vscode.Uri,
    options: StepPanelOptions,
    onSave: SaveCallback,
    env: DataverseEnvironment,
    registrationSvc: IRegistrationService
  ): void {
    // Edit mode: key by step GUID so the same item reuses its tab.
    // Create mode: generate a unique key so each invocation gets its own tab.
    const key = options.step.sdkmessageprocessingstepid ?? generateKey();

    const existing = StepConfigurationPanel.panels.get(key);
    if (existing) {
      existing.options = options;
      existing.onSave = onSave;
      existing.env = env;
      existing.registrationSvc = registrationSvc;
      existing.activate(panelTitle(options), options);
      return;
    }

    const instance = new StepConfigurationPanel(
      extensionUri,
      key,
      options,
      onSave,
      env,
      registrationSvc
    );
    StepConfigurationPanel.panels.set(key, instance);
  }

  // ── Message handlers ─────────────────────────────────────────────────────────

  private async handleLoadEntities() {
    return this.registrationSvc.listEntityNames(this.env);
  }

  private async handleLoadMessages(entityCode: string) {
    const messages = await this.registrationSvc.listMessagesForEntity(this.env, entityCode);
    return { entityCode, messages };
  }

  private async handlePickAttributes(payload: { entityCode: string; current: string[] }) {
    const { entityCode, current } = payload;
    const currentSet = new Set(current);

    const attributes = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `Loading attributes for ${entityCode}…` },
      () => this.registrationSvc.listEntityAttributes(this.env, entityCode),
    );

    const items: vscode.QuickPickItem[] = attributes.map((attr) => ({
      label: attr,
      picked: currentSet.has(attr),
    }));

    const selected = await vscode.window.showQuickPick(items, {
      canPickMany: true,
      title: `Filtering Attributes — ${entityCode}`,
      placeHolder: "Select attributes that trigger this step (Update message)",
    });

    // User cancelled — return null so webview ignores
    if (!selected) { return null; }
    return selected.map((s) => s.label).join(", ");
  }

  private async handleSaveImage(image: SdkMessageProcessingStepImage) {
    const stepId = this.options.step.sdkmessageprocessingstepid;
    if (!stepId) {
      throw new Error("Step must be saved before adding images.");
    }
    try {
      const imageWithStep: SdkMessageProcessingStepImage = {
        ...image,
        sdkmessageprocessingstepid: { sdkmessageprocessingstepid: stepId },
      };
      const saved = await this.registrationSvc.upsertStepImage(this.env, imageWithStep);
      return saved;
    } catch (err) {
      Logger.error("Failed to save image", err);
      throw new Error(`Failed to save image: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async handleDeleteImage(imageId: string) {
    try {
      await this.registrationSvc.deleteStepImage(this.env, imageId);
      return imageId;
    } catch (err) {
      Logger.error("Failed to delete image", err);
      throw new Error(`Failed to delete image: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async handleSave(payload: SdkMessageProcessingStep): Promise<void> {
    try {
      await this.onSave(payload);
      this.dispose();
    } catch (err) {
      throw new Error(`Failed to save step: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  protected override dispose(): void {
    StepConfigurationPanel.panels.delete(this.itemKey);
    super.dispose();
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function panelTitle(options: StepPanelOptions): string {
  if (options.mode === "create") { return "Add Step"; }
  return `Edit Step — ${options.step.name ?? options.pluginTypeName}`;
}

function generateKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}
