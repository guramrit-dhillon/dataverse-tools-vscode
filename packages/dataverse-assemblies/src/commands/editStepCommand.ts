import { type DataverseAccountApi, type DataverseEnvironment, type SdkMessageProcessingStep, Logger } from "core-dataverse";
import * as vscode from "vscode";
import { type IRegistrationService } from "../interfaces/IRegistrationService";
import { StepConfigurationPanel } from "../webviews/StepConfigurationPanel";
import { withProgress } from "./utils";

/**
 * Open the Webview pre-filled with an existing step for editing.
 */

export async function editStepCommand(
  api: DataverseAccountApi,
  registrationSvc: IRegistrationService,
  onRefresh: () => void,
  extensionUri: vscode.Uri,
  step: SdkMessageProcessingStep,
  env: DataverseEnvironment | undefined
): Promise<void> {
  if (!env || !step.sdkmessageprocessingstepid) { return; }

  const stepId = step.sdkmessageprocessingstepid;
  const images = await withProgress("Loading step images…", () =>
    registrationSvc.listStepImages(env, stepId)
  );

  StepConfigurationPanel.render(
    extensionUri,
    {
      mode: "edit",
      pluginTypeId: step.eventhandler_plugintype?.plugintypeid ?? "",
      pluginTypeName: step.eventhandler_plugintype?.name ?? "",
      step,
      images,
    },
    async (updatedStep) => {
      try {
        await registrationSvc.upsertStep(env, updatedStep);
        onRefresh();
        vscode.window.showInformationMessage(`Step "${updatedStep.name}" updated.`);
      } catch (err) {
        Logger.error("Failed to update step", err);
        vscode.window.showErrorMessage(
          `Failed to update step: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    },
    env,
    registrationSvc
  );
}
