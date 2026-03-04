import * as vscode from "vscode";
import { type IEnvironmentManager, type IAuthenticationService } from "../interfaces";
import { type SecretStorageService } from "../services/SecretStorageService";
import {
  type AuthMethod,
  type DataverseEnvironment,
  type WizardPage,
  type QuickPickWizardItem,
  Logger,
  runWizard,
} from "core-dataverse";
import { testEnvConnection } from "./testConnectionCommand";

// ── Wizard state ────────────────────────────────────────────────────────────

interface EditEnvState {
  method?: AuthMethod;
  name?: string;
  account?: vscode.AuthenticationSessionAccountInformation;
  customClientId?: string;
  customTenantId?: string;
  spTenantId?: string;
  spClientId?: string;
  spSecret?: string;
}

// ── Validators ──────────────────────────────────────────────────────────────

function isGuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

const guidValidator = (v: string): string | undefined =>
  isGuid(v.trim()) ? undefined : "Enter a valid GUID";

const optionalGuidValidator = (v: string): string | undefined =>
  (!v.trim() || isGuid(v.trim())) ? undefined : "Enter a valid GUID or leave blank";

// ── Auth method labels ──────────────────────────────────────────────────────

const METHOD_LABELS: Record<AuthMethod, string> = {
  vscode: "$(person) Sign in with Microsoft",
  azcli: "$(terminal) Azure CLI",
  clientcredentials: "$(plug) Service Principal",
  devicecode: "$(device-mobile) Device Code",
};

const METHOD_DESCRIPTIONS: Record<AuthMethod, string> = {
  vscode: "VS Code browser authentication",
  azcli: "Use your existing `az login` session",
  clientcredentials: "App registration (client ID + secret)",
  devicecode: "Enter a one-time code in a browser",
};

const METHOD_DETAILS: Record<AuthMethod, string> = {
  vscode: "Uses the Microsoft account you're already signed in to VS Code with",
  azcli: "Requires Azure CLI installed and signed in — respects AZURE_CONFIG_DIR",
  clientcredentials: "For environments that require app-based access rather than a personal account",
  devicecode: "Works in headless / remote / SSH environments — optionally use a custom app registration",
};

// ── Edit Environment command ────────────────────────────────────────────────

