import * as vscode from "vscode";
import { type IEnvironmentManager, type IAuthenticationService } from "../interfaces";
import { type SecretStorageService } from "../services/SecretStorageService";
import { Logger } from "core-dataverse";

export async function removeEnvironmentCommand(
  envManager: IEnvironmentManager,
  authSvc: IAuthenticationService,
  secretStorage: SecretStorageService,
  environmentId: string
): Promise<void> {
  const env = envManager.getAll().find((e) => e.id === environmentId);
  if (!env) { return; }

  const confirm = await vscode.window.showWarningMessage(
    `Remove environment "${env.name}"?`,
    { modal: true },
    "Remove"
  );
  if (confirm !== "Remove") { return; }

  await authSvc.clearTokens(env);

  // Delete stored client secret if this was a service principal environment.
  if (env.authMethod === "clientcredentials") {
    await secretStorage.deleteClientSecret(env.id);
  }

  await envManager.remove(environmentId);
  Logger.info("Environment removed", { name: env.name });
  vscode.window.showInformationMessage(`Environment "${env.name}" removed.`);
}
