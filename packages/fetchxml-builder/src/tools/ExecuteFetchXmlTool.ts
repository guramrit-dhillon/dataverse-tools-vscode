import * as vscode from "vscode";
import {
  type DataverseAccountApi,
  type DataverseEnvironment,
} from "core-dataverse";
import { FetchXmlExecutor } from "../services/FetchXmlExecutor";
import { parseFetchXml } from "../model/FetchXmlSerializer";

interface ExecuteFetchXmlInput {
  environmentId: string;
  fetchXml: string;
}

export class ExecuteFetchXmlTool implements vscode.LanguageModelTool<ExecuteFetchXmlInput> {
  constructor(private readonly accountApi: DataverseAccountApi) {}

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<ExecuteFetchXmlInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    const env = this.accountApi.getEnvironments().find(
      (e) => e.id === options.input.environmentId
    );
    const envName = env?.name ?? options.input.environmentId;

    return {
      confirmationMessages: {
        title: "Execute FetchXML Query",
        message: new vscode.MarkdownString(
          `Execute a FetchXML query against **${envName}** (${env?.url ?? "unknown URL"})?\n\n\`\`\`xml\n${options.input.fetchXml}\n\`\`\``
        ),
      },
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<ExecuteFetchXmlInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const { environmentId, fetchXml } = options.input;

    const env = this.accountApi.getEnvironments().find(
      (e) => e.id === environmentId
    );
    if (!env) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`No environment found with ID "${environmentId}".`),
      ]);
    }

    const root = parseFetchXml(fetchXml);
    if (!root) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          "Invalid FetchXML. Ensure it starts with a valid <fetch> element containing an <entity> child."
        ),
      ]);
    }

    try {
      const executor = new FetchXmlExecutor(
        this.accountApi.getAccessToken.bind(this.accountApi)
      );
      const results = await executor.execute(env, root);

      const output = {
        rowCount: results.rows.length,
        columns: results.columns,
        rows: results.rows,
        totalCount: results.totalCount,
        durationMs: results.durationMs,
      };

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify(output, null, 2)),
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`FetchXML execution failed: ${message}`),
      ]);
    }
  }
}
