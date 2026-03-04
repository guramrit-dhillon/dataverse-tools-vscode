import {
  DataverseWebApiClient,
  SolutionComponentType,
  WorkflowStateCode,
  WorkflowType,
  type DataverseEnvironment,
  type WorkflowProcess,
} from "core-dataverse";
import type { IWorkflowService } from "../interfaces/IWorkflowService";

export class WorkflowService implements IWorkflowService {
  constructor(
    private readonly getToken: (env: DataverseEnvironment) => Promise<string>,
  ) {}

  private client(env: DataverseEnvironment): DataverseWebApiClient {
    return new DataverseWebApiClient(env, this.getToken);
  }

  async listWorkflows(
    env: DataverseEnvironment,
    solutionId?: string,
    includeAllComponents = false,
    componentScope: "all" | "unmanaged" = "all",
  ): Promise<WorkflowProcess[]> {
    const components = await this.client(env).getSolutionComponents(
      solutionId,
      [SolutionComponentType.Workflow],
      includeAllComponents,
      componentScope,
    );

    return components
      .map((c): WorkflowProcess => ({
        workflowid: c.objectId,
        name: c.name,
        uniquename: c.uniqueName,
        category: c.category ?? 0,
        type: (c.subType ?? WorkflowType.Definition) as WorkflowType,
        statecode: c.status ?? 0,
        statuscode: c.statusCode ?? 0,
        primaryentity: c.primaryEntityName ?? "none",
        ismanaged: c.isManaged ?? undefined,
        hasactivecustomization: c.hasActiveCustomization,
        description: c.description,
        modifiedon: c.modifiedOn,
        createdon: c.createdOn,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async activateWorkflow(env: DataverseEnvironment, workflowId: string): Promise<void> {
    await this.client(env).patch(`workflows(${workflowId})`, {
      statecode: WorkflowStateCode.Activated,
      statuscode: 2,
    });
  }

  async deactivateWorkflow(env: DataverseEnvironment, workflowId: string): Promise<void> {
    await this.client(env).patch(`workflows(${workflowId})`, {
      statecode: WorkflowStateCode.Draft,
      statuscode: 1,
    });
  }

  async deleteWorkflow(env: DataverseEnvironment, workflowId: string): Promise<void> {
    await this.client(env).delete(`workflows(${workflowId})`);
  }

  async triggerOnDemand(
    env: DataverseEnvironment,
    workflowId: string,
    entityId: string,
  ): Promise<void> {
    await this.client(env).post(
      `workflows(${workflowId})/Microsoft.Dynamics.CRM.ExecuteWorkflow`,
      { EntityId: entityId },
    );
  }
}
