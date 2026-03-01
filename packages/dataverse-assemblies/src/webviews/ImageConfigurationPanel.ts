import type * as vscode from "vscode";
import {
  type SdkMessageProcessingStep,
  type SdkMessageProcessingStepImage,
  type DataverseEnvironment,
  Logger,
  Panel,
} from "core-dataverse";
import { type IRegistrationService } from "../interfaces/IRegistrationService";
/**
 * Singleton Webview panel for managing step images (Pre/Post images).
 *
 * Opened via the "Manage Images" context menu on a step node.
 * Loads existing images from the API on open, then allows inline
 * add, edit, and delete without leaving the panel.
 */
export class ImageConfigurationPanel extends Panel {
  private static readonly panels = new Map<string, ImageConfigurationPanel>();

  private constructor(
    extensionUri: vscode.Uri,
    private readonly itemKey: string,
    private step: SdkMessageProcessingStep,
    private env: DataverseEnvironment,
    private registrationSvc: IRegistrationService
  ) {
    super(
      extensionUri,
      "dataverse-tools.imageConfig",
      `Images — ${step.name}`,
      { step: { sdkmessageprocessingstepid: step.sdkmessageprocessingstepid, name: step.name } },
    );

    this.initListeners({
      loadImages: () => this.handleLoadImages(),
      save: (payload: SdkMessageProcessingStepImage) => this.handleSave(payload),
      delete: (imageId: string) => this.handleDelete(imageId),
    });
  }

  static render(
    extensionUri: vscode.Uri,
    step: SdkMessageProcessingStep,
    env: DataverseEnvironment,
    registrationSvc: IRegistrationService
  ): void {
    const key = step.sdkmessageprocessingstepid!;

    const existing = ImageConfigurationPanel.panels.get(key);
    if (existing) {
      existing.step = step;
      existing.env = env;
      existing.registrationSvc = registrationSvc;
      existing.activate(
        `Images — ${step.name}`,
        { step: { sdkmessageprocessingstepid: step.sdkmessageprocessingstepid, name: step.name } }
      );
      return;
    }

    const instance = new ImageConfigurationPanel(extensionUri, key, step, env, registrationSvc);
    ImageConfigurationPanel.panels.set(key, instance);
  }

  // ── Message handlers ───────────────────────────────────────────────────────

  private async handleLoadImages(): Promise<SdkMessageProcessingStepImage[]> {
    const stepId = this.step.sdkmessageprocessingstepid!;
    try {
      return await this.registrationSvc.listStepImages(this.env, stepId);
    } catch (err) {
      Logger.error("Failed to load images", err);
      throw new Error(`Failed to load images: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async handleSave(image: SdkMessageProcessingStepImage): Promise<SdkMessageProcessingStepImage> {
    const stepId = this.step.sdkmessageprocessingstepid!;
    try {
      const imageWithStep: SdkMessageProcessingStepImage = {
        ...image,
        sdkmessageprocessingstepid: { sdkmessageprocessingstepid: stepId },
      };
      return await this.registrationSvc.upsertStepImage(this.env, imageWithStep);
    } catch (err) {
      Logger.error("Failed to save image", err);
      throw new Error(`Failed to save image: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async handleDelete(imageId: string): Promise<string> {
    try {
      await this.registrationSvc.deleteStepImage(this.env, imageId);
      return imageId;
    } catch (err) {
      Logger.error("Failed to delete image", err);
      throw new Error(`Failed to delete image: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  protected override dispose(): void {
    ImageConfigurationPanel.panels.delete(this.itemKey);
    super.dispose();
  }
}
