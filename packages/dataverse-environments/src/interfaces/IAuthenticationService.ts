import { type AuthMethod, type DataverseEnvironment } from "core-dataverse";

export interface IAuthenticationService {
  /** Get a Dataverse access token for a configured environment. */
  getAccessToken(environment: DataverseEnvironment): Promise<string>;

  /**
   * Get a token for any scope using a specific auth method.
   * Used during the "add environment" discovery step before the environment is saved.
   */
  getTokenForMethod(method: AuthMethod, scope: string, clientId?: string, tenantId?: string): Promise<string>;

  clearTokens(environment: DataverseEnvironment): Promise<void>;
  clearAllTokens(): Promise<void>;
}
