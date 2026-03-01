import * as vscode from "vscode";
import type { IEnvironmentManager } from "../interfaces";

interface GetEnvironmentDetailsInput {
  environmentId: string;
}

export class GetEnvironmentDetailsTool implements vscode.LanguageModelTool<GetEnvironmentDetailsInput> {
  constructor(private readonly envManager: IEnvironmentManager) {}

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<GetEnvironmentDetailsInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const { environmentId } = options.input;
    const env = this.envManager.getAll().find((e) => e.id === environmentId);

    if (!env) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`No environment found with ID "${environmentId}".`),
      ]);
    }

    const details = {
      id: env.id,
      name: env.name,
      url: env.url,
      authMethod: env.authMethod,
      tenantId: env.tenantId ?? null,
      clientId: env.clientId ?? null,
      userId: env.userId ?? null,
      organizationId: env.organizationId ?? null,
    };

    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(JSON.stringify(details, null, 2)),
    ]);
  }
}
