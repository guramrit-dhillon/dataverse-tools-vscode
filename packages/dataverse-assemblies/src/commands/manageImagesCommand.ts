import { type DataverseAccountApi, type DataverseEnvironment, type SdkMessageProcessingStep } from "core-dataverse";
import type * as vscode from "vscode";
import { type IRegistrationService } from "../interfaces/IRegistrationService";
import { ImageConfigurationPanel } from "../webviews/ImageConfigurationPanel";

/**
 * Open the Images management panel for a step.
 */

export async function manageImagesCommand(
  api: DataverseAccountApi,
  registrationSvc: IRegistrationService,
  extensionUri: vscode.Uri,
  step: SdkMessageProcessingStep,
  env: DataverseEnvironment | undefined
): Promise<void> {
  if (!env || !step.sdkmessageprocessingstepid) { return; }

  ImageConfigurationPanel.render(extensionUri, step, env, registrationSvc);
}
