import * as vscode from "vscode";
import * as crypto from "crypto";
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
import { fetchWhoAmI, type WhoAmIResult } from "./testConnectionCommand";

const DISCOVERY_URL = "https://globaldisco.crm.dynamics.com/api/discovery/v2.0/Instances";
const DISCOVERY_SCOPE = "https://globaldisco.crm.dynamics.com/.default";

// ── Wizard state ────────────────────────────────────────────────────────────

interface AddEnvState {
  method?: AuthMethod;
  account?: vscode.AuthenticationSessionAccountInformation;
  customClientId?: string;
  customTenantId?: string;
  spTenantId?: string;
  spClientId?: string;
  spSecret?: string;
}

// ── Discovery types ─────────────────────────────────────────────────────────

interface DiscoveredEnvironment {
  id: string;
  friendlyName: string;
  apiUrl: string;
  url: string;
  uniqueName: string;
  tenantId?: string;
  region: string;
  isAdmin: boolean;
  orgType: number;
  version: string;
  purpose: string;
}

// ── Discovery metadata helpers ──────────────────────────────────────────────

const REGION_NAMES: Record<string, string> = {
  NAM: "North America", NA: "North America",
  EUR: "Europe",        EU: "Europe",
  APAC: "Asia Pacific", AP: "Asia Pacific",
  SAM: "South America", SA: "South America",
  OCE: "Oceania",       AU: "Oceania",
  JPN: "Japan",         JP: "Japan",
  IND: "India",         IN: "India",
  CAN: "Canada",        CA: "Canada",
  GBR: "United Kingdom", UK: "United Kingdom",
  FRA: "France",        FR: "France",
  UAE: "UAE",
  DEU: "Germany",       GER: "Germany",
  ZAF: "South Africa",
  KOR: "Korea",
  NOR: "Norway",
  CHE: "Switzerland",
  BRA: "Brazil",
};

const ORG_TYPE_LABELS: Record<number, string> = {
  0:  "Production",
  4:  "Production",
  5:  "Sandbox",
  6:  "Sandbox",
  7:  "Preview",
  9:  "Trial",
  12: "Default",
  13: "Developer",
  14: "Trial",
  15: "Teams",
};

function regionLabel(code: string): string {
  return REGION_NAMES[code.toUpperCase()] ?? code;
}

function orgTypeLabel(type: number): string | undefined {
  return ORG_TYPE_LABELS[type];
}

const REGION_ORDER = ["NAM", "NA", "EUR", "EU", "APAC", "AP", "CAN", "CA", "GBR", "UK", "AUS", "OCE", "AU"];
function regionSortKey(code: string): string {
  const i = REGION_ORDER.indexOf(code.toUpperCase());
  return i >= 0 ? String(i).padStart(3, "0") : `ZZZ${code}`;
}

// ── Validators ──────────────────────────────────────────────────────────────

function isGuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

const guidValidator = (v: string): string | undefined =>
  isGuid(v.trim()) ? undefined : "Enter a valid GUID";

const optionalGuidValidator = (v: string): string | undefined =>
  (!v.trim() || isGuid(v.trim())) ? undefined : "Enter a valid GUID or leave blank";

// ── Add Environment command ─────────────────────────────────────────────────

