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
import { resolveItem } from "./utils";

/**
 * Rename a registration node (assembly, plugin type, or step) in-place.
 *
 * - Assembly:    updates the `name` field on pluginassembly
 * - Plugin type: updates the `friendlyname` field on plugintype
 *                (typename is the .NET class name and cannot change here)
 * - Step:        updates the `name` field on sdkmessageprocessingstep
 */

export async function renameNodeCommand(
  api: DataverseAccountApi,
  registrationSvc: IRegistrationService,
  onRefresh: () => void,
  node: ExplorerNode,
  env: DataverseEnvironment | undefined
): Promise<void> {
  if (!env) { return; }

  const { currentName, prompt } = resolveItem(node);
  if (!currentName) { return; }

  const newName = await vscode.window.showInputBox({
    title: prompt,
    value: currentName,
    valueSelection: [0, currentName.length],
    validateInput: (v) => v.trim() ? undefined : "Name cannot be empty.",
  });

  if (!newName || newName.trim() === currentName) { return; }
  const trimmed = newName.trim();

  const assembly = node.data?.assembly as PluginAssembly | undefined;
  const pluginType = node.data?.pluginType as PluginType | undefined;
  const step = node.data?.step as SdkMessageProcessingStep | undefined;

  try {
    if (node.contextValue === "assembly" && assembly?.pluginassemblyid) {
      await registrationSvc.renameAssembly(env, assembly.pluginassemblyid, trimmed);
    } else if ((node.contextValue === "pluginType" || node.contextValue === "activityType") && pluginType?.plugintypeid) {
      await registrationSvc.renamePluginType(env, pluginType.plugintypeid, trimmed);
    } else if (node.contextValue.startsWith("step.") && step?.sdkmessageprocessingstepid) {
      await registrationSvc.renameStep(env, step.sdkmessageprocessingstepid, trimmed);
    }

    onRefresh();
    vscode.window.showInformationMessage(`Renamed to "${trimmed}".`);
  } catch (err) {
    Logger.error("Rename failed", err);
    vscode.window.showErrorMessage(
      `Rename failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
