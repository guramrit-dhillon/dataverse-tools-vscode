import * as vscode from "vscode";
import {
  type DataverseEnvironment,
} from "core-dataverse";
import type { SdkMessageProcessingStep } from "../types";
import { type IRegistrationService } from "../interfaces/IRegistrationService";
import { type StepConfigFileSystemProvider } from "../fs/StepConfigFileSystemProvider";

type ConfigType = "unsecure" | "secure" | "description";

/**
 * Open the step's unsecure or secure configuration in a virtual editor tab.
 * The tab uses the `dataverse-step-config:` URI scheme — Ctrl+S saves directly
 * to Dataverse via the FileSystemProvider's writeFile().
 */
export async function editStepConfigCommand(
  registrationSvc: IRegistrationService,
  step: SdkMessageProcessingStep,
  env: DataverseEnvironment | undefined,
  configType: ConfigType,
  fsProvider: StepConfigFileSystemProvider,
): Promise<void> {
  if (!env || !step.sdkmessageprocessingstepid) { return; }

  const uri = fsProvider.open(env, step, configType, registrationSvc);
  const label =
    configType === "secure" ? "Secure Config" :
    configType === "description" ? "Description" :
    "Unsecure Config";

  await vscode.window.showTextDocument(uri, { preview: false });

  vscode.window.showInformationMessage(
    `Editing ${label} for "${step.name}" — press Ctrl+S to save to Dataverse`,
  );
}
