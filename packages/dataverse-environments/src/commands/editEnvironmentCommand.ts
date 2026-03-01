import * as vscode from "vscode";
import { type IEnvironmentManager, type IAuthenticationService } from "../interfaces";
import { type SecretStorageService } from "../services/SecretStorageService";
import { type AuthMethod, type DataverseEnvironment, Logger } from "core-dataverse";
import { testEnvConnection } from "./testConnectionCommand";

type MethodItem = vscode.QuickPickItem & { _method: AuthMethod };

/**
 * Lets the user change the auth method (and associated credentials) for an
 * existing environment without removing and re-adding it.
 *
 * Flow:
 *  1. Pick new auth method
 *  2. Collect any additional credentials (custom client ID / SP details)
 *  3. Confirm the change
 *  4. Clear old tokens + secret
 *  5. Store new secret (if clientcredentials)
 *  6. Save updated environment
 *  7. Optional connection test
 */
export async function editEnvironmentCommand(
  envManager: IEnvironmentManager,
  authSvc: IAuthenticationService,
  secretStorage: SecretStorageService,
  environmentId: string
): Promise<void> {
  const env = envManager.getAll().find((e) => e.id === environmentId);
  if (!env) { return; }

  // ── Step 1: pick new auth method ─────────────────────────────────────────

  const methodItems: MethodItem[] = [
    {
      label: "$(person) Sign in with Microsoft",
      description: "VS Code browser authentication",
      detail: "Uses the Microsoft account signed in to VS Code",
      _method: "vscode",
    },
    {
      label: "$(terminal) Azure CLI",
      description: "Use your existing `az login` account",
      detail: "Requires Azure CLI to be installed and signed in (`az login`)",
      _method: "azcli",
    },
    {
      label: "$(plug) Service Principal",
      description: "Client ID + secret (app registration)",
      detail: "For environments that require app-based access rather than a personal account",
      _method: "clientcredentials",
    },
    {
      label: "$(device-mobile) Device Code",
      description: "Enter a code in a browser",
      detail: "Works in headless / remote / SSH environments",
      _method: "devicecode",
    },
  ];

  const currentLabel = methodItems.find((m) => m._method === env.authMethod)?.label ?? env.authMethod;

  const methodPick = await vscode.window.showQuickPick(methodItems, {
    title: `Edit "${env.name}" — Choose Auth Method`,
    placeHolder: `Current: ${currentLabel}`,
    ignoreFocusOut: true,
  }) as MethodItem | undefined;
  if (!methodPick) { return; }

  const newMethod = methodPick._method;

  // ── Step 2: collect credentials based on new method ──────────────────────

  let newClientId: string | undefined = env.clientId;
  let newTenantId: string | undefined = env.tenantId;
  let newAccountId: string | undefined = undefined;
  let newClientSecret: string | undefined = undefined;

  if (newMethod === "clientcredentials") {
    const tenantId = await vscode.window.showInputBox({
      title: `Edit "${env.name}" — Service Principal: Tenant ID`,
      prompt: "Azure AD Tenant ID (Directory ID)",
      value: env.tenantId ?? "",
      placeHolder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      ignoreFocusOut: true,
      validateInput: (v) => isGuid(v.trim()) ? undefined : "Enter a valid GUID",
    });
    if (!tenantId) { return; }

    const clientId = await vscode.window.showInputBox({
      title: `Edit "${env.name}" — Service Principal: Client ID`,
      prompt: "Application (Client) ID",
      value: env.clientId ?? "",
      placeHolder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      ignoreFocusOut: true,
      validateInput: (v) => isGuid(v.trim()) ? undefined : "Enter a valid GUID",
    });
    if (!clientId) { return; }

    const clientSecret = await vscode.window.showInputBox({
      title: `Edit "${env.name}" — Service Principal: Client Secret`,
      prompt: "Client secret value (stored encrypted in OS keychain)",
      password: true,
      ignoreFocusOut: true,
      validateInput: (v) => v.trim() ? undefined : "Client secret is required",
    });
    if (!clientSecret) { return; }

    newTenantId = tenantId.trim();
    newClientId = clientId.trim();
    newClientSecret = clientSecret.trim();

  } else if (newMethod === "devicecode") {
    const useCustom = await vscode.window.showQuickPick(
      [
        { label: "$(circle-slash) Use default app registration", description: "Azure CLI public client", _custom: false },
        { label: "$(key) Enter custom client ID…", description: "Your own Azure AD app registration", _custom: true },
      ],
      {
        title: `Edit "${env.name}" — Device Code: App Registration`,
        ignoreFocusOut: true,
      }
    ) as (vscode.QuickPickItem & { _custom: boolean }) | undefined;
    if (!useCustom) { return; }

    if (useCustom._custom) {
      const clientId = await vscode.window.showInputBox({
        title: `Edit "${env.name}" — Custom Client ID`,
        prompt: "Application (Client) ID",
        value: env.clientId ?? "",
        placeHolder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        ignoreFocusOut: true,
        validateInput: (v) => isGuid(v.trim()) ? undefined : "Enter a valid GUID",
      });
      if (!clientId) { return; }

      const tenantId = await vscode.window.showInputBox({
        title: `Edit "${env.name}" — Tenant ID (optional)`,
        prompt: "Leave blank to use the default multi-tenant endpoint",
        value: env.tenantId ?? "",
        placeHolder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (optional)",
        ignoreFocusOut: true,
        validateInput: (v) => (!v.trim() || isGuid(v.trim())) ? undefined : "Enter a valid GUID or leave blank",
      });
      if (tenantId === undefined) { return; }

      newClientId = clientId.trim();
      newTenantId = tenantId.trim() || undefined;
    } else {
      newClientId = undefined;
      newTenantId = undefined;
    }
  } else if (newMethod === "vscode") {
    // VS Code auth: clear clientId/tenantId overrides (VS Code manages the account)
    newClientId = undefined;
    newTenantId = env.tenantId; // keep tenantId if it was set (might be relevant for scoping)
    newAccountId = undefined;    // will be re-bound on next token acquisition
  } else {
    // azcli: no additional credentials
    newClientId = undefined;
    newTenantId = undefined;
  }

  // ── Step 3: confirm ───────────────────────────────────────────────────────

  const confirm = await vscode.window.showWarningMessage(
    `Change auth method for "${env.name}" to ${methodPick.description ?? newMethod}? Existing tokens will be cleared.`,
    { modal: true },
    "Change"
  );
  if (confirm !== "Change") { return; }

  // ── Step 4: clear old tokens + secret ─────────────────────────────────────

  await authSvc.clearTokens(env);
  if (env.authMethod === "clientcredentials") {
    await secretStorage.deleteClientSecret(env.id);
  }

  // ── Step 5: store new secret ──────────────────────────────────────────────

  if (newMethod === "clientcredentials" && newClientSecret) {
    await secretStorage.storeClientSecret(env.id, newClientSecret);
  }

  // ── Step 6: save updated environment ─────────────────────────────────────

  const updated: DataverseEnvironment = {
    ...env,
    authMethod: newMethod,
    clientId: newClientId,
    tenantId: newTenantId,
    accountId: newAccountId,
  };
  await envManager.save(updated);
  Logger.info("Environment updated", { name: env.name, method: newMethod });

  // ── Step 7: optional connection test ─────────────────────────────────────

  const result = await testEnvConnection(updated, authSvc);
  if (result === "ok") {
    vscode.window.showInformationMessage(`\u2714 Auth updated and connection verified for "${env.name}".`);
  } else {
    vscode.window.showWarningMessage(
      `Auth method updated for "${env.name}", but the connection test failed. ` +
      "Check your credentials and try again."
    );
  }
}

function isGuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
