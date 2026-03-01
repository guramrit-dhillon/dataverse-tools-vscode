import * as vscode from "vscode";
import {
  DeviceCodeCredential,
  AzureCliCredential,
  ClientSecretCredential,
} from "@azure/identity";
import { type IAuthenticationService } from "../interfaces";
import { type AuthMethod, type DataverseEnvironment, Logger } from "core-dataverse";
import { type SecretStorageService } from "./SecretStorageService";

/** Seconds before JWT expiry at which we proactively refresh. */
const REFRESH_BUFFER_S = 60;

/**
 * Default public client ID used when no custom one is provided.
 * The Azure CLI app is a well-known, pre-registered multi-tenant public
 * client that works with Dataverse `/.default` scopes without requiring
 * the user to register their own application.
 */
const DEFAULT_PUBLIC_CLIENT_ID = "04b07795-8ddb-461a-bbee-02f9e1bf7b46";

interface TokenCacheEntry {
  token: string;
  /** Unix timestamp (ms) when the token expires. */
  expiresAtMs: number;
}

/**
 * Acquires Dataverse access tokens using four pluggable strategies:
 *
 *  - vscode            → VS Code's built-in `microsoft-authentication` provider (browser sign-in)
 *  - azcli             → Azure CLI (`az account get-access-token`) via AzureCliCredential
 *  - devicecode        → MSAL device code flow (headless/SSH; optional custom client ID)
 *  - clientcredentials → Service Principal (client ID + secret stored in SecretStorage)
 *
 * The strategy is chosen per-environment at add-time and stored in
 * `DataverseEnvironment.authMethod`.
 */
export class AuthenticationService implements IAuthenticationService {
  /**
   * DeviceCodeCredential instances keyed by `${tenantId}:${clientId}`.
   * Reusing instances lets MSAL silently refresh tokens without re-prompting.
   */
  private deviceCodeCredMap = new Map<string, DeviceCodeCredential>();

  /** In-process token cache keyed by environment ID. */
  private static readonly tokenCache = new Map<string, TokenCacheEntry>();

  constructor(private readonly secretStorage: SecretStorageService) {}

  async getAccessToken(environment: DataverseEnvironment): Promise<string> {
    const cached = AuthenticationService.tokenCache.get(environment.id);
    if (cached && cached.expiresAtMs - REFRESH_BUFFER_S * 1000 > Date.now()) {
      return cached.token;
    }

    const scope = `${environment.url.replace(/\/$/, "")}/.default`;
    let token: string;

    if (environment.authMethod === "vscode") {
      token = await this.vscodeToken(scope, environment.accountId);
    } else if (environment.authMethod === "clientcredentials") {
      const secret = await this.secretStorage.getClientSecret(environment.id);
      if (!secret) {
        throw new Error(
          `No client secret found for "${environment.name}". ` +
          "Remove and re-add the environment to re-enter credentials."
        );
      }
      token = await this.clientCredentialsToken(scope, environment.tenantId!, environment.clientId!, secret);
    } else {
      token = await this.getTokenForMethod(environment.authMethod, scope, environment.clientId, environment.tenantId);
    }

    AuthenticationService.tokenCache.set(environment.id, {
      token,
      expiresAtMs: AuthenticationService.decodeExpiry(token),
    });
    return token;
  }

  async getTokenForMethod(method: AuthMethod, scope: string, clientId?: string, tenantId?: string): Promise<string> {
    switch (method) {
      case "vscode":            return this.vscodeToken(scope);
      case "azcli":             return this.azCliToken(scope, tenantId);
      case "devicecode":        return this.deviceCodeToken(scope, clientId, tenantId);
      case "clientcredentials": throw new Error("Use getAccessToken() for clientcredentials — secret is required.");
      default: throw new Error(`Unknown auth method: ${method as string}`);
    }
  }

  async clearTokens(environment: DataverseEnvironment): Promise<void> {
    AuthenticationService.tokenCache.delete(environment.id);

    if (environment.authMethod === "devicecode") {
      const credKey = this.credKey(environment.tenantId, environment.clientId);
      this.deviceCodeCredMap.delete(credKey);
    }

    Logger.info("Tokens cleared", { env: environment.name });
  }

