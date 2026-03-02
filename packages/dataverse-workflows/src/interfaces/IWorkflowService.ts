import type { DataverseEnvironment, WorkflowProcess } from "core-dataverse";

export interface IWorkflowService {
  listWorkflows(env: DataverseEnvironment): Promise<WorkflowProcess[]>;
  activateWorkflow(env: DataverseEnvironment, workflowId: string): Promise<void>;
  deactivateWorkflow(env: DataverseEnvironment, workflowId: string): Promise<void>;
  deleteWorkflow(env: DataverseEnvironment, workflowId: string): Promise<void>;
  triggerOnDemand(env: DataverseEnvironment, workflowId: string, entityId: string): Promise<void>;
}