export async function addEnvironmentCommand(
  envManager: IEnvironmentManager,
  authSvc: IAuthenticationService,
  secretStorage: SecretStorageService
): Promise<void> {
  // Closure caches — survives across page renders within a single wizard run
  let accountsCache: readonly vscode.AuthenticationSessionAccountInformation[] | undefined;
  let discoveryCache: DiscoveredEnvironment[] | undefined;
  let discoveryError: string | undefined;

  // ── Page definitions ────────────────────────────────────────────────────

  const pages: WizardPage<AddEnvState>[] = [

    // ── 1. Choose auth method ─────────────────────────────────────────────
    {
      id: "method",
      title: "Choose Auth Method",
      type: "quickpick",
      render: () => ({
        placeholder: "How should the extension authenticate with Dataverse?",
        items: [
          {
            label: "$(person) Sign in with Microsoft",
            description: "VS Code browser authentication",
            detail: "Uses the Microsoft account you're already signed in to VS Code with",
            action: "vscode",
          },
          {
            label: "$(terminal) Azure CLI",
            description: "Use your existing `az login` session",
            detail: "Requires Azure CLI installed and signed in — respects AZURE_CONFIG_DIR",
            action: "azcli",
          },
          {
            label: "$(plug) Service Principal",
            description: "App registration (client ID + secret)",
            detail: "For environments that require app-based access rather than a personal account",
            action: "clientcredentials",
          },
          {
            label: "$(device-mobile) Device Code",
            description: "Enter a one-time code in a browser",
            detail: "Works in headless / remote / SSH environments — optionally use a custom app registration",
            action: "devicecode",
          },
        ],
      }),
      onSelect: (action, _item, _state, _ui) => {
        // Reset caches when method changes
        discoveryCache = undefined;
        discoveryError = undefined;
        accountsCache = undefined;

        const method = action as AuthMethod;
        const next =
          method === "vscode" ? "account" :
          method === "devicecode" ? "custom-app" :
          method === "clientcredentials" ? "sp-config" :
          "environments"; // azcli

        return { next, update: { method } };
      },
    },

    // ── 2a. Select Microsoft account (vscode method) ──────────────────────
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
              description: a.id === state.account?.id ? "$(check) Last selected" : undefined,
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
      onSelect: async (action, item, state, _ui) => {
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
              discoveryCache = undefined;
              discoveryError = undefined;
              return { next: "environments", update: { account: session.account } };
            }
          } catch (err) {
            Logger.warn("Sign-in failed", { error: String(err) });
            vscode.window.showErrorMessage(
              `Sign-in failed: ${err instanceof Error ? err.message : String(err)}`
            );
          }
          // Failed or cancelled — refresh account page
          accountsCache = undefined;
          return { next: "account" };
        }

        // Regular account selection
        const account = item.data as vscode.AuthenticationSessionAccountInformation;
        const isNew = account.id !== state.account?.id;
        if (isNew) { discoveryCache = undefined; discoveryError = undefined; }
        return { next: "environments", update: { account } };
      },
    },

    // ── 2b. Device code app choice ────────────────────────────────────────
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
          discoveryCache = undefined;
          discoveryError = undefined;
          return { next: "environments", update: { customClientId: undefined, customTenantId: undefined } };
        }
        return { next: "custom-app-config" };
      },
    },

    // ── 2b-ii. Custom app config (device code) ───────────────────────────
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
            value: state.customClientId ?? "",
            placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
            validate: guidValidator,
          },
          {
            key: "tenantId",
            title: "Tenant ID (optional)",
            prompt: "Leave blank to use the default multi-tenant endpoint",
            value: state.customTenantId ?? "",
            placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (optional)",
            validate: optionalGuidValidator,
          },
        ],
      }),
      onSubmit: (values) => {
        discoveryCache = undefined;
        discoveryError = undefined;
        return {
          next: "environments",
          update: {
            customClientId: values.clientId.trim(),
            customTenantId: values.tenantId.trim() || undefined,
          },
        };
      },
    },

    // ── 2c. Service principal config (summary) ───────────────────────────
    {
      id: "sp-config",
      title: "Service Principal",
      type: "quickpick",
      render: (state) => {
        const allFilled = !!state.spTenantId && !!state.spClientId && !!state.spSecret;

        // Pre-select first unfilled field, or "Next" if all filled
        const activeAction =
          !state.spTenantId ? "edit-tenantId" :
          !state.spClientId ? "edit-clientId" :
          !state.spSecret ? "edit-secret" :
          "next";

        return {
          placeholder: "Configure service principal credentials, then select Next",
          activeAction,
          items: [
            {
              label: "$(key) Tenant ID",
              description: state.spTenantId || "Not set",
              detail: "Azure AD Directory (Tenant) ID",
              action: "edit-tenantId",
            },
            {
              label: "$(key) Client ID",
              description: state.spClientId || "Not set",
              detail: "Application (Client) ID",
              action: "edit-clientId",
            },
            {
              label: "$(lock) Client Secret",
              description: state.spSecret ? "••••••••" : "Not set",
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
          if (!state.spTenantId || !state.spClientId || !state.spSecret) {
            vscode.window.showWarningMessage("Please fill in all fields before continuing.");
            return { next: "sp-config" };
          }
          discoveryCache = undefined;
          discoveryError = undefined;
          return { next: "environments" };
        }
        if (action === "edit-tenantId") { return { next: "sp-tenantId" }; }
        if (action === "edit-clientId") { return { next: "sp-clientId" }; }
        if (action === "edit-secret") { return { next: "sp-secret" }; }
        return { next: "sp-config" };
      },
    },

    // ── 2c-i. SP Tenant ID ─────────────────────────────────────────────
    {
      id: "sp-tenantId",
      title: "Tenant ID",
      ephemeral: true,
      type: "input",
      render: (state) => ({
        prompt: "Azure AD Directory (Tenant) ID",
        value: state.spTenantId ?? "",
        placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        validate: guidValidator,
      }),
      onSubmit: (value) => ({
        next: "sp-config",
        update: { spTenantId: value.trim() },
        pop: true,
      }),
    },

    // ── 2c-ii. SP Client ID ────────────────────────────────────────────
    {
      id: "sp-clientId",
      title: "Client ID",
      ephemeral: true,
      type: "input",
      render: (state) => ({
        prompt: "Application (Client) ID",
        value: state.spClientId ?? "",
        placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        validate: guidValidator,
      }),
      onSubmit: (value) => ({
        next: "sp-config",
        update: { spClientId: value.trim() },
        pop: true,
      }),
    },

    // ── 2c-iii. SP Client Secret ───────────────────────────────────────
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

    // ── 3. Environment discovery + selection ──────────────────────────────
    {
      id: "environments",
      title: "Select Environment",
      type: "quickpick",
      loading: {
        placeholder: "Discovering environments…",
        items: [
          {
            label: "$(settings-gear) Enter custom URL…",
            description: "Manually specify environment URL",
            action: "custom",
            alwaysShow: true,
          },
        ],
      },
      render: async (state, signal) => {
        if (discoveryCache === undefined) {
          try {
            discoveryCache = await discoverEnvironments(state, authSvc, signal);
            discoveryError = undefined;
            Logger.info(`Discovery: ${discoveryCache.length} environment(s)`);
          } catch (err) {
            if (signal.aborted) { return { placeholder: "", items: [] }; }
            const raw = err instanceof Error ? err.message : String(err);
            discoveryError = isNetworkError(raw)
              ? "Cannot reach the Dataverse discovery service. Check your network connection."
              : raw;
            discoveryCache = [];
            Logger.warn("Discovery failed", { error: raw });
          }
        }

        if (signal.aborted) { return { placeholder: "", items: [] }; }

        const customItem: QuickPickWizardItem = {
          label: "$(settings-gear) Enter custom URL…",
          description: "Manually specify environment URL",
          action: "custom",
          alwaysShow: true,
        };

        if (discoveryError && discoveryCache.length === 0) {
          return {
            placeholder: discoveryError,
            items: [
              customItem,
              { label: "$(refresh) Retry", description: "Try discovering environments again", action: "retry" },
            ],
          };
        }

        const existingUrls = new Set(envManager.getAll().map((e) => e.url.toLowerCase()));
        const envItems = buildEnvItems(discoveryCache, existingUrls);

        return {
          placeholder: discoveryCache.length > 0 ? "Choose an environment to add" : "No environments found",
          items: [customItem, ...envItems],
        };
      },
      onSelect: async (action, item, state, ui) => {
        if (action === "custom") {
          return { next: "custom-url" };
        }

        if (action === "retry") {
          discoveryCache = undefined;
          discoveryError = undefined;
          return { next: "environments" };
        }

        if (action === "already-added") {
          vscode.window.showInformationMessage(`"${item.label}" is already added.`);
          return { next: "environments" };
        }

        // action === "env"
        const envData = item.data as { url: string; name: string; tenantId?: string };
        ui.setBusy(`Adding "${envData.name}"\u2026`);

        const env: DataverseEnvironment = {
          id: crypto.randomUUID(),
          name: envData.name,
          url: envData.url,
          authMethod: state.method!,
          accountId: state.account?.id,
          tenantId: envData.tenantId ?? state.customTenantId ?? state.spTenantId,
          clientId: state.customClientId ?? state.spClientId,
        };

        await saveEnvironment(envManager, env, authSvc, secretStorage, state.spSecret);
        return { next: undefined };
      },
    },

    // ── 3-alt. Custom URL entry ───────────────────────────────────────────
    {
      id: "custom-url",
      title: "Custom URL",
      type: "multi-input",
      render: () => ({
        fields: [
          {
            key: "url",
            title: "Environment URL",
            prompt: "Dataverse environment URL",
            placeholder: "https://yourorg.crm.dynamics.com",
            validate: (v: string) => {
              try {
                const u = new URL(v.trim());
                if (u.protocol !== "https:") { return "URL must use HTTPS"; }
                const existing = new Set(envManager.getAll().map((e) => e.url.toLowerCase()));
                if (existing.has(v.trim().replace(/\/$/, "").toLowerCase())) {
                  return "This environment is already added";
                }
                return undefined;
              } catch {
                return "Enter a valid URL";
              }
            },
          },
          {
            key: "name",
            title: "Display Name",
            prompt: "Display name for this environment",
            placeholder: "e.g. Production, Dev, UAT",
            validate: (v: string) => (v.trim() ? undefined : "Name is required"),
          },
        ],
      }),
      onSubmit: async (values, state) => {
        const env: DataverseEnvironment = {
          id: crypto.randomUUID(),
          name: values.name.trim(),
          url: values.url.trim().replace(/\/$/, ""),
          authMethod: state.method!,
          accountId: state.account?.id,
          clientId: state.customClientId ?? state.spClientId,
          tenantId: state.customTenantId ?? state.spTenantId,
        };

        await saveEnvironment(envManager, env, authSvc, secretStorage, state.spSecret);
        return { next: undefined };
      },
    },
  ];

  // ── Run ─────────────────────────────────────────────────────────────────

  await runWizard<AddEnvState>({
    title: "Add Dataverse Environment",
    pages,
    initialState: {},
    startPage: "method",
  });
}

