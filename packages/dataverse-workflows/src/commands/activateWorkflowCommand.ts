import * as vscode from "vscode";
import type { DataverseEnvironment, WorkflowProcess } from "core-dataverse";
import type { IWorkflowService } from "../interfaces/IWorkflowService";

export async function activateWorkflowCommand(
  svc: IWorkflowService,
  onRefresh: () => void,
  workflow: WorkflowProcess,
  env: DataverseEnvironment | undefined,
): Promise<void> {
  if (!env) { return; }

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: `Activating "${workflow.name}"…` },
    () => svc.activateWorkflow(env, workflow.workflowid),
  );
  onRefresh();
  vscode.window.showInformationMessage(`"${workflow.name}" activated.`);
}
