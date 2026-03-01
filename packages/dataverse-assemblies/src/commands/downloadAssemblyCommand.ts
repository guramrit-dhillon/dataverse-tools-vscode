import * as fs from "fs/promises";
import { type DataverseAccountApi, type DataverseEnvironment, type PluginAssembly, Logger } from "core-dataverse";
import * as vscode from "vscode";
import { type IRegistrationService } from "../interfaces/IRegistrationService";

/**
 * Download a plugin assembly DLL from Dataverse to the local filesystem.
 */

export async function downloadAssemblyCommand(
  api: DataverseAccountApi,
  registrationSvc: IRegistrationService,
  assembly: PluginAssembly,
  env: DataverseEnvironment | undefined
): Promise<void> {
  if (!env || !assembly.pluginassemblyid) { return; }

  const assemblyId = assembly.pluginassemblyid;
  const assemblyName = assembly.name;

  const saveUri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(`${assemblyName}.dll`),
    filters: { "Plugin Assembly": ["dll"] },
    title: `Download ${assemblyName}`,
  });
  if (!saveUri) { return; }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Downloading ${assemblyName}…`,
      cancellable: false,
    },
    async () => {
      try {
        const fetched = await registrationSvc.getAssembly(env, assemblyId);

        if (!fetched.content) {
          vscode.window.showErrorMessage(
            `Assembly "${assemblyName}" has no stored content. ` +
            "Only Database-sourced assemblies can be downloaded."
          );
          return;
        }

        const buffer = Buffer.from(fetched.content, "base64");
        await fs.writeFile(saveUri.fsPath, buffer);

        Logger.info("Assembly downloaded", { name: assemblyName, path: saveUri.fsPath });
        vscode.window.showInformationMessage(
          `Assembly "${assemblyName}" downloaded successfully.`,
          "Open Folder"
        ).then((choice) => {
          if (choice === "Open Folder") {
            vscode.commands.executeCommand(
              "revealFileInOS",
              vscode.Uri.file(saveUri.fsPath)
            );
          }
        });
      } catch (err) {
        Logger.error("Download failed", err);
        vscode.window.showErrorMessage(
          `Download failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  );
}
