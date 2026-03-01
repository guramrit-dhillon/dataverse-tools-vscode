import { type DataverseAccountApi, type DataverseEnvironment, type PluginType, Logger } from "core-dataverse";
import * as vscode from "vscode";
import { type IRegistrationService } from "../interfaces/IRegistrationService";
import { StepConfigurationPanel } from "../webviews/StepConfigurationPanel";
import { defaultStep } from "./utils";

/**
 * Launch the step configuration Webview for a new step.
 * Called from context menu on a PluginType node.
 */

export async function addStepCommand(
  api: DataverseAccountApi,
  registrationSvc: IRegistrationService,
  onRefresh: () => void,
  extensionUri: vscode.Uri,
  pluginType: PluginType,
  env: DataverseEnvironment | undefined
): Promise<void> {
  if (!env || !pluginType.plugintypeid) { return; }

  StepConfigurationPanel.render(
    extensionUri,
    {
      mode: "create",
      pluginTypeId: pluginType.plugintypeid,
      pluginTypeName: pluginType.typename,
      step: defaultStep(pluginType.plugintypeid),
    },
    async (step) => {
      try {
        await registrationSvc.upsertStep(env, step);
        onRefresh();
        vscode.window.showInformationMessage(`Step "${step.name}" created.`);
      } catch (err) {
        Logger.error("Failed to create step", err);
        vscode.window.showErrorMessage(
          `Failed to create step: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    },
    env,
    registrationSvc
  );
}
