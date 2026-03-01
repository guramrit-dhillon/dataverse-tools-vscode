import * as vscode from "vscode";
import { type IAuthenticationService, type IEnvironmentManager } from "../interfaces";
import { type DataverseEnvironment, Logger } from "core-dataverse";

export interface WhoAmIResult {
  userId: string;
  organizationId: string;
}

/**
 * Calls the WhoAmI endpoint and returns the user + org IDs, or null on failure.
 * Does not show any UI — callers decide what to do with the result.
 */
export async function fetchWhoAmI(
  env: DataverseEnvironment,
  authSvc: IAuthenticationService
): Promise<WhoAmIResult | null> {
  try {
    const token = await authSvc.getAccessToken(env);
    const url = `${env.url.replace(/\/$/, "")}/api/data/v9.2/WhoAmI`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) { return null; }
    const data = await res.json() as { UserId: string; OrganizationId: string };
    return { userId: data.UserId, organizationId: data.OrganizationId };
  } catch {
    return null;
  }
}

/**
 * Tests connectivity to a Dataverse environment by acquiring a token and
 * calling the lightweight WhoAmI endpoint. Shows a notification with the result.
 * If envManager is provided, persists the WhoAmI user/org IDs on success.
 */
export async function testConnectionCommand(
  env: DataverseEnvironment,
  authSvc: IAuthenticationService,
  envManager?: IEnvironmentManager
): Promise<void> {
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Testing connection to "${env.name}"…`,
      cancellable: false,
    },
    async () => {
      const start = Date.now();
      try {
        const result = await fetchWhoAmI(env, authSvc);
        const latencyMs = Date.now() - start;

        if (!result) {
          throw new Error("WhoAmI returned no data");
        }

        Logger.info("Connection test passed", { env: env.name, userId: result.userId, latencyMs });

        if (envManager) {
          await envManager.save({ ...env, userId: result.userId, organizationId: result.organizationId });
        }

        vscode.window.showInformationMessage(
          `\u2714 Connected to "${env.name}" (${latencyMs} ms)`
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        Logger.warn("Connection test failed", { env: env.name, error: msg });
        vscode.window.showErrorMessage(`Connection failed for "${env.name}": ${msg}`);
      }
    }
  );
}

/**
 * Inline connection test used at the end of the Add/Edit wizard.
 * Returns "ok" | "failed" without showing a notification (caller shows the result).
 */
export async function testEnvConnection(
  env: DataverseEnvironment,
  authSvc: IAuthenticationService
): Promise<"ok" | "failed"> {
  const result = await fetchWhoAmI(env, authSvc);
  return result ? "ok" : "failed";
}
