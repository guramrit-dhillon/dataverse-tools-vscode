import * as vscode from "vscode";
import {
  type DataverseEnvironment,
  type PluginType,
  type SdkMessage,
  type SdkMessageFilter,
  type SdkMessageProcessingStep,
  type WizardPage,
  type QuickPickWizardItem,
  runWizard,
  Logger,
  StepMode,
  StepStage,
  StepInvocationSource,
  StepSupportedDeployment,
  StepStateCode,
  StepStatusCode,
} from "core-dataverse";
import { type IRegistrationService } from "../interfaces/IRegistrationService";

// ── Wizard state ──────────────────────────────────────────────────────────────

interface StepWizardState {
  messageId: string;
  messageName: string;
  filterId: string;
  entityCode: string;
  stage: StepStage;
  mode: StepMode;
  name: string;
  rank: number;
  filteringattributes: string;
  configuration: string;
  secureconfig: string;
  description: string;
  /** Tracks which summary action was last navigated from, to advance the cursor on return. */
  lastAction: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<number, string> = {
  [StepStage.PreValidation]: "Pre-Validation (10)",
  [StepStage.PreOperation]:  "Pre-Operation (20)",
  [StepStage.PostOperation]: "Post-Operation (40)",
};

const MODE_LABELS: Record<number, string> = {
  [StepMode.Synchronous]:  "Synchronous",
  [StepMode.Asynchronous]: "Asynchronous",
};

function stageLabelShort(stage: StepStage): string {
  if (stage === StepStage.PreValidation) { return "Pre-Validation"; }
  if (stage === StepStage.PreOperation)  { return "Pre-Operation"; }
  if (stage === StepStage.PostOperation) { return "Post-Operation"; }
  return String(stage);
}

function autoStepName(state: StepWizardState, pluginTypeName: string): string {
  const parts: string[] = [];
  if (state.messageName)   { parts.push(state.messageName); }
  if (state.entityCode && state.entityCode !== "none" && state.entityCode !== "any") {
    parts.push(state.entityCode);
  }
  parts.push(stageLabelShort(state.stage));
  const asyncSuffix = state.mode === StepMode.Asynchronous ? " (Async)" : "";
  return `${pluginTypeName}: ${parts.join(" ")}${asyncSuffix}`;
}

// ── Summary page ──────────────────────────────────────────────────────────────

/** Ordered list of summary actions — used to advance the cursor after each edit. */
const FIELD_ORDER = [
  "edit-message",
  "edit-entity",
  "edit-stage",
  "edit-mode",
  "edit-name",
  "edit-rank",
  "edit-filterattrs",
  "edit-config",
  "edit-secureconfig",
  "edit-description",
  "confirm",
] as const;

function summaryPage(isEdit: boolean, pluginTypeName: string): WizardPage<StepWizardState> {
  return {
    id: "summary",
    title: isEdit ? "Edit Step" : "Register Step",
    type: "quickpick",
    render: (state) => {
      const displayName = state.name.trim() || autoStepName(state, pluginTypeName);
      const entityDisplay =
        state.entityCode && state.entityCode !== "none" && state.entityCode !== "any"
          ? state.entityCode
          : "(any entity)";
      const allRequired = !!state.messageId;

      // After editing a field, advance the cursor to the next one in sequence
      let activeAction: string;
      if (!state.messageId) {
        activeAction = "edit-message";
      } else if (state.lastAction) {
        const idx = FIELD_ORDER.indexOf(state.lastAction as typeof FIELD_ORDER[number]);
        activeAction = idx >= 0 && idx < FIELD_ORDER.length - 1
          ? FIELD_ORDER[idx + 1]
          : "confirm";
      } else {
        activeAction = "confirm";
      }

      return {
        placeholder: "Select a field to edit, then confirm when ready",
        activeAction,
        items: [
          {
            action: "edit-message",
            label: "$(symbol-event) Message",
            description: state.messageName || "Not set",
            detail: "The SDK message to register on (e.g. Create, Update, Delete)",
          },
          {
            action: "edit-entity",
            label: "$(database) Entity",
            description: entityDisplay,
            detail: "Primary entity — leave as any to fire for all entities",
          },
          {
            action: "edit-stage",
            label: "$(layers) Stage",
            description: STAGE_LABELS[state.stage] ?? stageLabelShort(state.stage),
            detail: "Execution pipeline stage",
          },
          {
            action: "edit-mode",
            label: "$(clock) Mode",
            description: MODE_LABELS[state.mode] ?? "Synchronous",
            detail: "Synchronous runs in the same transaction; Asynchronous runs in a background job",
          },
          {
            action: "edit-name",
            label: "$(tag) Name",
            description: displayName,
            detail: "Step display name (auto-generated if left blank)",
          },
          {
            action: "edit-rank",
            label: "$(symbol-number) Rank",
            description: String(state.rank),
            detail: "Execution order — lower numbers run first",
          },
          {
            action: "edit-filterattrs",
            label: "$(filter) Filtering Attributes",
            description: state.filteringattributes.trim() || "(all attribute changes)",
            detail: "Trigger only when these attributes change (Update message only)",
          },
          {
            action: "edit-config",
            label: "$(gear) Unsecure Config",
            description: state.configuration.trim() ? state.configuration.trim().slice(0, 60) : "(none)",
            detail: "Configuration accessible in plugin code via UnsecureConfiguration",
          },
          {
            action: "edit-secureconfig",
            label: "$(lock) Secure Config",
            description: state.secureconfig.trim() ? "••••••" : "(none)",
            detail: "Encrypted configuration accessible via SecureConfiguration",
          },
          {
            action: "edit-description",
            label: "$(comment) Description",
            description: state.description.trim() || "(none)",
            detail: "Optional description",
          },
          { label: "", kind: -1, action: "" },
          {
            action: "confirm",
            label: allRequired
              ? `$(check) ${isEdit ? "Update Step" : "Register Step"}`
              : `$(check) ${isEdit ? "Update Step" : "Register Step"} (set Message first)`,
            alwaysShow: true,
          },
        ],
      };
    },
    onSelect: (action, _item, state) => {
      if (action === "confirm") {
        if (!state.messageId) {
          vscode.window.showWarningMessage("Message is required.");
          return { next: "summary" };
        }
        return { next: undefined };
      }
      const destinations: Record<string, string> = {
        "edit-message":      "message",
        "edit-entity":       "entity",
        "edit-stage":        "stage",
        "edit-mode":         "mode",
        "edit-name":         "name",
        "edit-rank":         "rank",
        "edit-filterattrs":  "filteringattributes",
        "edit-config":       "configuration",
        "edit-secureconfig": "secureconfig",
        "edit-description":  "description",
      };
      return {
        update: { lastAction: action },
        next: destinations[action] ?? "summary",
      };
    },
  };
}

// ── Message page ──────────────────────────────────────────────────────────────

function messagePage(
  env: DataverseEnvironment,
  registrationSvc: IRegistrationService,
): WizardPage<StepWizardState> {
  let cachedMessages: SdkMessage[] | undefined;

  return {
    id: "message",
    title: "Message",
    ephemeral: true,
    type: "quickpick",
    loading: { placeholder: "Loading messages…" },
    render: async (state, signal) => {
      if (!cachedMessages) {
        cachedMessages = await registrationSvc.listMessages(env);
        if (signal.aborted) { return { placeholder: "", items: [] }; }
      }
      return {
        placeholder: "Select the SDK message (type to filter)",
        activeAction: state.messageId || undefined,
        items: cachedMessages.map((m): QuickPickWizardItem => ({
          action: m.sdkmessageid,
          label: m.name,
        })),
      };
    },
    onSelect: (action, item, state) => {
      const messageChanged = state.messageId !== action;
      return {
        update: {
          messageId: action,
          messageName: item.label,
          // Clear entity selection when message changes
          ...(messageChanged ? { filterId: "", entityCode: "" } : {}),
        },
        next: "summary",
        pop: true,
      };
    },
  };
}

// ── Entity page ───────────────────────────────────────────────────────────────

function entityPage(
  env: DataverseEnvironment,
  registrationSvc: IRegistrationService,
): WizardPage<StepWizardState> {
  const filterCache = new Map<string, SdkMessageFilter[]>();

  return {
    id: "entity",
    title: "Entity",
    ephemeral: true,
    type: "quickpick",
    loading: { placeholder: "Loading entities for this message…" },
    render: async (state, signal) => {
      if (!state.messageId) {
        return { placeholder: "Select a message first", items: [] };
      }
      let filters = filterCache.get(state.messageId);
      if (!filters) {
        filters = await registrationSvc.listMessageFilters(env, state.messageId);
        filterCache.set(state.messageId, filters);
        if (signal.aborted) { return { placeholder: "", items: [] }; }
      }

      const items: QuickPickWizardItem[] = [
        {
          action: "__any__",
          label: "$(globe) Any Entity",
          description: "Register for all entities",
        },
        ...filters
          .filter((f) => f.primaryobjecttypecode && f.primaryobjecttypecode !== "none")
          .map((f): QuickPickWizardItem => ({
            action: f.sdkmessagefilterid,
            label: f.primaryobjecttypecode,
          })),
      ];

      return {
        placeholder: "Select the primary entity (type to filter)",
        activeAction: state.filterId || "__any__",
        items,
      };
    },
    onSelect: (action, item) => {
      if (action === "__any__") {
        return { update: { filterId: "", entityCode: "" }, next: "summary", pop: true };
      }
      return { update: { filterId: action, entityCode: item.label }, next: "summary", pop: true };
    },
  };
}

// ── Stage page ────────────────────────────────────────────────────────────────

const stagePage: WizardPage<StepWizardState> = {
  id: "stage",
  title: "Stage",
  ephemeral: true,
  type: "quickpick",
  render: (state) => ({
    placeholder: "Select the execution pipeline stage",
    activeAction: String(state.stage),
    items: [
      { action: String(StepStage.PreValidation), label: "$(shield) Pre-Validation (10)",  description: "Before the core operation, runs in database transaction" },
      { action: String(StepStage.PreOperation),  label: "$(arrow-left) Pre-Operation (20)",  description: "Before the core operation, runs in database transaction" },
      { action: String(StepStage.PostOperation), label: "$(arrow-right) Post-Operation (40)", description: "After the core operation" },
    ],
  }),
  onSelect: (action, _item, state) => {
    const stage = Number(action) as StepStage;
    // Async steps must be PostOperation
    const modeUpdate = state.mode === StepMode.Asynchronous && stage !== StepStage.PostOperation
      ? { mode: StepMode.Synchronous }
      : {};
    return { update: { stage, ...modeUpdate }, next: "summary", pop: true };
  },
};

// ── Mode page ─────────────────────────────────────────────────────────────────

const modePage: WizardPage<StepWizardState> = {
  id: "mode",
  title: "Mode",
  ephemeral: true,
  type: "quickpick",
  render: (state) => ({
    placeholder: "Select execution mode",
    activeAction: String(state.mode),
    items: [
      { action: String(StepMode.Synchronous),  label: "$(sync) Synchronous",   description: "Runs in the same transaction as the operation" },
      { action: String(StepMode.Asynchronous), label: "$(clock) Asynchronous", description: "Runs in a background job after the operation" },
    ],
  }),
  onSelect: (action) => {
    const mode = Number(action) as StepMode;
    // Async must be PostOperation
    const stageUpdate = mode === StepMode.Asynchronous ? { stage: StepStage.PostOperation } : {};
    return { update: { mode, ...stageUpdate }, next: "summary", pop: true };
  },
};

// ── Name page ─────────────────────────────────────────────────────────────────

function namePage(pluginTypeName: string): WizardPage<StepWizardState> {
  return {
    id: "name",
    title: "Step Name",
    ephemeral: true,
    type: "input",
    render: (state) => ({
      prompt: "Display name for this step (leave blank to auto-generate)",
      value: state.name || autoStepName(state, pluginTypeName),
    }),
    onSubmit: (value, state) => ({
      update: { name: value.trim() || autoStepName(state, pluginTypeName) },
      next: "summary",
      pop: true,
    }),
  };
}

// ── Rank page ─────────────────────────────────────────────────────────────────

const rankPage: WizardPage<StepWizardState> = {
  id: "rank",
  title: "Rank",
  ephemeral: true,
  type: "input",
  render: (state) => ({
    prompt: "Execution order (lower numbers run first)",
    value: String(state.rank),
    placeholder: "1",
    validate: (v) => {
      const n = Number(v);
      return isNaN(n) || !Number.isInteger(n) || n < 1 ? "Rank must be a positive integer" : undefined;
    },
  }),
  onSubmit: (value) => ({
    update: { rank: Number(value) },
    next: "summary",
    pop: true,
  }),
};

// ── Filtering attributes page ─────────────────────────────────────────────────

/**
 * Ephemeral canPickMany attribute picker.
 * When no entity is set in state, shows a prompt to select an entity first.
 * When an entity is set, loads its attributes and shows a multi-select list.
 * Caches per entity code within the wizard session.
 */
function filteringAttributesPage(
  env: DataverseEnvironment,
  registrationSvc: IRegistrationService,
): WizardPage<StepWizardState> {
  const attrCache = new Map<string, string[]>();

  return {
    id: "filteringattributes",
    title: "Filtering Attributes",
    ephemeral: true,
    type: "quickpick",
    loading: { placeholder: "Loading attributes…" },
    render: async (state, signal) => {
      const { entityCode } = state;
      const hasEntity = !!entityCode && entityCode !== "none" && entityCode !== "any";

      if (!hasEntity) {
        return {
          placeholder: "Select an entity first to choose filtering attributes",
          items: [
            {
              action: "__skip__",
              label: "$(skip) Skip — fire on all attribute changes",
              description: "No filtering attributes set",
            },
          ],
        };
      }

      let attrs = attrCache.get(entityCode);
      if (!attrs) {
        attrs = await registrationSvc.listEntityAttributes(env, entityCode);
        attrCache.set(entityCode, attrs);
        if (signal.aborted) { return { placeholder: "", items: [], canPickMany: true }; }
      }

      const selectedSet = new Set(
        state.filteringattributes.split(",").map((a) => a.trim()).filter(Boolean)
      );

      return {
        placeholder: `Select attributes that trigger this step (leave all unchecked = all changes)  —  ${entityCode}`,
        canPickMany: true,
        selectedActions: [...selectedSet],
        items: attrs.map((attr): QuickPickWizardItem => ({ action: attr, label: attr })),
      };
    },
    onSelect: (action) => {
      if (action === "__skip__") {
        return { update: { filteringattributes: "" }, next: "summary", pop: true };
      }
      return { next: "summary", pop: true };
    },
    onMultiSelect: (selectedItems) => ({
      update: { filteringattributes: selectedItems.map((i) => i.action).join(",") },
      next: "summary",
      pop: true,
    }),
  };
}

// ── Unsecure config page ──────────────────────────────────────────────────────

const configurationPage: WizardPage<StepWizardState> = {
  id: "configuration",
  title: "Unsecure Config",
  ephemeral: true,
  type: "input",
  render: (state) => ({
    prompt: "Unsecure configuration (accessible via UnsecureConfiguration in plugin code — paste JSON or any string)",
    value: state.configuration,
    placeholder: "Leave empty for none",
  }),
  onSubmit: (value) => ({
    update: { configuration: value.trim() },
    next: "summary",
    pop: true,
  }),
};

// ── Secure config page ────────────────────────────────────────────────────────

const secureconfigPage: WizardPage<StepWizardState> = {
  id: "secureconfig",
  title: "Secure Config",
  ephemeral: true,
  type: "input",
  render: (state) => ({
    prompt: "Secure configuration (encrypted at rest; accessible via SecureConfiguration in plugin code)",
    value: state.secureconfig,
    placeholder: "Leave empty for none",
    password: true,
  }),
  onSubmit: (value) => ({
    update: { secureconfig: value.trim() },
    next: "summary",
    pop: true,
  }),
};

// ── Description page ──────────────────────────────────────────────────────────

const descriptionPage: WizardPage<StepWizardState> = {
  id: "description",
  title: "Description",
  ephemeral: true,
  type: "input",
  render: (state) => ({
    prompt: "Optional description for this step",
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

export async function stepWizard(
  pluginType: PluginType,
  env: DataverseEnvironment,
  registrationSvc: IRegistrationService,
  existing?: SdkMessageProcessingStep,
): Promise<SdkMessageProcessingStep | undefined> {
  const isEdit = !!existing;
  const pluginTypeName = pluginType.typename ?? pluginType.friendlyname ?? "";
  const wizardTitle = isEdit
    ? `Edit Step — ${existing!.name}`
    : `Register Step — ${pluginTypeName}`;

  const result = await runWizard<StepWizardState>({
    title: wizardTitle,
    startPage: "summary",
    initialState: {
      messageId:           existing?.sdkmessageid?.sdkmessageid ?? "",
      messageName:         existing?.sdkmessageid?.name ?? "",
      filterId:            existing?.sdkmessagefilterid?.sdkmessagefilterid ?? "",
      entityCode:          existing?.sdkmessagefilterid?.primaryobjecttypecode ?? "",
      stage:               existing?.stage ?? StepStage.PostOperation,
      mode:                existing?.mode  ?? StepMode.Synchronous,
      name:                existing?.name  ?? "",
      rank:                existing?.rank  ?? 1,
      filteringattributes: existing?.filteringattributes ?? "",
      configuration:       existing?.configuration ?? "",
      secureconfig:        existing?.secureconfig ?? "",
      description:         existing?.description ?? "",
      lastAction:          "",
    },
    pages: [
      summaryPage(isEdit, pluginTypeName),
      messagePage(env, registrationSvc),
      entityPage(env, registrationSvc),
      stagePage,
      modePage,
      namePage(pluginTypeName),
      rankPage,
      filteringAttributesPage(env, registrationSvc),
      configurationPage,
      secureconfigPage,
      descriptionPage,
    ],
  });

  if (!result) { return undefined; }

  const stepName = result.name.trim() || autoStepName(result, pluginTypeName);

  const step: SdkMessageProcessingStep = {
    ...(existing ?? {}),
    name:                stepName,
    rank:                result.rank,
    mode:                result.mode,
    stage:               result.stage,
    description:         result.description || undefined,
    filteringattributes: result.filteringattributes || undefined,
    configuration:       result.configuration || undefined,
    secureconfig:        result.secureconfig || undefined,
    invocationsource:    existing?.invocationsource    ?? StepInvocationSource.Parent,
    supporteddeployment: existing?.supporteddeployment ?? StepSupportedDeployment.ServerOnly,
    asyncautodelete:     existing?.asyncautodelete     ?? false,
    statecode:           existing?.statecode           ?? StepStateCode.Enabled,
    statuscode:          existing?.statuscode          ?? StepStatusCode.Enabled,
    sdkmessageid: { sdkmessageid: result.messageId, name: result.messageName },
    ...(result.filterId ? {
      sdkmessagefilterid: {
        sdkmessagefilterid: result.filterId,
        primaryobjecttypecode: result.entityCode,
      },
    } : { sdkmessagefilterid: undefined }),
    eventhandler_plugintype: existing?.eventhandler_plugintype ?? {
      plugintypeid: pluginType.plugintypeid!,
      name: pluginType.typename ?? "",
    },
  };

  try {
    const saved = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: isEdit ? "Updating step…" : "Registering step…",
      },
      () => registrationSvc.upsertStep(env, step),
    );
    vscode.window.showInformationMessage(
      isEdit ? `Step "${saved.name}" updated.` : `Step "${saved.name}" registered.`
    );
    return saved;
  } catch (err) {
    Logger.error("Failed to save step", err);
    vscode.window.showErrorMessage(
      `Failed to ${isEdit ? "update" : "register"} step: ${err instanceof Error ? err.message : String(err)}`
    );
    return undefined;
  }
}
