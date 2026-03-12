import {
  DataverseWebApiClient,
  SolutionComponentType,
  WorkflowCategory,
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

  async listWorkflowsByEntity(
    env: DataverseEnvironment,
    entityLogicalName: string,
  ): Promise<WorkflowProcess[]> {
    const select = "$select=workflowid,name,uniquename,category,type,statecode,statuscode,primaryentity,ismanaged,description,modifiedon,createdon";
    const filter = `$filter=primaryentity eq '${entityLogicalName}' and type eq 1 and category ne ${WorkflowCategory.ModernFlow}`;
    const records = await this.client(env).getAll<WorkflowProcess>(
      "workflows",
      `${select}&${filter}`,
    );
    return records.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getWorkflow(env: DataverseEnvironment, workflowId: string): Promise<WorkflowProcess> {
    return this.client(env).get<WorkflowProcess>(
      `workflows(${workflowId})?$select=workflowid,name,uniquename,category,type,statecode,statuscode,primaryentity,ismanaged,description,modifiedon,createdon`,
    );
  }

  async getWorkflowXaml(env: DataverseEnvironment, workflowId: string): Promise<string> {
    const result = await this.client(env).get<{ xaml?: string }>(
      `workflows(${workflowId})?$select=xaml`,
    );
    return result.xaml ?? "";
  }

  async updateWorkflow(env: DataverseEnvironment, workflowId: string, updates: Partial<WorkflowProcess>): Promise<void> {
    await this.client(env).patch(`workflows(${workflowId})`, updates);
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
