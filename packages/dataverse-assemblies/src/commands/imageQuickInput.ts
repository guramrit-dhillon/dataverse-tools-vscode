import * as vscode from "vscode";
import {
  type DataverseEnvironment,
  type SdkMessageProcessingStep,
  type SdkMessageProcessingStepImage,
  type WizardPage,
  type QuickPickWizardItem,
  runWizard,
  Logger,
} from "core-dataverse";
import { type IRegistrationService } from "../interfaces/IRegistrationService";

// ── Wizard state ─────────────────────────────────────────────────────────────

interface ImageWizardState {
  imagetype: number;            // 0=Pre, 1=Post, 2=Both
  name: string;
  entityalias: string;
  messagepropertyname: string;
  attributes: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<number, string> = { 0: "Pre-Image", 1: "Post-Image", 2: "Pre+Post (Both)" };
const TYPE_ACTIONS = { pre: 0, post: 1, both: 2 } as const;

function typeActionFromValue(n: number): string {
  return (["pre", "post", "both"] as const)[n] ?? "pre";
}

/**
 * Returns the image type numbers allowed for a given step.
 * - Pre-event stages (10=PreValidation, 20=PreOperation) → Pre only (0)
 * - PostOperation + Create  → Post only (1)
 * - PostOperation + Delete  → Pre only  (0)
 * - PostOperation + others  → Pre, Post, Both (0, 1, 2)
 */
function allowedImageTypes(messageName: string | undefined, stage: number | undefined): number[] {
  // Pre-event: Post-image is never available
  if (stage === 10 || stage === 20) { return [0]; }
  const name = messageName?.toLowerCase();
  if (name === "create") { return [1]; }
  if (name === "delete") { return [0]; }
  return [0, 1, 2];
}

/** Clamp an imagetype value to the nearest allowed type. */
function clampImageType(imagetype: number, allowed: number[]): number {
  return allowed.includes(imagetype) ? imagetype : (allowed[0] ?? 0);
}

// ── Pages ─────────────────────────────────────────────────────────────────────

/** Summary page — shows all current values, user picks a field to edit or confirms. */
function summaryPage(isEdit: boolean, messageName: string | undefined, stage: number | undefined): WizardPage<ImageWizardState> {
  const allowed = allowedImageTypes(messageName, stage);

  return {
    id: "summary",
    title: isEdit ? "Edit Image" : "Register Image",
    type: "quickpick",
    render: (state) => {
      const allRequired = !!state.name.trim() && !!state.entityalias.trim();
      const activeAction =
        !state.name.trim() ? "edit-name" :
        !state.entityalias.trim() ? "edit-alias" :
        "confirm";

      return {
        placeholder: "Select a field to edit, then confirm when ready",
        activeAction,
        items: [
          {
            action: "edit-type",
            label: "$(symbol-enum) Image Type",
            description: TYPE_LABELS[state.imagetype] ?? "Pre-Image",
            detail: allowed.length === 1
              ? `Only ${TYPE_LABELS[allowed[0]!]} is supported for ${messageName ?? "this message"}`
              : "The snapshot type — Pre, Post, or both",
          },
          {
            action: "edit-name",
            label: "$(tag) Name",
            description: state.name.trim() || "Not set",
            detail: "A friendly name for this image",
          },
          {
            action: "edit-alias",
            label: "$(symbol-variable) Entity Alias",
            description: state.entityalias.trim() || "Not set",
            detail: 'Used to access the image in plugin code, e.g. context.PreEntityImages["PreImage"]',
          },
          {
            action: "edit-msgprop",
            label: "$(symbol-property) Message Property",
            description: state.messagepropertyname || "Target",
            detail: '"Target" for most messages; "Id" for Delete',
          },
          {
            action: "edit-attrs",
            label: "$(filter) Attributes",
            description: state.attributes.trim() || "(all attributes)",
            detail: "Attributes to include in the image snapshot",
          },
          { label: "", kind: -1, action: "" },
          {
            action: "confirm",
            label: allRequired
              ? `$(check) ${isEdit ? "Update Image" : "Register Image"}`
              : `$(check) ${isEdit ? "Update Image" : "Register Image"} (fill required fields first)`,
            alwaysShow: true,
          },
        ],
      };
    },
    onSelect: (action, _item, state) => {
      if (action === "confirm") {
        if (!state.name.trim() || !state.entityalias.trim()) {
          vscode.window.showWarningMessage("Name and Entity Alias are required.");
          return { next: "summary" };
        }
        return { next: undefined };
      }
      if (action === "edit-type" && allowed.length === 1) {
        // Only one type is valid — nothing to pick, inform user
        vscode.window.showInformationMessage(
          `Only ${TYPE_LABELS[allowed[0]!]} is supported for ${messageName ?? "this message"}.`
        );
        return { next: "summary" };
      }
      const destinations: Record<string, string> = {
        "edit-type":    "imageType",
        "edit-name":    "name",
        "edit-alias":   "entityalias",
        "edit-msgprop": "messagepropertyname",
        "edit-attrs":   "attributes",
      };
      return { next: destinations[action] ?? "summary" };
    },
  };
}

/** Ephemeral image type picker — returns to summary with pop. */
function imageTypePage(messageName: string | undefined, stage: number | undefined): WizardPage<ImageWizardState> {
  const allowed = allowedImageTypes(messageName, stage);

  const allItems: Array<{ n: number; action: string; label: string; description: string }> = [
    { n: 0, action: "pre",  label: "$(arrow-left) Pre-Image",       description: "Snapshot of the record before the operation" },
    { n: 1, action: "post", label: "$(arrow-right) Post-Image",     description: "Snapshot of the record after the operation" },
    { n: 2, action: "both", label: "$(arrow-swap) Pre+Post (Both)", description: "Snapshots before and after" },
  ];

  return {
    id: "imageType",
    title: "Image Type",
    ephemeral: true,
    type: "quickpick",
    render: (state) => ({
      placeholder: "Choose the snapshot type",
      activeAction: typeActionFromValue(state.imagetype),
      items: allItems
        .filter((i) => allowed.includes(i.n))
        .map((i): QuickPickWizardItem => ({
          action: i.action,
          label: i.label,
          description: i.description,
        })),
    }),
    onSelect: (action) => ({
      update: { imagetype: TYPE_ACTIONS[action as keyof typeof TYPE_ACTIONS] ?? 0 },
      next: "summary",
      pop: true,
    }),
  };
}

/** Ephemeral name input — returns to summary with pop. */
const namePage: WizardPage<ImageWizardState> = {
  id: "name",
  title: "Name",
  ephemeral: true,
  type: "input",
  render: (state) => ({
    prompt: "A friendly name for this image (e.g. PreImage)",
    value: state.name,
    validate: (v) => v.trim() ? undefined : "Name is required",
  }),
  onSubmit: (value) => ({
    update: { name: value.trim() },
    next: "summary",
    pop: true,
  }),
};

/** Ephemeral entity alias input — returns to summary with pop. */
const entityAliasPage: WizardPage<ImageWizardState> = {
  id: "entityalias",
  title: "Entity Alias",
  ephemeral: true,
  type: "input",
  render: (state) => ({
    prompt: "Alias used to access the image in plugin code (e.g. PreImage)",
    value: state.entityalias || state.name,
    validate: (v) => v.trim() ? undefined : "Entity alias is required",
  }),
  onSubmit: (value) => ({
    update: { entityalias: value.trim() },
    next: "summary",
    pop: true,
  }),
};

/** Ephemeral message property input — returns to summary with pop. */
const messagePropPage: WizardPage<ImageWizardState> = {
  id: "messagepropertyname",
  title: "Message Property Name",
  ephemeral: true,
  type: "input",
  render: (state) => ({
    prompt: '"Target" for most messages; "Id" for Delete messages',
    value: state.messagepropertyname,
    placeholder: "Target",
  }),
  onSubmit: (value) => ({
    update: { messagepropertyname: value.trim() || "Target" },
    next: "summary",
    pop: true,
  }),
};

/**
 * Ephemeral attributes picker — loads all entity attributes and shows them as a
 * multi-select QuickPick. Uses the wizard's `canPickMany` / `onMultiSelect` support.
 * Falls back to a text input when no entity code is available on the step.
 */
function attributesPickerPage(
  step: SdkMessageProcessingStep,
  env: DataverseEnvironment,
  registrationSvc: IRegistrationService,
): WizardPage<ImageWizardState> {
  const entityCode = step.sdkmessagefilterid?.primaryobjecttypecode;
  const hasEntity = !!entityCode && entityCode !== "none" && entityCode !== "any";

  // ── No entity → plain text input ──────────────────────────────────────────
  if (!hasEntity) {
    return {
      id: "attributes",
      title: "Attributes",
      ephemeral: true,
      type: "input",
      render: (state) => ({
        prompt: "Comma-separated attribute logical names to include (leave empty for all)",
        value: state.attributes,
        placeholder: "e.g. name,statuscode,ownerid  (empty = all attributes)",
      }),
      onSubmit: (value) => ({
        update: { attributes: value.trim() },
        next: "summary",
        pop: true,
      }),
    };
  }

  // ── Entity available → multi-select attribute picker ──────────────────────
  let cachedAttrs: string[] | undefined;

  return {
    id: "attributes",
    title: `Attributes — ${entityCode}`,
    ephemeral: true,
    type: "quickpick",
    loading: { placeholder: `Loading attributes for ${entityCode}…` },
    render: async (state, signal) => {
      if (!cachedAttrs) {
        cachedAttrs = await registrationSvc.listEntityAttributes(env, entityCode!);
        if (signal.aborted) { return { placeholder: "", items: [], canPickMany: true }; }
      }

      const selectedSet = new Set(
        state.attributes.split(",").map((a) => a.trim()).filter(Boolean)
      );

      return {
        placeholder: "Select attributes to include in the snapshot (leave all unchecked for all attributes)",
        canPickMany: true,
        selectedActions: [...selectedSet],
        items: cachedAttrs.map((attr): QuickPickWizardItem => ({
          action: attr,
          label: attr,
        })),
      };
    },
    onSelect: () => ({ next: "summary", pop: true }),
    onMultiSelect: (selectedItems) => ({
      update: { attributes: selectedItems.map((i) => i.action).join(",") },
      next: "summary",
      pop: true,
    }),
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Run the summary-first image wizard using the shared `runWizard` framework.
 * Shows all fields upfront; user edits any field then confirms.
 */
export async function imageWizard(
  step: SdkMessageProcessingStep,
  env: DataverseEnvironment,
  registrationSvc: IRegistrationService,
  existing?: SdkMessageProcessingStepImage,
): Promise<SdkMessageProcessingStepImage | undefined> {
  const isEdit = !!existing;
  const messageName = step.sdkmessageid?.name;
  const stage = step.stage;
  const isDelete = messageName?.toLowerCase() === "delete";
  const allowed = allowedImageTypes(messageName, stage);

  const wizardTitle = isEdit
    ? `Edit Image — ${existing!.name}`
    : `Register Image — ${step.name}`;

  // Clamp the imagetype to a valid value for this message/stage combination
  const initialImageType = clampImageType(existing?.imagetype ?? 0, allowed);

  const result = await runWizard<ImageWizardState>({
    title: wizardTitle,
    startPage: "summary",
    initialState: {
      imagetype: initialImageType,
      name: existing?.name ?? "",
      entityalias: existing?.entityalias ?? "",
      messagepropertyname: existing?.messagepropertyname ?? (isDelete ? "Id" : "Target"),
      attributes: existing?.attributes ?? "",
    },
    pages: [
      summaryPage(isEdit, messageName, stage),
      imageTypePage(messageName, stage),
      namePage,
      entityAliasPage,
      messagePropPage,
      attributesPickerPage(step, env, registrationSvc),
    ],
  });

  if (!result) { return undefined; }

  const image: SdkMessageProcessingStepImage = {
    ...(existing ?? {}),
    name: result.name,
    entityalias: result.entityalias,
    imagetype: result.imagetype,
    messagepropertyname: result.messagepropertyname || (isDelete ? "Id" : "Target"),
    attributes: result.attributes || undefined,
    sdkmessageprocessingstepid: {
      sdkmessageprocessingstepid: step.sdkmessageprocessingstepid!,
    },
  };

  try {
    const saved = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: isEdit ? "Updating image…" : "Registering image…",
      },
      () => registrationSvc.upsertStepImage(env, image),
    );
    vscode.window.showInformationMessage(
      isEdit ? `Image "${result.name}" updated.` : `Image "${result.name}" registered.`
    );
    return saved;
  } catch (err) {
    Logger.error("Failed to save image", err);
    vscode.window.showErrorMessage(
      `Failed to ${isEdit ? "update" : "register"} image: ${err instanceof Error ? err.message : String(err)}`
    );
    return undefined;
  }
}