// ── Discovery ───────────────────────────────────────────────────────────────

async function discoverEnvironments(
  state: AddEnvState,
  authSvc: IAuthenticationService,
  signal: AbortSignal
): Promise<DiscoveredEnvironment[]> {
  let token: string;

  if (state.method === "vscode" && state.account) {
    const ds = await vscode.authentication.getSession("microsoft", [DISCOVERY_SCOPE], {
      account: state.account,
      createIfNone: true,
    });
    if (signal.aborted) { return []; }
    if (!ds) { throw new Error("Sign-in returned no session."); }
    token = ds.accessToken;
  } else if (state.method === "clientcredentials") {
    const { ClientSecretCredential } = await import("@azure/identity");
    const cred = new ClientSecretCredential(state.spTenantId!, state.spClientId!, state.spSecret!);
    const t = await cred.getToken(DISCOVERY_SCOPE);
    if (signal.aborted) { return []; }
    if (!t?.token) { throw new Error("Service Principal returned no token for discovery."); }
    token = t.token;
  } else {
    token = await authSvc.getTokenForMethod(state.method!, DISCOVERY_SCOPE, state.customClientId, state.customTenantId);
    if (signal.aborted) { return []; }
  }

  const url = new URL(DISCOVERY_URL);
  url.searchParams.set("$select", "Id,FriendlyName,ApiUrl,Url,UniqueName,TenantId,Region,IsUserSysAdmin,OrganizationType,Version,Purpose");
  url.searchParams.set("$filter", "State eq 0");

  const timeoutAbort = new AbortController();
  const timer = setTimeout(() => timeoutAbort.abort(), 20_000);
  signal.addEventListener("abort", () => timeoutAbort.abort(), { once: true });

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: timeoutAbort.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (signal.aborted) { return []; }
  if (!response.ok) {
    throw new Error(`Discovery returned ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as { value: Record<string, unknown>[] };
  return data.value
    .map((inst) => ({
      id: (inst["Id"] as string) ?? crypto.randomUUID(),
      friendlyName: (inst["FriendlyName"] as string) || (inst["UniqueName"] as string) || (inst["ApiUrl"] as string),
      apiUrl: ((inst["ApiUrl"] as string) ?? "").replace(/\/$/, ""),
      url: ((inst["Url"] as string) ?? (inst["ApiUrl"] as string) ?? "").replace(/\/$/, ""),
      uniqueName: (inst["UniqueName"] as string) ?? "",
      tenantId: (inst["TenantId"] as string) || undefined,
      region: (inst["Region"] as string) ?? "",
      isAdmin: inst["IsUserSysAdmin"] === true,
      orgType: (() => { const v = inst["OrganizationType"]; return typeof v === "number" ? v : typeof v === "string" ? parseInt(v, 10) : -1; })(),
      version: (inst["Version"] as string) ?? "",
      purpose: (inst["Purpose"] as string) ?? "",
    }))
    .filter((e) => e.apiUrl.startsWith("https://"));
}

// ── Environment list builder ────────────────────────────────────────────────

function buildEnvItems(
  discovered: DiscoveredEnvironment[],
  existingUrls: Set<string>
): QuickPickWizardItem[] {
  const byRegion = new Map<string, DiscoveredEnvironment[]>();
  for (const env of discovered) {
    const key = env.region || "Unknown";
    if (!byRegion.has(key)) { byRegion.set(key, []); }
    byRegion.get(key)!.push(env);
  }

  const sortedRegions = [...byRegion.keys()].sort((a, b) =>
    regionSortKey(a).localeCompare(regionSortKey(b))
  );

  const items: QuickPickWizardItem[] = [];
  for (const region of sortedRegions) {
    const envs = byRegion.get(region)!.sort((a, b) => {
      if (a.isAdmin !== b.isAdmin) { return a.isAdmin ? -1 : 1; }
      return a.friendlyName.localeCompare(b.friendlyName);
    });

    items.push({ label: regionLabel(region), kind: -1, action: "" }); // Separator

    for (const env of envs) {
      const alreadyAdded = existingUrls.has(env.apiUrl.toLowerCase());
      const badges = [
        env.isAdmin ? "$(shield) Admin" : undefined,
        env.orgType >= 0 ? orgTypeLabel(env.orgType) : undefined,
        env.version ? `v${env.version.split(".").slice(0, 2).join(".")}` : undefined,
        env.purpose ? `\u00b7 ${env.purpose}` : undefined,
      ].filter(Boolean).join("  ");

      items.push({
        label: env.friendlyName,
        description: new URL(env.apiUrl).hostname,
        detail: alreadyAdded ? "$(check) Already added" : (badges || undefined),
        action: alreadyAdded ? "already-added" : "env",
        data: { url: env.apiUrl, name: env.friendlyName, tenantId: env.tenantId },
      });
    }
  }

  return items;
}

// ── Save environment + connection test ──────────────────────────────────────

async function saveEnvironment(
  envManager: IEnvironmentManager,
  env: DataverseEnvironment,
  authSvc: IAuthenticationService,
  secretStorage: SecretStorageService,
  spSecret?: string
): Promise<void> {
  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: `Adding "${env.name}"…` },
    async () => {
      if (env.authMethod === "clientcredentials" && spSecret) {
        await secretStorage.storeClientSecret(env.id, spSecret);
      }

      // Skip WhoAmI for device code — discovery already proved auth works,
      // and acquiring a token for a different resource would trigger a second
      // device code prompt (MSAL treats each resource as a separate flow).
      let whoAmI: WhoAmIResult | null = null;
      if (env.authMethod !== "devicecode") {
        whoAmI = await fetchWhoAmI(env, authSvc);
        await authSvc.clearTokens(env);
      }

      const envToSave = whoAmI
        ? { ...env, userId: whoAmI.userId, organizationId: whoAmI.organizationId }
        : env;
      await envManager.save(envToSave);
      Logger.info("Environment added", { name: env.name, method: env.authMethod });

      if (env.authMethod === "devicecode") {
        vscode.window.showInformationMessage(
          `\u2714 Environment "${env.name}" added. Connection will be verified on first use.`
        );
      } else if (whoAmI) {
        vscode.window.showInformationMessage(`\u2714 Environment "${env.name}" added and connection verified.`);
      } else {
        vscode.window.showWarningMessage(
          `Environment "${env.name}" added, but the connection test failed. ` +
          "Check your credentials \u2014 the environment will still appear in the list."
        );
      }
    }
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function isNetworkError(message: string): boolean {
  return (
    message.includes("ENOTFOUND") ||
    message.includes("ECONNREFUSED") ||
    message.includes("ECONNRESET") ||
    message.includes("ETIMEDOUT") ||
    message.includes("getaddrinfo") ||
    message.includes("network socket")
  );
}
