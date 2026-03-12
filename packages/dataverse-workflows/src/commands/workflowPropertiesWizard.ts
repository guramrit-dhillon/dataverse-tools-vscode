import * as vscode from "vscode";
import {
  type DataverseEnvironment,
  type WorkflowProcess,
  type WizardPage,
  WorkflowCategory,
  WorkflowStateCode,
  runWizard,
  Logger,
} from "core-dataverse";
import { type IWorkflowService } from "../interfaces/IWorkflowService";

// ── Wizard state ──────────────────────────────────────────────────────────────

interface WorkflowWizardState {
  name: string;
  description: string;
  /** Tracks which summary action was last navigated from. */
  lastAction: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<number, string> = {
  [WorkflowCategory.Workflow]: "Classic Workflow",
  [WorkflowCategory.Dialog]: "Dialog",
  [WorkflowCategory.BusinessRule]: "Business Rule",
  [WorkflowCategory.Action]: "Action",
  [WorkflowCategory.BPF]: "Business Process Flow",
  [WorkflowCategory.ModernFlow]: "Modern Flow",
};

// ── Summary page ──────────────────────────────────────────────────────────────

const FIELD_ORDER = [
  "edit-name",
  "edit-description",
  "confirm",
] as const;

function summaryPage(workflow: WorkflowProcess, readonly: boolean): WizardPage<WorkflowWizardState> {
  const activated = workflow.statecode === WorkflowStateCode.Activated;

  return {
    id: "summary",
    title: "Summary",
    type: "quickpick",
    render: (state) => {
      let activeAction: string;
      if (readonly) {
        activeAction = "view-name";
      } else if (state.lastAction) {
        const idx = FIELD_ORDER.indexOf(state.lastAction as typeof FIELD_ORDER[number]);
        activeAction = idx >= 0 && idx < FIELD_ORDER.length - 1
          ? FIELD_ORDER[idx + 1]
          : "confirm";
      } else {
        activeAction = "edit-name";
      }

      return {
        placeholder: readonly
          ? "Deactivate workflow to edit properties"
          : "Select a field to edit, then confirm when ready",
        activeAction,
        items: [
          {
            action: readonly ? "view-name" : "edit-name",
            label: "$(tag) Name",
            description: state.name,
            detail: readonly ? "Display name (read-only — workflow is activated)" : "Display name of this workflow",
          },
          {
            action: "view-category",
            label: "$(symbol-enum) Category",
            description: CATEGORY_LABELS[workflow.category] ?? String(workflow.category),
            detail: "Category cannot be changed after creation (read-only)",
          },
          {
            action: "view-entity",
            label: "$(database) Primary Entity",
            description: workflow.primaryentity !== "none" ? workflow.primaryentity : "(none)",
            detail: "Primary entity cannot be changed after creation (read-only)",
          },
          {
            action: "view-status",
            label: "$(circle-filled) Status",
            description: activated ? "Activated" : "Draft",
            detail: "Use Activate/Deactivate commands to change status (read-only)",
          },
          ...(workflow.uniquename ? [{
            action: "view-uniquename",
            label: "$(key) Unique Name",
            description: workflow.uniquename,
            detail: "System unique name (read-only)",
          }] : []),
          ...(workflow.ismanaged !== undefined ? [{
            action: "view-managed",
            label: "$(shield) Managed",
            description: workflow.ismanaged ? "Managed" : "Unmanaged",
            detail: "Managed state (read-only)",
          }] : []),
          {
            action: readonly ? "view-description" : "edit-description",
            label: "$(comment) Description",
            description: state.description.trim() || "(none)",
            detail: readonly ? "Description (read-only — workflow is activated)" : "Optional description for this workflow",
          },
          ...(workflow.modifiedon ? [{
            action: "view-modified",
            label: "$(history) Modified",
            description: new Date(workflow.modifiedon).toLocaleString(),
            detail: "Last modified date (read-only)",
          }] : []),
          ...(workflow.createdon ? [{
            action: "view-created",
            label: "$(calendar) Created",
            description: new Date(workflow.createdon).toLocaleString(),
            detail: "Creation date (read-only)",
          }] : []),
          {
            action: "view-id",
            label: "$(symbol-key) ID",
            description: workflow.workflowid,
            detail: "Workflow identifier (read-only)",
          },
          ...(!readonly ? [
            { label: "", kind: -1 as const, action: "" },
            {
              action: "confirm",
              label: "$(check) Update Workflow",
              alwaysShow: true,
            },
          ] : []),
        ],
      };
    },
    onSelect: (action) => {
      if (action === "confirm") {
        return { next: undefined };
      }
      if (readonly) {
        return { next: "summary" };
      }
      const destinations: Record<string, string> = {
        "edit-name": "name",
        "edit-description": "description",
      };
      const dest = destinations[action];
      if (dest) {
        return { update: { lastAction: action }, next: dest };
      }
      // Read-only fields — stay on summary
      return { next: "summary" };
    },
  };
}

// ── Name page ─────────────────────────────────────────────────────────────────

const namePage: WizardPage<WorkflowWizardState> = {
  id: "name",
  title: "Name",
  ephemeral: true,
  type: "input",
  render: (state) => ({
    prompt: "Display name for this workflow",
    value: state.name,
    validate: (v) => v.trim() ? undefined : "Name is required",
  }),
  onSubmit: (value) => ({
    update: { name: value.trim() },
    next: "summary",
    pop: true,
  }),
};

// ── Description page ──────────────────────────────────────────────────────────

const descriptionPage: WizardPage<WorkflowWizardState> = {
  id: "description",
  title: "Description",
  ephemeral: true,
  type: "input",
  render: (state) => ({
    prompt: "Optional description for this workflow",
    value: state.description,
    placeholder: "Leave empty for none",
  }),
  onSubmit: (value) => ({
    update: { description: value },
    next: "summary",
    pop: true,
  }),
};

// ── Public API ────────────────────────────────────────────────────────────────

export async function workflowPropertiesWizard(
  workflowSvc: IWorkflowService,
  onRefresh: () => void,
  workflow: WorkflowProcess,
  env: DataverseEnvironment | undefined,
): Promise<void> {
  if (!env) { return; }

  const readonly = workflow.statecode === WorkflowStateCode.Activated;

  const result = await runWizard<WorkflowWizardState>({
    title: readonly
      ? `Properties (read-only) — ${workflow.name}`
      : `Properties — ${workflow.name}`,
    startPage: "summary",
    initialState: {
      name: workflow.name,
      description: workflow.description ?? "",
      lastAction: "",
    },
    pages: [
      summaryPage(workflow, readonly),
      ...(readonly ? [] : [namePage, descriptionPage]),
    ],
  });

  if (!result || readonly) { return; }

  // Build updates — only include changed fields
  const updates: Partial<WorkflowProcess> = {};
  if (result.name !== workflow.name) {
    updates.name = result.name;
  }
  if (result.description !== (workflow.description ?? "")) {
    updates.description = result.description || undefined;
  }

  if (Object.keys(updates).length === 0) {
    vscode.window.showInformationMessage("No changes made.");
    return;
  }

  try {
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `Updating "${result.name}"…` },
      () => workflowSvc.updateWorkflow(env, workflow.workflowid, updates),
    );
    onRefresh();
    vscode.window.showInformationMessage(`"${result.name}" updated.`);
  } catch (err) {
    Logger.error("Failed to update workflow properties", err);
    vscode.window.showErrorMessage(
      `Failed to update workflow: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
