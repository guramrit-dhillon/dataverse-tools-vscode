import * as vscode from "vscode";
import {
  Logger,
  ExtensionIds,
  type DataverseAccountApi,
  type ExplorerNode,
  registerCommand,
} from "core-dataverse";
import { Commands } from "./constants";
import type { WorkflowProcess } from "./types/dataverse";
import { ServiceContainer } from "./container/ServiceContainer";
import { activateWorkflowCommand } from "./commands/activateWorkflowCommand";
import { deactivateWorkflowCommand } from "./commands/deactivateWorkflowCommand";
import { deleteWorkflowCommand } from "./commands/deleteWorkflowCommand";
import { triggerWorkflowCommand } from "./commands/triggerWorkflowCommand";
import { workflowPropertiesWizard } from "./commands/workflowPropertiesWizard";
import { openWorkflowXamlCommand, WorkflowXamlContentProvider, WORKFLOW_XAML_SCHEME } from "./commands/openWorkflowXamlCommand";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const outputChannel = vscode.window.createOutputChannel("Dataverse Tools: Workflows");
  Logger.init(outputChannel);
  context.subscriptions.push(outputChannel);

  Logger.info("Dataverse Tools: Workflows extension activating…");

  const accountExt = vscode.extensions.getExtension<DataverseAccountApi>(
    ExtensionIds.Environments,
  );
  if (!accountExt) {
    vscode.window.showErrorMessage(
      "Dataverse Tools: Workflows requires the Dataverse Tools: Environments extension.",
    );
    return;
  }
  const api = accountExt.isActive ? accountExt.exports : await accountExt.activate();

  const container = new ServiceContainer(api);

  context.subscriptions.push(
    api.explorer.registerProvider(container.workflowsProvider),
  );

  const xamlProvider = new WorkflowXamlContentProvider();
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(WORKFLOW_XAML_SCHEME, xamlProvider),
  );

  const refresh = () => api.explorer.refresh("workflows");
  const getEnv = () => api.explorer.getContext()?.environment;

  registerCommand(context, Commands.WorkflowActivate, (arg: unknown) => {
    const w = extractWorkflow(arg);
    if (!w) { return; }
    return activateWorkflowCommand(container.workflowService, refresh, w, getEnv());
  });

  registerCommand(context, Commands.WorkflowDeactivate, (arg: unknown) => {
    const w = extractWorkflow(arg);
    if (!w) { return; }
    return deactivateWorkflowCommand(container.workflowService, refresh, w, getEnv());
  });

  registerCommand(context, Commands.WorkflowDelete, (arg: unknown) => {
    const w = extractWorkflow(arg);
    if (!w) { return; }
    return deleteWorkflowCommand(container.workflowService, refresh, w, getEnv());
  });

  registerCommand(context, Commands.WorkflowTriggerOnDemand, (arg: unknown) => {
    const w = extractWorkflow(arg);
    if (!w) { return; }
    return triggerWorkflowCommand(container.workflowService, w, getEnv());
  });

  registerCommand(context, Commands.WorkflowEditProperties, (arg: unknown) => {
    const w = extractWorkflow(arg);
    if (!w) { return; }
    return workflowPropertiesWizard(container.workflowService, refresh, w, getEnv());
  });

  registerCommand(context, Commands.WorkflowOpenXaml, (arg: unknown) => {
    const w = extractWorkflow(arg);
    if (!w) { return; }
    return openWorkflowXamlCommand(container.workflowService, xamlProvider, w, getEnv());
  });

  Logger.info("Dataverse Tools: Workflows extension activated.");
}

export function deactivate(): void {
  Logger.info("Dataverse Tools: Workflows extension deactivated.");
}

function extractNode(arg: unknown): ExplorerNode | undefined {
  if (arg && typeof arg === "object" && "node" in arg) {
    return (arg as { node?: ExplorerNode }).node ?? undefined;
  }
  return undefined;
}

function extractWorkflow(arg: unknown): WorkflowProcess | undefined {
  const node = extractNode(arg);
  return (node?.data?.workflow as WorkflowProcess) ?? undefined;
}
