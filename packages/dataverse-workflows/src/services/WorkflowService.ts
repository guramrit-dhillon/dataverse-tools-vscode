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

  async listWorkflows(env: DataverseEnvironment, solutionId?: string): Promise<WorkflowProcess[]> {
    if (solutionId) {
      return this.listWorkflowsBySolution(env, solutionId);
    }
    return this.client(env).getAll<WorkflowProcess>(
      "workflows",
      `$select=${SELECT_FIELDS}&$filter=type eq ${WorkflowType.Definition}&$orderby=name`,
    );
  }

  /**
   * Fetch workflows that belong to a specific solution via
   * `msdyn_solutioncomponentsummaries` (component type 29 = Process).
   */
  private async listWorkflowsBySolution(
    env: DataverseEnvironment,
    solutionId: string,
  ): Promise<WorkflowProcess[]> {
    const client = this.client(env);

    // msdyn_componenttype 29 = Process/Workflow in solution component summaries
    const filter = `(msdyn_solutionid eq ${solutionId}) and (msdyn_componenttype eq 29)`;
    const result = await client.get<{ value: { msdyn_objectid: string }[] }>(
      `msdyn_solutioncomponentsummaries?$filter=${filter}&$select=msdyn_objectid`,
    );

    if (result.value.length === 0) { return []; }

    const ids = new Set(result.value.map((c) => c.msdyn_objectid));

    // Fetch full workflow records for these IDs
    const all = await client.getAll<WorkflowProcess>(
      "workflows",
      `$select=${SELECT_FIELDS}&$filter=type eq ${WorkflowType.Definition}&$orderby=name`,
    );

    return all.filter((w) => ids.has(w.workflowid));
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
