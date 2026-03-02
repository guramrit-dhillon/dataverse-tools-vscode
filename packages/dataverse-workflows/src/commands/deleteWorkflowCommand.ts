import * as vscode from "vscode";
import { WorkflowStateCode, type DataverseEnvironment, type WorkflowProcess } from "core-dataverse";
import type { IWorkflowService } from "../interfaces/IWorkflowService";

export async function deleteWorkflowCommand(
  svc: IWorkflowService,
  onRefresh: () => void,
  workflow: WorkflowProcess,
  env: DataverseEnvironment | undefined,
): Promise<void> {
  if (!env) { return; }

  if (workflow.statecode === WorkflowStateCode.Activated) {
    vscode.window.showWarningMessage(
      `"${workflow.name}" must be deactivated before it can be deleted.`,
    );
    return;
  }

  const confirm = await vscode.window.showWarningMessage(
    `Delete "${workflow.name}"? This cannot be undone.`,
    { modal: true },
    "Delete",
  );
  if (confirm !== "Delete") { return; }

  await svc.deleteWorkflow(env, workflow.workflowid);
  onRefresh();
  vscode.window.showInformationMessage(`"${workflow.name}" deleted.`);
}
