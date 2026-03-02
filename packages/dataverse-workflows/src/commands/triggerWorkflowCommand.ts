import * as vscode from "vscode";
import type { DataverseEnvironment, WorkflowProcess } from "core-dataverse";
import type { IWorkflowService } from "../interfaces/IWorkflowService";

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function triggerWorkflowCommand(
  svc: IWorkflowService,
  workflow: WorkflowProcess,
  env: DataverseEnvironment | undefined,
): Promise<void> {
  if (!env) { return; }

  const entityId = await vscode.window.showInputBox({
    title: `Trigger: "${workflow.name}"`,
    prompt: `Enter the GUID of the ${workflow.primaryentity} record to run this workflow on`,
    placeHolder: "00000000-0000-0000-0000-000000000000",
    validateInput: (v) => GUID_RE.test(v.trim()) ? undefined : "Enter a valid GUID.",
  });
  if (!entityId) { return; }

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: `Triggering "${workflow.name}"…` },
    () => svc.triggerOnDemand(env, workflow.workflowid, entityId.trim()),
  );
  vscode.window.showInformationMessage(`Workflow "${workflow.name}" triggered successfully.`);
}
