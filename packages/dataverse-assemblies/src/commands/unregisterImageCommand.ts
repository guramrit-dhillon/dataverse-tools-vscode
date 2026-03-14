import { type DataverseAccountApi, type DataverseEnvironment, Logger } from "core-dataverse";
import type { SdkMessageProcessingStepImage } from "../types";
import * as vscode from "vscode";
import { type IRegistrationService } from "../interfaces/IRegistrationService";

export async function unregisterImageCommand(
  api: DataverseAccountApi,
  registrationSvc: IRegistrationService,
  onRefresh: () => void,
  image: SdkMessageProcessingStepImage,
  env: DataverseEnvironment | undefined,
): Promise<void> {
  if (!env || !image.sdkmessageprocessingstepimageid) { return; }

  const confirm = await vscode.window.showWarningMessage(
    `Unregister image "${image.name}"?`,
    { modal: true },
    "Unregister"
  );
  if (confirm !== "Unregister") { return; }

  try {
    await registrationSvc.deleteStepImage(env, image.sdkmessageprocessingstepimageid);
    onRefresh();
    vscode.window.showInformationMessage(`Image "${image.name}" unregistered.`);
  } catch (err) {
    Logger.error("Failed to unregister image", err);
    vscode.window.showErrorMessage(
      `Failed to unregister image: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