export async function editEnvironmentCommand(
  envManager: IEnvironmentManager,
  authSvc: IAuthenticationService,
  secretStorage: SecretStorageService,
  environmentId: string
): Promise<void> {
  const env = envManager.getAll().find((e) => e.id === environmentId);
  if (!env) { return; }

  // Closure caches — survives across page renders within a single wizard run
  let accountsCache: readonly vscode.AuthenticationSessionAccountInformation[] | undefined;

  // Track the original values to detect changes
  const original = {
    method: env.authMethod,
    name: env.name,
    accountId: env.accountId,
    clientId: env.clientId,
    tenantId: env.tenantId,
  };

  // ── Page definitions ────────────────────────────────────────────────────

  const pages: WizardPage<EditEnvState>[] = [

    // ── 1. Overview — shows current config as editable menu ──────────────
    {
      id: "overview",
      title: `Edit "${env.name}"`,
      type: "quickpick",
      render: (state) => {
        const currentMethod = state.method ?? env.authMethod;
        const currentName = state.name ?? env.name;

        const hasChanges =
          currentMethod !== original.method ||
          currentName !== original.name ||
          (currentMethod === "vscode" && state.account !== undefined) ||
          (currentMethod === "clientcredentials" && (state.spTenantId !== undefined || state.spClientId !== undefined || state.spSecret !== undefined)) ||
          (currentMethod === "devicecode" && (state.customClientId !== undefined || state.customTenantId !== undefined));

        return {
          placeholder: "Select a field to edit, or save when done",
          items: [
            {
              label: "$(key) Auth Method",
              description: METHOD_DESCRIPTIONS[currentMethod],
              detail: currentMethod !== original.method ? "$(edit) Modified" : undefined,
              action: "edit-method",
            },
            {
              label: "$(edit) Display Name",
              description: currentName,
              detail: currentName !== original.name ? "$(edit) Modified" : undefined,
              action: "edit-name",
            },
            {
              label: "$(globe) Environment URL",
              description: env.url,
              detail: "Read-only — remove and re-add to change URL",
              action: "url-readonly",
            },
            { label: "", kind: -1, action: "" },
            {
              label: hasChanges ? "$(check) Save Changes" : "$(check) Save Changes (no changes)",
              action: "save",
              alwaysShow: true,
            },
          ],
          activeAction: "edit-method",
        };
      },
      onSelect: async (action, _item, state, ui) => {
        if (action === "edit-method") {
          return { next: "method" };
        }
        if (action === "edit-name") {
          return { next: "edit-name" };
        }
        if (action === "url-readonly") {
          vscode.window.showInformationMessage("To change the URL, remove this environment and add a new one.");
          return { next: "overview" };
        }
        if (action === "save") {
          const currentMethod = state.method ?? env.authMethod;
          const currentName = state.name ?? env.name;

          const hasChanges =
            currentMethod !== original.method ||
            currentName !== original.name ||
            (currentMethod === "vscode" && state.account !== undefined) ||
            (currentMethod === "clientcredentials" && (state.spTenantId !== undefined || state.spClientId !== undefined || state.spSecret !== undefined)) ||
            (currentMethod === "devicecode" && (state.customClientId !== undefined || state.customTenantId !== undefined));

          if (!hasChanges) {
            vscode.window.showInformationMessage("No changes to save.");
            return { next: undefined };
          }

          ui.setBusy("Saving changes…");

          await applyChanges(env, state, envManager, authSvc, secretStorage);
          return { next: undefined };
        }
        return { next: "overview" };
      },
    },

    // ── 2. Choose auth method ───────────────────────────────────────────────
    {
      id: "method",
      title: "Choose Auth Method",
      type: "quickpick",
      render: (state) => {
        const currentMethod = state.method ?? env.authMethod;
        const methods: AuthMethod[] = ["vscode", "azcli", "clientcredentials", "devicecode"];

        return {
          placeholder: "How should the extension authenticate with Dataverse?",
          activeAction: currentMethod,
          items: methods.map((m): QuickPickWizardItem => ({
            label: METHOD_LABELS[m],
            description: METHOD_DESCRIPTIONS[m] + (m === currentMethod ? "  $(check) Current" : ""),
            detail: METHOD_DETAILS[m],
            action: m,
          })),
        };
      },
      onSelect: (action, _item, state, _ui) => {
        const method = action as AuthMethod;
        const prev = state.method ?? env.authMethod;

        // If method didn't change, go back to overview without clearing credentials
        if (method === prev && method === (state.method ?? env.authMethod)) {
          return { next: "overview", update: { method } };
        }

        // Reset caches when method changes
        accountsCache = undefined;

        const next =
          method === "vscode" ? "account" :
          method === "devicecode" ? "custom-app" :
          method === "clientcredentials" ? "sp-config" :
          "overview"; // azcli — no extra config

        return { next, update: { method } };
      },
    },

    // ── 3a. Select Microsoft account (vscode method) ────────────────────────
    {
      id: "account",
      title: "Select Account",
      type: "quickpick",
      loading: { placeholder: "Loading accounts…" },
      render: async (state, signal) => {
        if (accountsCache === undefined) {
          try {
            accountsCache = await vscode.authentication.getAccounts("microsoft");
          } catch { accountsCache = []; }
          if (signal.aborted) { return { placeholder: "", items: [] }; }
        }

        const accounts = accountsCache;
        return {
          placeholder: "Select a Microsoft account",
          items: [
            ...accounts.map((a): QuickPickWizardItem => ({
              label: `$(person) ${a.label}`,
              description: a.id === (state.account?.id ?? env.accountId) ? "$(check) Current" : undefined,
              action: "account",
              data: a,
            })),
            {
              label: accounts.length > 0 ? "$(add) Add another account…" : "$(sign-in) Sign in with Microsoft…",
              description: "Browser sign-in",
              action: "add-account",
            },
          ],
        };
      },
      onSelect: async (action, item, _state, _ui) => {
        if (action === "add-account") {
          try {
            const existing = await vscode.authentication.getAccounts("microsoft");
            const session = await vscode.authentication.getSession(
              "microsoft",
              ["openid", "profile"],
              { createIfNone: true, clearSessionPreference: existing.length > 0 }
            );
            if (session) {
              accountsCache = undefined;
              return { next: "overview", update: { account: session.account } };
            }
          } catch (err) {
            Logger.warn("Sign-in failed", { error: String(err) });
            vscode.window.showErrorMessage(
              `Sign-in failed: ${err instanceof Error ? err.message : String(err)}`
            );
          }
          accountsCache = undefined;
          return { next: "account" };
        }

        const account = item.data as vscode.AuthenticationSessionAccountInformation;
        return { next: "overview", update: { account } };
      },
    },

    // ── 3b. Device code app choice ──────────────────────────────────────────
    {
      id: "custom-app",
      title: "App Registration (Device Code)",
      type: "quickpick",
      render: () => ({
        placeholder: "Choose which app registration to use for authentication",
        items: [
          {
            label: "$(circle-slash) Use default app registration",
            description: "Azure CLI public client",
            detail: "Works for most personal and organizational accounts — no app setup required",
            action: "use-default-app",
          },
          {
            label: "$(key) Enter custom client ID…",
            description: "Your own Azure AD app registration",
            detail: "Use this if your tenant requires a specific registered application",
            action: "use-custom-app",
          },
        ],
      }),
      onSelect: (action, _item, _state, _ui) => {
        if (action === "use-default-app") {
          return { next: "overview", update: { customClientId: undefined, customTenantId: undefined } };
        }
        return { next: "custom-app-config" };
      },
    },

    // ── 3b-ii. Custom app config (device code) ──────────────────────────────
    {
      id: "custom-app-config",
      title: "Custom App Registration",
      type: "multi-input",
      render: (state) => ({
        fields: [
          {
            key: "clientId",
            title: "Client ID",
            prompt: "Application (Client) ID",
            value: state.customClientId ?? env.clientId ?? "",
            placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
            validate: guidValidator,
          },
          {
            key: "tenantId",
            title: "Tenant ID (optional)",
            prompt: "Leave blank to use the default multi-tenant endpoint",
            value: state.customTenantId ?? env.tenantId ?? "",
            placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (optional)",
            validate: optionalGuidValidator,
          },
        ],
      }),
      onSubmit: (values) => ({
        next: "overview",
        update: {
          customClientId: values.clientId.trim(),
          customTenantId: values.tenantId.trim() || undefined,
        },
      }),
    },

    // ── 3c. Service principal config (summary) ──────────────────────────────
    {
      id: "sp-config",
      title: "Service Principal",
      type: "quickpick",
      render: (state) => {
        const tenantId = state.spTenantId ?? (env.authMethod === "clientcredentials" ? env.tenantId : undefined);
        const clientId = state.spClientId ?? (env.authMethod === "clientcredentials" ? env.clientId : undefined);
        const secret = state.spSecret;

        const allFilled = !!tenantId && !!clientId && !!secret;

        const activeAction =
          !tenantId ? "edit-tenantId" :
          !clientId ? "edit-clientId" :
          !secret ? "edit-secret" :
          "next";

        return {
          placeholder: "Configure service principal credentials, then select Next",
          activeAction,
          items: [
            {
              label: "$(key) Tenant ID",
              description: tenantId || "Not set",
              detail: "Azure AD Directory (Tenant) ID",
              action: "edit-tenantId",
            },
            {
              label: "$(key) Client ID",
              description: clientId || "Not set",
              detail: "Application (Client) ID",
              action: "edit-clientId",
            },
            {
              label: "$(lock) Client Secret",
              description: secret ? "••••••••" : (env.authMethod === "clientcredentials" ? "••••••••  (stored)" : "Not set"),
              detail: "Client secret value (stored encrypted in OS keychain)",
              action: "edit-secret",
            },
            { label: "", kind: -1, action: "" },
            {
              label: allFilled ? "$(arrow-right) Next" : "$(arrow-right) Next (fill all fields first)",
              action: "next",
              alwaysShow: true,
            },
          ],
        };
      },
      onSelect: (action, _item, state, _ui) => {
        if (action === "next") {
          const tenantId = state.spTenantId ?? (env.authMethod === "clientcredentials" ? env.tenantId : undefined);
          const clientId = state.spClientId ?? (env.authMethod === "clientcredentials" ? env.clientId : undefined);
          const secret = state.spSecret;

          if (!tenantId || !clientId || !secret) {
            vscode.window.showWarningMessage("Please fill in all fields before continuing.");
            return { next: "sp-config" };
          }
          return {
            next: "overview",
            update: { spTenantId: tenantId, spClientId: clientId, spSecret: secret },
          };
        }
        if (action === "edit-tenantId") { return { next: "sp-tenantId" }; }
        if (action === "edit-clientId") { return { next: "sp-clientId" }; }
        if (action === "edit-secret") { return { next: "sp-secret" }; }
        return { next: "sp-config" };
      },
    },

    // ── 3c-i. SP Tenant ID ──────────────────────────────────────────────────
    {
      id: "sp-tenantId",
      title: "Tenant ID",
      ephemeral: true,
      type: "input",
      render: (state) => ({
        prompt: "Azure AD Directory (Tenant) ID",
        value: state.spTenantId ?? (env.authMethod === "clientcredentials" ? env.tenantId : "") ?? "",
        placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        validate: guidValidator,
      }),
      onSubmit: (value) => ({
        next: "sp-config",
        update: { spTenantId: value.trim() },
        pop: true,
      }),
    },

    // ── 3c-ii. SP Client ID ─────────────────────────────────────────────────
    {
      id: "sp-clientId",
      title: "Client ID",
      ephemeral: true,
      type: "input",
      render: (state) => ({
        prompt: "Application (Client) ID",
        value: state.spClientId ?? (env.authMethod === "clientcredentials" ? env.clientId : "") ?? "",
        placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        validate: guidValidator,
      }),
      onSubmit: (value) => ({
        next: "sp-config",
        update: { spClientId: value.trim() },
        pop: true,
      }),
    },

    // ── 3c-iii. SP Client Secret ────────────────────────────────────────────
    {
      id: "sp-secret",
      title: "Client Secret",
      ephemeral: true,
      type: "input",
      render: (state) => ({
        prompt: "Client secret value (stored encrypted in OS keychain)",
        value: state.spSecret ?? "",
        password: true,
        validate: (v: string) => v.trim() ? undefined : "Client secret is required",
      }),
      onSubmit: (value) => ({
        next: "sp-config",
        update: { spSecret: value.trim() },
        pop: true,
      }),
    },

    // ── 4. Edit display name ────────────────────────────────────────────────
    {
      id: "edit-name",
      title: "Display Name",
      ephemeral: true,
      type: "input",
      render: (state) => ({
        prompt: "Display name for this environment",
        value: state.name ?? env.name,
        placeholder: "e.g. Production, Dev, UAT",
        validate: (v: string) => (v.trim() ? undefined : "Name is required"),
      }),
      onSubmit: (value) => ({
        next: "overview",
        update: { name: value.trim() },
        pop: true,
      }),
    },
  ];

  // ── Run ─────────────────────────────────────────────────────────────────

  await runWizard<EditEnvState>({
    title: `Edit Environment`,
    pages,
    initialState: {},
    startPage: "overview",
  });
}

