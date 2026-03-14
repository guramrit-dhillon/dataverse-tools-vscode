/**
 * Dataverse entity types specific to workflow/process management.
 * Aligned with the Web API OData schema — property names use Dataverse logical names.
 */

/** A Dataverse process from the `workflows` entity set. */
export interface WorkflowProcess {
  workflowid: string;
  name: string;
  uniquename?: string;
  /** 0=Workflow, 1=Dialog, 2=BusinessRule, 3=Action, 4=BPF, 5=ModernFlow */
  category: WorkflowCategory;
  /** 1=Definition, 2=Activation, 3=Template */
  type: WorkflowType;
  /** 0=Draft, 1=Activated */
  statecode: WorkflowStateCode;
  statuscode: number;
  primaryentity: string;
  ismanaged?: boolean;
  hasactivecustomization?: boolean;
  description?: string;
  modifiedon?: string;
  createdon?: string;
  _ownerid_value?: string;
}

export const enum WorkflowCategory {
  Workflow = 0,
  Dialog = 1,
  BusinessRule = 2,
  Action = 3,
  BPF = 4,
  ModernFlow = 5,
}

export const enum WorkflowType {
  Definition = 1,
  Activation = 2,
  Template = 3,
}

export const enum WorkflowStateCode {
  Draft = 0,
  Activated = 1,
}
