import * as vscode from "vscode";
import type { IEnvironmentManager } from "../interfaces";

export class ListEnvironmentsTool implements vscode.LanguageModelTool<Record<string, never>> {
  constructor(private readonly envManager: IEnvironmentManager) {}

  async invoke(
    _options: vscode.LanguageModelToolInvocationOptions<Record<string, never>>,
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const envs = this.envManager.getAll().map((e) => ({
      id: e.id,
      name: e.name,
      url: e.url,
      authMethod: e.authMethod,
    }));

    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(JSON.stringify(envs, null, 2)),
    ]);
  }
}