  async clearAllTokens(): Promise<void> {
    AuthenticationService.tokenCache.clear();
    this.deviceCodeCredMap.clear();
    Logger.info("All tokens cleared");
  }

  /** Decodes the `exp` claim from a JWT without verifying the signature. */
  private static decodeExpiry(token: string): number {
    try {
      const payload = token.split(".")[1];
      if (payload) {
        const json = Buffer.from(payload, "base64").toString("utf8");
        const { exp } = JSON.parse(json) as { exp?: number };
        if (typeof exp === "number") { return exp * 1000; }
      }
    } catch { /* ignore — treat as already expired */ }
    return Date.now();
  }

  private credKey(tenantId?: string, clientId?: string): string {
    return `${tenantId ?? "organizations"}:${clientId ?? "default"}`;
  }

  // ── Private token strategies ──────────────────────────────────────────────

  private async vscodeToken(scope: string, accountId?: string): Promise<string> {
    // If we have a bound account, try it silently first.
    if (accountId) {
      try {
        const all = await vscode.authentication.getAccounts("microsoft");
        const account = all.find((a) => a.id === accountId);
        if (account) {
          const session = await vscode.authentication.getSession("microsoft", [scope], {
            account,
            silent: true,
          });
          if (session) { return session.accessToken; }
        }
      } catch { /* fall through to interactive */ }
    }

    // Interactive fallback (or first-time sign-in).
    try {
      const session = await vscode.authentication.getSession("microsoft", [scope], {
        createIfNone: true,
      });
      if (session) { return session.accessToken; }
    } catch (err) {
      Logger.warn("VS Code auth failed", { error: String(err) });
    }
    throw new Error(
      "VS Code authentication failed. Sign in via the Accounts menu (bottom-left of the status bar)."
    );
  }

  private async azCliToken(scope: string, tenantId?: string): Promise<string> {
    try {
      // Pass tenantId so users with multiple tenants get the right one.
      // AzureCliCredential also respects AZURE_CONFIG_DIR automatically.
      const cred = new AzureCliCredential(tenantId ? { tenantId } : undefined);
      const token = await cred.getToken(scope);
      if (token?.token) { return token.token; }
    } catch (err) {
      Logger.warn("Azure CLI auth failed", { error: String(err) });
      throw new Error(
        `Azure CLI authentication failed: ${err instanceof Error ? err.message : String(err)}. ` +
        "Run `az login` and try again."
      );
    }
    throw new Error("Azure CLI returned no token. Run `az login` and try again.");
  }

  private async deviceCodeToken(scope: string, clientId?: string, tenantId?: string): Promise<string> {
    const key = this.credKey(tenantId, clientId);

    if (!this.deviceCodeCredMap.has(key)) {
      this.deviceCodeCredMap.set(key, new DeviceCodeCredential({
        clientId: clientId ?? DEFAULT_PUBLIC_CLIENT_ID,
        tenantId: tenantId ?? "organizations",
        userPromptCallback: (info) => {
          Logger.info(info.message);
          vscode.window.showInformationMessage(
            `Dataverse sign-in: enter code **${info.userCode}** at ${info.verificationUri}`,
            "Copy Code",
            "Open Browser"
          ).then((choice) => {
            if (choice === "Copy Code") {
              vscode.env.clipboard.writeText(info.userCode);
            } else if (choice === "Open Browser") {
              vscode.env.openExternal(vscode.Uri.parse(info.verificationUri));
            }
          });
        },
      }));
    }

    try {
      const token = await this.deviceCodeCredMap.get(key)!.getToken(scope);
      if (token?.token) { return token.token; }
    } catch (err) {
      Logger.warn("Device code auth failed — resetting credential", { error: String(err) });
      this.deviceCodeCredMap.delete(key);
      throw new Error(
        `Device code authentication failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    throw new Error("Device code authentication returned no token.");
  }

  private async clientCredentialsToken(scope: string, tenantId: string, clientId: string, clientSecret: string): Promise<string> {
    try {
      const cred = new ClientSecretCredential(tenantId, clientId, clientSecret);
      const token = await cred.getToken(scope);
      if (token?.token) { return token.token; }
    } catch (err) {
      Logger.warn("Service Principal auth failed", { error: String(err) });
      throw new Error(
        `Service Principal authentication failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    throw new Error("Service Principal authentication returned no token.");
  }
}
