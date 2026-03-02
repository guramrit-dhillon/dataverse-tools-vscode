import type { DataverseAccountApi } from "core-dataverse";
import { WorkflowService } from "../services/WorkflowService";
import { WorkflowsNodeProvider } from "../providers/WorkflowsNodeProvider";
import type { IWorkflowService } from "../interfaces/IWorkflowService";

export class ServiceContainer {
  readonly workflowService: IWorkflowService;
  readonly workflowsProvider: WorkflowsNodeProvider;

  constructor(api: DataverseAccountApi) {
    this.workflowService = new WorkflowService(api.getAccessToken.bind(api));
    this.workflowsProvider = new WorkflowsNodeProvider(this.workflowService);
  }
}
