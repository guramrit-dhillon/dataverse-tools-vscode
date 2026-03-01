import * as vscode from "vscode";
import type { IAuthenticationService, IEnvironmentManager } from "../interfaces";
import { fetchWhoAmI } from "../commands/testConnectionCommand";

interface TestConnectionInput {
  environmentId: string;
}

export class TestConnectionTool implements vscode.LanguageModelTool<TestConnectionInput> {
  constructor(
    private readonly envManager: IEnvironmentManager,
    private readonly authService: IAuthenticationService
  ) {}

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<TestConnectionInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    const env = this.envManager.getAll().find((e) => e.id === options.input.environmentId);
    const envName = env?.name ?? options.input.environmentId;

    return {
      confirmationMessages: {
        title: "Test Dataverse Connection",
        message: new vscode.MarkdownString(
          `Make a WhoAmI API call to **${envName}** (${env?.url ?? "unknown URL"})?`
        ),
      },
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<TestConnectionInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const { environmentId } = options.input;
    const env = this.envManager.getAll().find((e) => e.id === environmentId);

    if (!env) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`No environment found with ID "${environmentId}".`),
      ]);
    }

    const result = await fetchWhoAmI(env, this.authService);

    if (!result) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `Connection test failed for "${env.name}" (${env.url}). Could not authenticate or reach the WhoAmI endpoint.`
        ),
      ]);
    }

    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(
        JSON.stringify(
          {
            status: "connected",
            environment: env.name,
            url: env.url,
            userId: result.userId,
            organizationId: result.organizationId,
          },
          null,
          2
        )
      ),
    ]);
  }
}