// ── Apply changes ────────────────────────────────────────────────────────────

async function applyChanges(
  env: DataverseEnvironment,
  state: EditEnvState,
  envManager: IEnvironmentManager,
  authSvc: IAuthenticationService,
  secretStorage: SecretStorageService
): Promise<void> {
  const newMethod = state.method ?? env.authMethod;
  const newName = state.name ?? env.name;
  const methodChanged = newMethod !== env.authMethod;

  // Clear old tokens + secret if method changed
  if (methodChanged) {
    await authSvc.clearTokens(env);
    if (env.authMethod === "clientcredentials") {
      await secretStorage.deleteClientSecret(env.id);
    }
  }

  // Determine new credential fields based on method
  let newClientId: string | undefined;
  let newTenantId: string | undefined;
  let newAccountId: string | undefined;

  if (newMethod === "clientcredentials") {
    newTenantId = state.spTenantId ?? env.tenantId;
    newClientId = state.spClientId ?? env.clientId;

    // Store new secret
    if (state.spSecret) {
      await secretStorage.storeClientSecret(env.id, state.spSecret);
    }
  } else if (newMethod === "devicecode") {
    newClientId = state.customClientId !== undefined ? state.customClientId : env.clientId;
    newTenantId = state.customTenantId !== undefined ? state.customTenantId : env.tenantId;
  } else if (newMethod === "vscode") {
    newClientId = undefined;
    newTenantId = env.tenantId; // keep tenantId if set (might be relevant for scoping)
    newAccountId = state.account?.id ?? (methodChanged ? undefined : env.accountId);
  } else {
    // azcli
    newClientId = undefined;
    newTenantId = undefined;
  }

  const updated: DataverseEnvironment = {
    ...env,
    name: newName,
    authMethod: newMethod,
    clientId: newClientId,
    tenantId: newTenantId,
    accountId: newAccountId,
  };

  await envManager.save(updated);
  Logger.info("Environment updated", { name: updated.name, method: newMethod });

  // Connection test
  const result = await testEnvConnection(updated, authSvc);
  if (result === "ok") {
    vscode.window.showInformationMessage(`✔ "${updated.name}" updated and connection verified.`);
  } else {
    vscode.window.showWarningMessage(
      `"${updated.name}" updated, but the connection test failed. Check your credentials and try again.`
    );
  }
}
