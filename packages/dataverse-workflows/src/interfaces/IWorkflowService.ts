import type { DataverseEnvironment } from "core-dataverse";
import type { WorkflowProcess } from "../types/dataverse";

export interface IWorkflowService {
  listWorkflows(env: DataverseEnvironment, solutionId?: string, includeAllComponents?: boolean, componentScope?: "all" | "unmanaged"): Promise<WorkflowProcess[]>;
  listWorkflowsByEntity(env: DataverseEnvironment, entityLogicalName: string): Promise<WorkflowProcess[]>;
  getWorkflow(env: DataverseEnvironment, workflowId: string): Promise<WorkflowProcess>;
  getWorkflowXaml(env: DataverseEnvironment, workflowId: string): Promise<string>;
  updateWorkflow(env: DataverseEnvironment, workflowId: string, updates: Partial<WorkflowProcess>): Promise<void>;
  activateWorkflow(env: DataverseEnvironment, workflowId: string): Promise<void>;
  deactivateWorkflow(env: DataverseEnvironment, workflowId: string): Promise<void>;
  deleteWorkflow(env: DataverseEnvironment, workflowId: string): Promise<void>;
  triggerOnDemand(env: DataverseEnvironment, workflowId: string, entityId: string): Promise<void>;
}
