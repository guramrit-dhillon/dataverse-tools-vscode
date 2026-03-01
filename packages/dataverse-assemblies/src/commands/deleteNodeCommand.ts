import {
  type DataverseAccountApi,
  type DataverseEnvironment,
  type ExplorerNode,
  type PluginAssembly,
  type PluginType,
  type SdkMessageProcessingStep,
  Logger,
} from "core-dataverse";
import * as vscode from "vscode";
import { type IRegistrationService } from "../interfaces/IRegistrationService";

/**
 * Delete a registration node (assembly, type, or step) with confirmation.
 */

export async function deleteNodeCommand(
  api: DataverseAccountApi,
  registrationSvc: IRegistrationService,
  onRefresh: () => void,
  node: ExplorerNode,
  env: DataverseEnvironment | undefined
): Promise<void> {
  if (!env) { return; }

  const assembly = node.data?.assembly as PluginAssembly | undefined;
  const pluginType = node.data?.pluginType as PluginType | undefined;
  const step = node.data?.step as SdkMessageProcessingStep | undefined;

  const entityLabel = assembly?.name ??
    pluginType?.typename ??
    step?.name ??
    "this item";

  const confirm = await vscode.window.showWarningMessage(
    `Delete "${entityLabel}"? This cannot be undone.`,
    { modal: true },
    "Delete"
  );
  if (confirm !== "Delete") { return; }

  try {
    if (node.contextValue === "assembly" && assembly?.pluginassemblyid) {
      await registrationSvc.deleteAssembly(env, assembly.pluginassemblyid);
    } else if ((node.contextValue === "pluginType" || node.contextValue === "activityType") && pluginType?.plugintypeid) {
      await registrationSvc.deletePluginType(env, pluginType.plugintypeid);
    } else if (node.contextValue.startsWith("step.") && step?.sdkmessageprocessingstepid) {
      await registrationSvc.deleteStep(env, step.sdkmessageprocessingstepid);
    }

    onRefresh();
    vscode.window.showInformationMessage(`"${entityLabel}" deleted.`);
  } catch (err) {
    Logger.error("Delete failed", err);
    vscode.window.showErrorMessage(
      `Delete failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
