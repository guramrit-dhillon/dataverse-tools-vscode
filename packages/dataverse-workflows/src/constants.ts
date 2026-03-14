/** Command IDs owned by the Workflows extension. */
export const Commands = {
  WorkflowActivate: "dataverse-tools.workflows.activate",
  WorkflowDeactivate: "dataverse-tools.workflows.deactivate",
  WorkflowDelete: "dataverse-tools.workflows.delete",
  WorkflowTriggerOnDemand: "dataverse-tools.workflows.triggerOnDemand",
  WorkflowEditProperties: "dataverse-tools.workflows.editProperties",
  WorkflowOpenXaml: "dataverse-tools.workflows.openXaml",
  /** Registered by dataverse-workflows; activates dataverse-workflow-designer if installed. */
  WorkflowDesign: "dataverse-tools.workflows.design",
  // ── Workflow Designer ──────────────────────────────────────────────────
  WorkflowDesignerOpen: "dataverse-tools.workflowDesigner.open",
  WorkflowDesignerDesign: "dataverse-tools.workflowDesigner.design",
  WorkflowDesignerSave: "dataverse-tools.workflowDesigner.save",
} as const;
