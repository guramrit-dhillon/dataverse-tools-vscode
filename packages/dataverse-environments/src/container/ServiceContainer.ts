import type * as vscode from "vscode";
import { type IAuthenticationService, type IEnvironmentManager } from "../interfaces";
import { AuthenticationService } from "../services/AuthenticationService";
import { EnvironmentManager } from "../services/EnvironmentManager";
import { SecretStorageService } from "../services/SecretStorageService";
import { EnvironmentTreeProvider } from "../providers/EnvironmentTreeProvider";
import { ContributionRegistry } from "../framework/ContributionRegistry";

/**
 * DI container for the Dataverse Environments extension.
 * Owns authentication, environment management, and the explorer tree framework.
 */
export class ServiceContainer {
  readonly authService: IAuthenticationService;
  readonly envManager: IEnvironmentManager;
  readonly secretStorage: SecretStorageService;
  readonly environmentTreeProvider: EnvironmentTreeProvider;
  readonly registry: ContributionRegistry;

  constructor(context: vscode.ExtensionContext) {
    this.secretStorage = new SecretStorageService(context.secrets);
    this.authService = new AuthenticationService(this.secretStorage);
    this.envManager = new EnvironmentManager(context.globalState);
    this.environmentTreeProvider = new EnvironmentTreeProvider(this.envManager);
    this.registry = new ContributionRegistry();
  }
}
