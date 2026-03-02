import * as vscode from "vscode";
import type { DataverseEnvironment, WorkflowProcess } from "core-dataverse";
import type { IWorkflowService } from "../interfaces/IWorkflowService";

export async function deactivateWorkflowCommand(
  svc: IWorkflowService,
  onRefresh: () => void,
  workflow: WorkflowProcess,
  env: DataverseEnvironment | undefined,
): Promise<void> {
  if (!env) { return; }

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: `Deactivating "${workflow.name}"…` },
    () => svc.deactivateWorkflow(env, workflow.workflowid),
  );
  onRefresh();
  vscode.window.showInformationMessage(`"${workflow.name}" deactivated.`);
}
