import { type DataverseAccountApi, type DataverseEnvironment, type SdkMessageProcessingStep, Logger } from "core-dataverse";
import * as vscode from "vscode";
import { type IRegistrationService } from "../interfaces/IRegistrationService";

/**
 * Toggle step enabled/disabled state (no Webview needed).
 */

export async function toggleStepStateCommand(
  api: DataverseAccountApi,
  registrationSvc: IRegistrationService,
  onRefresh: () => void,
  step: SdkMessageProcessingStep,
  enable: boolean,
  env: DataverseEnvironment | undefined
): Promise<void> {
  if (!env || !step.sdkmessageprocessingstepid) { return; }

  const stepId = step.sdkmessageprocessingstepid;
  const label = step.name;

  try {
    await registrationSvc.setStepState(env, stepId, enable);
    onRefresh();
    vscode.window.showInformationMessage(
      `Step "${label}" ${enable ? "enabled" : "disabled"}.`
    );
  } catch (err) {
    Logger.error("Failed to toggle step state", err);
    vscode.window.showErrorMessage(
      `Failed to ${enable ? "enable" : "disable"} step: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
