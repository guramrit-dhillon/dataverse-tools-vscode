import * as vscode from "vscode";
import { type AuthMethod, type DataverseEnvironment } from "core-dataverse";

const METHOD_LABELS: Record<AuthMethod, string> = {
  vscode:           "VS Code",
  azcli:            "Azure CLI",
  clientcredentials:"Service Principal",
  devicecode:       "Device Code",
};

/**
 * Tree item for the Environments panel.
 * Each item wraps exactly one DataverseEnvironment (or is an empty placeholder).
 */
export class EnvironmentTreeItem extends vscode.TreeItem {
  readonly environment?: DataverseEnvironment;

  private constructor(params: {
    label: string;
    environment?: DataverseEnvironment;
    description?: string;
    tooltip?: string;
    iconPath?: vscode.ThemeIcon;
    contextValue?: string;
  }) {
    super(params.label, vscode.TreeItemCollapsibleState.None);
    this.environment = params.environment;
    this.description = params.description;
    this.tooltip = params.tooltip;
    this.iconPath = params.iconPath;
    this.contextValue = params.contextValue ?? "empty";
  }

  static create(env: DataverseEnvironment): EnvironmentTreeItem {
    const methodLabel = METHOD_LABELS[env.authMethod] ?? env.authMethod;

    return new EnvironmentTreeItem({
      label: env.name,
      environment: env,
      description: `${methodLabel} · ${new URL(env.url).hostname}`,
      tooltip: [
        env.name,
        env.url,
        `Auth: ${methodLabel}`,
        env.tenantId  ? `Tenant: ${env.tenantId}`  : undefined,
        env.clientId  ? `Client: ${env.clientId}`  : undefined,
      ].filter(Boolean).join("\n"),
      iconPath: new vscode.ThemeIcon("plug"),
      contextValue: "environment",
    });
  }

  static empty(message: string): EnvironmentTreeItem {
    return new EnvironmentTreeItem({
      label: message,
      iconPath: new vscode.ThemeIcon("info"),
      contextValue: "empty",
    });
  }
}
