import {
  DataverseWebApiClient,
  WorkflowStateCode,
  WorkflowType,
  type DataverseEnvironment,
  type WorkflowProcess,
} from "core-dataverse";
import type { IWorkflowService } from "../interfaces/IWorkflowService";

const SELECT_FIELDS = [
  "workflowid",
  "name",
  "uniquename",
  "category",
  "type",
  "statecode",
  "statuscode",
  "primaryentity",
  "ismanaged",
  "description",
  "modifiedon",
  "createdon",
  "_ownerid_value",
].join(",");

export class WorkflowService implements IWorkflowService {
  constructor(
    private readonly getToken: (env: DataverseEnvironment) => Promise<string>,
  ) {}

  private client(env: DataverseEnvironment): DataverseWebApiClient {
    return new DataverseWebApiClient(env, this.getToken);
  }

  async listWorkflows(env: DataverseEnvironment): Promise<WorkflowProcess[]> {
    return this.client(env).getAll<WorkflowProcess>(
      "workflows",
      `$select=${SELECT_FIELDS}&$filter=type eq ${WorkflowType.Definition}&$orderby=name`,
    );
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
