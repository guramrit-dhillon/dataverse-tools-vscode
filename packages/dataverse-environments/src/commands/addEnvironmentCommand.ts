import * as vscode from "vscode";
import * as crypto from "crypto";
import { type IEnvironmentManager, type IAuthenticationService } from "../interfaces";
import { type SecretStorageService } from "../services/SecretStorageService";
import { type AuthMethod, type DataverseEnvironment, Logger } from "core-dataverse";
import { fetchWhoAmI } from "./testConnectionCommand";

const DISCOVERY_URL = "https://globaldisco.crm.dynamics.com/api/discovery/v2.0/Instances";
const DISCOVERY_SCOPE = "https://globaldisco.crm.dynamics.com/.default";

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

// ── Discovery metadata helpers ────────────────────────────────────────────────

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

// ── Add Environment — single-QP navigable wizard ──────────────────────────────

export async function addEnvironmentCommand(
  envManager: IEnvironmentManager,
  authSvc: IAuthenticationService,
  secretStorage: SecretStorageService
): Promise<void> {
  type Page = "method" | "account" | "custom-app" | "sp-config" | "environments";

  type NavItem = vscode.QuickPickItem & {
    _action?: "back" | "method" | "account" | "add-account" | "env" | "custom" | "retry" | "use-default-app" | "use-custom-app" | "sp-field" | "sp-continue";
    _method?: AuthMethod;
    _account?: vscode.AuthenticationSessionAccountInformation;
    _envUrl?: string;
    _tenantId?: string;
    _spField?: "tenantId" | "clientId" | "secret";
  };

  // ── Wizard state ──────────────────────────────────────────────────────────
  let chosenMethod: AuthMethod | undefined;
  let chosenAccount: vscode.AuthenticationSessionAccountInformation | undefined;
  let accounts: readonly vscode.AuthenticationSessionAccountInformation[] | undefined;
  let discovered: DiscoveredEnvironment[] | undefined;
  let discoveryErr: string | undefined;

  // Custom app state (browser + devicecode)
  let customClientId: string | undefined;
  let customTenantId: string | undefined;

  // Service principal state
  let spTenantId: string | undefined;
  let spClientId: string | undefined;
  let spSecret: string | undefined;

  // ── Navigation stack ──────────────────────────────────────────────────────
  const stack: Page[] = [];

  let renderAbort: AbortController | undefined;

  function cancelRender(): void {
    renderAbort?.abort();
    renderAbort = undefined;
  }

  // ── QuickPick ─────────────────────────────────────────────────────────────
  const qp = vscode.window.createQuickPick<NavItem>();
  qp.ignoreFocusOut = true;

  const BACK: NavItem = { label: "$(arrow-left) Back", _action: "back", alwaysShow: true };
  const CUSTOM: NavItem = {
    label: "$(settings-gear) Enter custom URL…",
    description: "Manually specify environment URL",
    _action: "custom",
    alwaysShow: true,
  };

  function navigateTo(page: Page): void {
    cancelRender();
    stack.push(page);
    startRender(page);
  }

  function navigateBack(): void {
    if (stack.length <= 1) { return; }
    cancelRender();
    stack.pop();
    startRender(stack[stack.length - 1]);
  }

  function startRender(page: Page): void {
    const ctrl = new AbortController();
    renderAbort = ctrl;
    renderPage(page, ctrl.signal).catch((err) => {
      if (!ctrl.signal.aborted) {
        Logger.warn("Render error", { error: String(err) });
      }
    });
  }

  async function renderPage(page: Page, signal: AbortSignal): Promise<void> {
    if (page === "method")       { renderMethod(); }
    else if (page === "account") { await renderAccount(signal); }
    else if (page === "custom-app") { renderCustomApp(); }
    else if (page === "sp-config")  { renderSpConfig(); }
    else                         { await renderEnvironments(signal); }
  }

  // ── Page: method ─────────────────────────────────────────────────────────

  function renderMethod(): void {
    qp.title = "Add Dataverse Environment — Choose Auth Method";
    qp.placeholder = "How should the extension authenticate with Dataverse?";
    qp.busy = false;
    qp.items = [
      {
        label: "$(person) Sign in with Microsoft",
        description: "VS Code browser authentication",
        detail: "Uses the Microsoft account you're already signed in to VS Code with",
        _action: "method", _method: "vscode",
      },
      {
        label: "$(terminal) Azure CLI",
        description: "Use your existing `az login` session",
        detail: "Requires Azure CLI installed and signed in — respects AZURE_CONFIG_DIR",
        _action: "method", _method: "azcli",
      },
      {
        label: "$(plug) Service Principal",
        description: "App registration (client ID + secret)",
        detail: "For environments that require app-based access rather than a personal account",
        _action: "method", _method: "clientcredentials",
      },
      {
        label: "$(device-mobile) Device Code",
        description: "Enter a one-time code in a browser",
        detail: "Works in headless / remote / SSH environments — optionally use a custom app registration",
        _action: "method", _method: "devicecode",
      },
    ];
  }

  // ── Page: account (VS Code method only — UNCHANGED) ──────────────────────

  async function renderAccount(signal: AbortSignal): Promise<void> {
    qp.title = "Add Dataverse Environment (2/3) — Select Account";

    if (accounts === undefined) {
      qp.placeholder = "Loading accounts…";
      qp.busy = true;
      qp.items = [BACK];

      try {
        accounts = await vscode.authentication.getAccounts("microsoft");
      } catch { accounts = []; }

      if (signal.aborted) { return; }
      qp.busy = false;
    }
    qp.placeholder = "Select a Microsoft account";
    qp.items = [
      BACK,
      ...accounts.map((a): NavItem => ({
        label: `$(person) ${a.label}`,
        description: a.id === chosenAccount?.id ? "$(check) Last selected" : undefined,
        _action: "account",
        _account: a,
      })),
      {
        label: accounts.length > 0 ? "$(add) Add another account…" : "$(sign-in) Sign in with Microsoft…",
        description: "Browser sign-in",
        _action: "add-account",
      },
    ];
  }

  // ── Page: custom-app (devicecode) ────────────────────────────────────────

  function renderCustomApp(): void {
    qp.title = "Add Dataverse Environment — App Registration (Device Code)";
    qp.placeholder = "Choose which app registration to use for authentication";
    qp.busy = false;
    qp.items = [
      BACK,
      {
        label: "$(circle-slash) Use default app registration",
        description: "Azure CLI public client",
        detail: "Works for most personal and organizational accounts — no app setup required",
        _action: "use-default-app",
      },
      {
        label: "$(key) Enter custom client ID…",
        description: "Your own Azure AD app registration",
        detail: "Use this if your tenant requires a specific registered application",
        _action: "use-custom-app",
      },
    ];
  }

  // ── Page: sp-config (clientcredentials) ──────────────────────────────────

  function renderSpConfig(): void {
    qp.title = "Add Dataverse Environment — Service Principal";
    qp.placeholder = "Set all three fields, then choose Continue";
    qp.busy = false;

    const tenantDisplay = spTenantId ? spTenantId : "$(warning) Not set";
    const clientDisplay = spClientId ? spClientId : "$(warning) Not set";
    const secretDisplay = spSecret   ? "••••••••"  : "$(warning) Not set";
    const allSet = !!(spTenantId && spClientId && spSecret);

    const items: NavItem[] = [
      BACK,
      { label: "Tenant ID", description: tenantDisplay, detail: "Azure AD Directory (Tenant) ID", _action: "sp-field", _spField: "tenantId" },
      { label: "Client ID", description: clientDisplay, detail: "Application (Client) ID of the registered app", _action: "sp-field", _spField: "clientId" },
      { label: "Client Secret", description: secretDisplay, detail: "Stored encrypted in OS keychain — never written to disk", _action: "sp-field", _spField: "secret" },
      { label: "", kind: vscode.QuickPickItemKind.Separator } as NavItem,
    ];

    if (allSet) {
      items.push({
        label: "$(arrow-right) Continue",
        description: "Proceed to environment selection",
        _action: "sp-continue",
        alwaysShow: true,
      });
    } else {
      items.push({
        label: "$(info) Fill in all fields above to continue",
        description: "",
        alwaysShow: true,
      });
    }

    qp.items = items;
  }

  // ── Page: environments (discovery) ───────────────────────────────────────

  async function renderEnvironments(signal: AbortSignal): Promise<void> {
    let stepNum: number;
    let stepTotal: number;
    if (chosenMethod === "vscode") { stepNum = 3; stepTotal = 3; }
    else if (chosenMethod === "clientcredentials") { stepNum = 3; stepTotal = 3; }
    else { stepNum = 2; stepTotal = 2; }

    qp.title = `Add Dataverse Environment (${stepNum}/${stepTotal}) — Select Environment`;
    qp.placeholder = "Discovering environments…";
    qp.busy = true;
    qp.items = [BACK, CUSTOM];

    if (discovered === undefined) {
      try {
        let token: string;

        if (chosenMethod === "vscode" && chosenAccount) {
          const ds = await vscode.authentication.getSession("microsoft", [DISCOVERY_SCOPE], {
            account: chosenAccount,
            createIfNone: true,
          });
          if (signal.aborted) { return; }
          if (!ds) { throw new Error("Sign-in returned no session."); }
          token = ds.accessToken;
        } else if (chosenMethod === "clientcredentials") {
          // For SP, use ClientSecretCredential directly for discovery.
          const { ClientSecretCredential } = await import("@azure/identity");
          const cred = new ClientSecretCredential(spTenantId!, spClientId!, spSecret!);
          const t = await cred.getToken(DISCOVERY_SCOPE);
          if (signal.aborted) { return; }
          if (!t?.token) { throw new Error("Service Principal returned no token for discovery."); }
          token = t.token;
        } else {
          token = await authSvc.getTokenForMethod(chosenMethod!, DISCOVERY_SCOPE, customClientId, customTenantId);
          if (signal.aborted) { return; }
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

        if (signal.aborted) { return; }
        if (!response.ok) {
          throw new Error(`Discovery returned ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as { value: Record<string, unknown>[] };
        discovered = data.value
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
        discoveryErr = undefined;
        Logger.info(`Discovery: ${discovered.length} environment(s)`);
      } catch (err) {
        if (signal.aborted) { return; }
        const raw = err instanceof Error ? err.message : String(err);
        discoveryErr = isNetworkError(raw)
          ? "Cannot reach the Dataverse discovery service. Check your network connection."
          : raw;
        discovered = [];
        Logger.warn("Discovery failed", { error: raw });
      }
    }

    if (signal.aborted) { return; }
    qp.busy = false;

    if (discoveryErr && discovered.length === 0) {
      qp.placeholder = discoveryErr;
      qp.items = [
        BACK,
        CUSTOM,
        { label: "$(refresh) Retry", description: "Try discovering environments again", _action: "retry" },
      ];
      return;
    }

    const existingUrls = new Set(envManager.getAll().map((e) => e.url.toLowerCase()));
    qp.placeholder = discovered.length > 0 ? "Choose an environment to add" : "No environments found";

    const byRegion = new Map<string, DiscoveredEnvironment[]>();
    for (const env of discovered) {
      const key = env.region || "Unknown";
      if (!byRegion.has(key)) { byRegion.set(key, []); }
      byRegion.get(key)!.push(env);
    }

    const sortedRegions = [...byRegion.keys()].sort((a, b) =>
      regionSortKey(a).localeCompare(regionSortKey(b))
    );

    const envItems: NavItem[] = [];
    for (const region of sortedRegions) {
      const envs = byRegion.get(region)!.sort((a, b) => {
        if (a.isAdmin !== b.isAdmin) { return a.isAdmin ? -1 : 1; }
        return a.friendlyName.localeCompare(b.friendlyName);
      });

      envItems.push({ label: regionLabel(region), kind: vscode.QuickPickItemKind.Separator } as NavItem);

      for (const env of envs) {
        const alreadyAdded = existingUrls.has(env.apiUrl.toLowerCase());
        const badges = [
          env.isAdmin ? "$(shield) Admin" : undefined,
          env.orgType >= 0 ? orgTypeLabel(env.orgType) : undefined,
          env.version ? `v${env.version.split(".").slice(0, 2).join(".")}` : undefined,
          env.purpose ? `· ${env.purpose}` : undefined,
        ].filter(Boolean).join("  ");

        envItems.push({
          label: env.friendlyName,
          description: new URL(env.apiUrl).hostname,
          detail: alreadyAdded ? "$(check) Already added" : (badges || undefined),
          _action: "env",
          _envUrl: alreadyAdded ? undefined : env.apiUrl,
          _tenantId: alreadyAdded ? undefined : env.tenantId,
        });
      }
    }

    qp.items = [BACK, CUSTOM, ...envItems];
  }

  // ── Accept handler ────────────────────────────────────────────────────────

  let processing = false;
  let cancelAddAccount: (() => void) | undefined;

  qp.onDidAccept(() => {
    const item = qp.selectedItems[0] as NavItem | undefined;
    if (!item || !item._action) { return; }

    if (item._action === "back") {
      if (processing) {
        cancelAddAccount?.();
        cancelAddAccount = undefined;
        processing = false;
      }
      navigateBack();
      return;
    }

    if (processing) { return; }
    processing = true;

    const page = stack[stack.length - 1];

    // ── method page ──────────────────────────────────────────────────────
    if (page === "method" && item._action === "method" && item._method) {
      chosenMethod = item._method;
      // Reset state when method changes
      discovered = undefined;
      discoveryErr = undefined;
      customClientId = undefined;
      customTenantId = undefined;
      spTenantId = undefined;
      spClientId = undefined;
      spSecret = undefined;

      if (chosenMethod === "vscode") { navigateTo("account"); }
      else if (chosenMethod === "devicecode") { navigateTo("custom-app"); }
      else if (chosenMethod === "clientcredentials") { navigateTo("sp-config"); }
      else { navigateTo("environments"); } // azcli

      processing = false;
      return;
    }

    // ── account page ─────────────────────────────────────────────────────
    if (page === "account") {
      if (item._action === "account" && item._account) {
        const isNew = item._account.id !== chosenAccount?.id;
        chosenAccount = item._account;
        if (isNew) { discovered = undefined; discoveryErr = undefined; }
        navigateTo("environments");
        processing = false;
        return;
      }
      if (item._action === "add-account") {
        doAddAccount().finally(() => { processing = false; });
        return;
      }
    }

    // ── custom-app page ──────────────────────────────────────────────────
    if (page === "custom-app") {
      if (item._action === "use-default-app") {
        customClientId = undefined;
        customTenantId = undefined;
        discovered = undefined;
        discoveryErr = undefined;
        navigateTo("environments");
        processing = false;
        return;
      }
      if (item._action === "use-custom-app") {
        processing = false;
        cancelRender();
        qp.hide();
        collectCustomApp().then(() => { qp.show(); startRender(stack[stack.length - 1]); });
        return;
      }
    }

    // ── sp-config page ───────────────────────────────────────────────────
    if (page === "sp-config") {
      if (item._action === "sp-field") {
        processing = false;
        doSpField(item._spField!).then(() => { renderSpConfig(); });
        return;
      }
      if (item._action === "sp-continue") {
        discovered = undefined;
        discoveryErr = undefined;
        navigateTo("environments");
        processing = false;
        return;
      }
    }

    // ── environments page ────────────────────────────────────────────────
    if (page === "environments") {
      if (item._action === "custom") {
        cancelRender();
        processing = false;
        qp.hide();
        addCustomEnvironmentInputBoxes(envManager, authSvc, secretStorage, chosenMethod!, chosenAccount?.id, customClientId, customTenantId, spTenantId, spClientId, spSecret);
        return;
      }
      if (item._action === "retry") {
        discovered = undefined;
        discoveryErr = undefined;
        processing = false;
        startRender("environments");
        return;
      }
      if (item._action === "env") {
        if (!item._envUrl) {
          vscode.window.showInformationMessage(`"${item.label}" is already added.`);
          processing = false;
          return;
        }
        cancelRender();
        const env: DataverseEnvironment = {
          id: crypto.randomUUID(),
          name: item.label,
          url: item._envUrl,
          authMethod: chosenMethod!,
          accountId: chosenAccount?.id,
          tenantId: item._tenantId ?? customTenantId ?? spTenantId,
          clientId: customClientId ?? spClientId,
        };
        processing = false;
        saveEnvironment(envManager, env, authSvc, secretStorage, spSecret).then(() => {
          qp.hide();
        });
        return;
      }
    }

    processing = false;
  });

  // ── Browser sign-in helper (VS Code account page) ─────────────────────────

  async function doAddAccount(): Promise<void> {
    let cancelled = false;
    cancelAddAccount = () => { cancelled = true; };

    qp.busy = true;
    qp.placeholder = "Opening browser sign-in…";
    try {
      const existing = await vscode.authentication.getAccounts("microsoft");
      if (cancelled) { qp.busy = false; return; }

      const session = await vscode.authentication.getSession(
        "microsoft",
        ["openid", "profile"],
        { createIfNone: true, clearSessionPreference: existing.length > 0 }
      );
      if (cancelled) { qp.busy = false; return; }

      if (session) {
        chosenAccount = session.account;
        accounts = undefined;
        discovered = undefined;
        discoveryErr = undefined;
        qp.busy = false;
        navigateTo("environments");
        return;
      }
    } catch (err) {
      if (cancelled) { qp.busy = false; return; }
      Logger.warn("Sign-in failed", { error: String(err) });
      vscode.window.showErrorMessage(
        `Sign-in failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    accounts = undefined;
    qp.busy = false;
    startRender("account");
  }

  // ── Custom app registration (devicecode) helper ──────────────────────────

  async function collectCustomApp(): Promise<void> {
    const clientId = await vscode.window.showInputBox({
      title: "Device Code — Custom Client ID",
      prompt: "Application (Client) ID",
      value: customClientId ?? "",
      placeHolder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      ignoreFocusOut: true,
      validateInput: (v) => isGuid(v.trim()) ? undefined : "Enter a valid GUID",
    });
    if (!clientId) { return; }

    const tenantId = await vscode.window.showInputBox({
      title: "Custom App Registration — Tenant ID (optional)",
      prompt: "Leave blank to use the default multi-tenant endpoint",
      value: customTenantId ?? "",
      placeHolder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (optional)",
      ignoreFocusOut: true,
      validateInput: (v) => (!v.trim() || isGuid(v.trim())) ? undefined : "Enter a valid GUID or leave blank",
    });
    if (tenantId === undefined) { return; }

    customClientId = clientId.trim();
    customTenantId = tenantId.trim() || undefined;
    discovered = undefined;
    discoveryErr = undefined;
    navigateTo("environments");
  }

  // ── SP field input helper ─────────────────────────────────────────────────

  async function doSpField(field: "tenantId" | "clientId" | "secret"): Promise<void> {
    if (field === "tenantId") {
      const val = await vscode.window.showInputBox({
        title: "Service Principal — Tenant ID",
        prompt: "Azure AD Directory (Tenant) ID",
        value: spTenantId ?? "",
        placeHolder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        ignoreFocusOut: true,
        validateInput: (v) => isGuid(v.trim()) ? undefined : "Enter a valid GUID",
      });
      if (val !== undefined) { spTenantId = val.trim() || undefined; }
    } else if (field === "clientId") {
      const val = await vscode.window.showInputBox({
        title: "Service Principal — Client ID",
        prompt: "Application (Client) ID",
        value: spClientId ?? "",
        placeHolder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        ignoreFocusOut: true,
        validateInput: (v) => isGuid(v.trim()) ? undefined : "Enter a valid GUID",
      });
      if (val !== undefined) { spClientId = val.trim() || undefined; }
    } else {
      const val = await vscode.window.showInputBox({
        title: "Service Principal — Client Secret",
        prompt: "Client secret value (stored encrypted in OS keychain)",
        password: true,
        ignoreFocusOut: true,
        validateInput: (v) => v.trim() ? undefined : "Client secret is required",
      });
      if (val !== undefined) { spSecret = val.trim() || undefined; }
    }
  }

  // ── Launch ────────────────────────────────────────────────────────────────
  qp.show();
  navigateTo("method");

  await new Promise<void>((resolve) => {
    qp.onDidHide(resolve);
  });

  cancelRender();
  qp.dispose();
}

// ── Save environment + optional connection test ────────────────────────────────

async function saveEnvironment(
  envManager: IEnvironmentManager,
  env: DataverseEnvironment,
  authSvc: IAuthenticationService,
  secretStorage: SecretStorageService,
  spSecret?: string
): Promise<void> {
  if (env.authMethod === "clientcredentials" && spSecret) {
    await secretStorage.storeClientSecret(env.id, spSecret);
  }

  const whoAmI = await fetchWhoAmI(env, authSvc);
  await authSvc.clearTokens(env); // clear test token so first real use re-acquires cleanly

  const envToSave = whoAmI
    ? { ...env, userId: whoAmI.userId, organizationId: whoAmI.organizationId }
    : env;
  await envManager.save(envToSave);
  Logger.info("Environment added", { name: env.name, method: env.authMethod });

  if (whoAmI) {
    vscode.window.showInformationMessage(`\u2714 Environment "${env.name}" added and connection verified.`);
  } else {
    vscode.window.showWarningMessage(
      `Environment "${env.name}" added, but the connection test failed. ` +
      "Check your credentials — the environment will still appear in the list."
    );
  }
}

// ── Custom URL input (runs after QP is hidden) ────────────────────────────────

async function addCustomEnvironmentInputBoxes(
  envManager: IEnvironmentManager,
  authSvc: IAuthenticationService,
  secretStorage: SecretStorageService,
  method: AuthMethod,
  accountId?: string,
  clientId?: string,
  tenantId?: string,
  spTenantId?: string,
  spClientId?: string,
  spSecret?: string
): Promise<void> {
  const existingUrls = new Set(envManager.getAll().map((e) => e.url.toLowerCase()));

  const url = await vscode.window.showInputBox({
    title: "Add Dataverse Environment — Custom URL",
    prompt: "Dataverse environment URL",
    placeHolder: "https://yourorg.crm.dynamics.com",
    ignoreFocusOut: true,
    validateInput: (v) => {
      try {
        const u = new URL(v.trim());
        if (u.protocol !== "https:") { return "URL must use HTTPS"; }
        if (existingUrls.has(v.trim().replace(/\/$/, "").toLowerCase())) {
          return "This environment is already added";
        }
        return undefined;
      } catch {
        return "Enter a valid URL";
      }
    },
  });
  if (!url) { return; }

  const name = await vscode.window.showInputBox({
    title: "Add Dataverse Environment — Display Name",
    prompt: "Display name for this environment",
    placeHolder: "e.g. Production, Dev, UAT",
    ignoreFocusOut: true,
    validateInput: (v) => (v.trim() ? undefined : "Name is required"),
  });
  if (!name) { return; }

  const env: DataverseEnvironment = {
    id: crypto.randomUUID(),
    name: name.trim(),
    url: url.trim().replace(/\/$/, ""),
    authMethod: method,
    accountId,
    clientId: clientId ?? spClientId,
    tenantId: tenantId ?? spTenantId,
  };

  if (method === "clientcredentials" && spSecret) {
    await secretStorage.storeClientSecret(env.id, spSecret);
  }

  const whoAmI = await fetchWhoAmI(env, authSvc);
  await authSvc.clearTokens(env); // clear test token

  const envToSave = whoAmI
    ? { ...env, userId: whoAmI.userId, organizationId: whoAmI.organizationId }
    : env;
  await envManager.save(envToSave);
  Logger.info("Custom environment added", { name: env.name, method });

  if (whoAmI) {
    vscode.window.showInformationMessage(`\u2714 Environment "${env.name}" added and connection verified.`);
  } else {
    vscode.window.showWarningMessage(
      `Environment "${env.name}" added, but the connection test failed. ` +
      "Check your credentials."
    );
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function isGuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
