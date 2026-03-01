import type * as vscode from "vscode";

const KEY_PREFIX = "dataverse-tools:env:";
const KEY_SUFFIX = ":secret";

/**
 * Thin wrapper around VS Code's SecretStorage API.
 *
 * Secrets (e.g. client credentials) are stored encrypted in the OS keychain
 * and never written to global state. Each entry is keyed by environment ID.
 */
export class SecretStorageService {
  constructor(private readonly secrets: vscode.SecretStorage) {}

  storeClientSecret(environmentId: string, secret: string): Promise<void> {
    return this.secrets.store(this.key(environmentId), secret);
  }

  getClientSecret(environmentId: string): Promise<string | undefined> {
    return this.secrets.get(this.key(environmentId));
  }

  deleteClientSecret(environmentId: string): Promise<void> {
    return this.secrets.delete(this.key(environmentId));
  }

  private key(environmentId: string): string {
    return `${KEY_PREFIX}${environmentId}${KEY_SUFFIX}`;
  }
}
