import * as React from "react";
import { useEffect, useCallback, useState, useMemo } from "react";
import { useReducer, RadioGroup, Field, ErrorBanner, Autocomplete, Codicon, IconButton } from "shared-views";
import type { AutocompleteOption } from "shared-views";
import { ImageForm, imageTypeLabel } from "./ImageForm";
import type { StepImage } from "./ImageForm";

// ── Types (isolated from extension host – no cross-process imports) ───────────

interface SdkMessage {
  sdkmessageid: string;
  name: string;
}

interface StepData {
  sdkmessageprocessingstepid?: string;
  name: string;
  description?: string;
  rank: number;
  mode: number;
  stage: number;
  invocationsource: number;
  supporteddeployment: number;
  asyncautodelete: boolean;
  filteringattributes?: string;
  configuration?: string;
  statecode: number;
  statuscode: number;
  sdkmessageid: { sdkmessageid: string; name: string };
  sdkmessagefilterid?: { sdkmessagefilterid?: string; primaryobjecttypecode: string };
  eventhandler_plugintype?: { plugintypeid: string; name: string };
}

interface StepPanelOptions {
  mode: "create" | "edit";
  pluginTypeId: string;
  pluginTypeName: string;
  step: Partial<StepData>;
  images?: StepImage[];
}

// ── Form state ────────────────────────────────────────────────────────────────

interface FormState {
  messageId: string;
  messageName: string;
  entityCode: string;
  stage: number;
  mode: number;
  rank: number;
  filteringAttributes: string;
  stepName: string;
  stepNameManuallySet: boolean;
  unsecureConfig: string;
  description: string;
}

function blankForm(): FormState {
  return {
    messageId: "",
    messageName: "",
    entityCode: "",
    stage: 40,
    mode: 0,
    rank: 1,
    filteringAttributes: "",
    stepName: "",
    stepNameManuallySet: false,
    unsecureConfig: "",
    description: "",
  };
}

function autoName(messageName: string, entityCode: string, stage: number): string {
  const stageStr = ({ 10: "PreValidation", 20: "PreOperation", 40: "PostOperation" } as Record<number, string>)[stage] ?? String(stage);
  return `${messageName}: ${entityCode || "any"} (${stageStr})`;
}

function formFromStep(step: Partial<StepData>): FormState {
  const msgId = step.sdkmessageid?.sdkmessageid ?? "";
  const msgName = step.sdkmessageid?.name ?? "";
  return {
    messageId: msgId,
    messageName: msgName,
    entityCode: step.sdkmessagefilterid?.primaryobjecttypecode ?? "",
    stage: step.stage ?? 40,
    mode: step.mode ?? 0,
    rank: step.rank ?? 1,
    filteringAttributes: step.filteringattributes ?? "",
    stepName: step.name ?? "",
    stepNameManuallySet: !!step.name,
    unsecureConfig: step.configuration ?? "",
    description: step.description ?? "",
  };
}

// ── State & Actions ───────────────────────────────────────────────────────────

interface State {
  options: StepPanelOptions | null;
  form: FormState;
  saving: boolean;
  error: string | null;
  attrPickerLoading: boolean;
  images: StepImage[];
  imageFormOpen: boolean;
  editingImage: StepImage | null;
  // Entity-first data loading:
  allEntities: AutocompleteOption[];
  entitiesLoading: boolean;
  allMessages: AutocompleteOption[];
  messagesLoading: boolean;
  messageCache: Record<string, AutocompleteOption[]>;
}

const initialState: State = {
  options: null,
  form: blankForm(),
  saving: false,
  error: null,
  attrPickerLoading: false,
  images: [],
  imageFormOpen: false,
  editingImage: null,
  allEntities: [],
  entitiesLoading: false,
  allMessages: [],
  messagesLoading: false,
  messageCache: {},
};

type Action =
  // From extension (Panel sends `:response` / `:error` suffix convention):
  | { type: "init"; payload: StepPanelOptions }
  | { type: "pickAttributes:response"; payload: string | null }
  | { type: "pickAttributes:error"; payload: string }
  | { type: "saveImage:response"; payload: StepImage }
  | { type: "saveImage:error"; payload: string }
  | { type: "deleteImage:response"; payload: string }
  | { type: "deleteImage:error"; payload: string }
  | { type: "save:error"; payload: string }
  // Entity-first data loading:
  | { type: "loadEntities:response"; payload: string[] }
  | { type: "loadEntities:error"; payload: string }
  | { type: "loadMessages:response"; payload: { entityCode: string; messages: SdkMessage[] } }
  | { type: "loadMessages:error"; payload: string }
  // Local UI:
  | { type: "setForm"; payload: Partial<FormState> }
  | { type: "setError"; payload: string | null }
  | { type: "openImageForm"; payload?: StepImage }
  | { type: "closeImageForm" }
  | { type: "setMessagesFromCache"; payload: AutocompleteOption[] }
  // To extension (hook posts these when meta.toExtension is true):
  | { type: "ready"; meta: { toExtension: true } }
  | { type: "save"; payload: StepData; meta: { toExtension: true } }
  | { type: "cancel"; meta: { toExtension: true } }
  | { type: "loadEntities"; meta: { toExtension: true } }
  | { type: "loadMessages"; payload: string; meta: { toExtension: true } }
  | { type: "pickAttributes"; payload: { entityCode: string; current: string[] }; meta: { toExtension: true } }
  | { type: "saveImage"; payload: StepImage; meta: { toExtension: true } }
  | { type: "deleteImage"; payload: string; meta: { toExtension: true } };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "init":
      return {
        ...state,
        options: action.payload,
        form: formFromStep(action.payload.step),
        images: action.payload.images ?? [],
        saving: false,
        error: null,
      };
    case "pickAttributes:response":
      if (action.payload !== null) {
        return { ...state, attrPickerLoading: false, form: { ...state.form, filteringAttributes: action.payload } };
      }
      return { ...state, attrPickerLoading: false };
    case "pickAttributes:error":
      return { ...state, attrPickerLoading: false, error: action.payload };
    case "saveImage:response": {
      const saved = action.payload;
      const idx = state.images.findIndex(
        (i) => i.sdkmessageprocessingstepimageid === saved.sdkmessageprocessingstepimageid
      );
      return {
        ...state,
        images: idx >= 0 ? state.images.map((img, n) => (n === idx ? saved : img)) : [...state.images, saved],
        imageFormOpen: false,
        editingImage: null,
      };
    }
    case "saveImage:error":
      return { ...state, error: action.payload };
    case "deleteImage:response":
      return { ...state, images: state.images.filter((i) => i.sdkmessageprocessingstepimageid !== action.payload) };
    case "deleteImage:error":
      return { ...state, error: action.payload };
    case "save:error":
      return { ...state, saving: false, error: action.payload };
    // Entity-first data loading:
    case "loadEntities":
      return { ...state, entitiesLoading: true };
    case "loadEntities:response":
      return {
        ...state,
        entitiesLoading: false,
        allEntities: action.payload.map((name) => ({ key: name, label: name })),
      };
    case "loadEntities:error":
      return { ...state, entitiesLoading: false, error: action.payload };
    case "loadMessages":
      return { ...state, messagesLoading: true };
    case "loadMessages:response": {
      const opts = action.payload.messages.map((m) => ({ key: m.sdkmessageid, label: m.name }));
      return {
        ...state,
        messagesLoading: false,
        allMessages: opts,
        messageCache: { ...state.messageCache, [action.payload.entityCode]: opts },
      };
    }
    case "loadMessages:error":
      return { ...state, messagesLoading: false, error: action.payload };
    case "setMessagesFromCache":
      return { ...state, allMessages: action.payload, messagesLoading: false };
    // Local UI:
    case "setForm":
      return { ...state, form: { ...state.form, ...action.payload } };
    case "setError":
      return { ...state, error: action.payload };
    case "openImageForm":
      return { ...state, imageFormOpen: true, editingImage: action.payload ?? null };
    case "closeImageForm":
      return { ...state, imageFormOpen: false, editingImage: null };
    // Actions sent to extension — update local state where needed:
    case "save":
      return { ...state, saving: true, error: null };
    case "pickAttributes":
      return { ...state, attrPickerLoading: true };
    // No local state change needed:
    case "ready":
    case "cancel":
    case "saveImage":
    case "deleteImage":
      return state;
    default:
      return state;
  }
}

// ── Root component ────────────────────────────────────────────────────────────

export function StepForm(): React.ReactElement {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { options, form, saving, error, images, imageFormOpen, editingImage } = state;

  // Local filter queries for client-side filtering
  const [entityQuery, setEntityQuery] = useState("");
  const [messageQuery, setMessageQuery] = useState("");

  // Compute filtered options from full lists
  const filteredEntities = useMemo(() => {
    const q = entityQuery.toLowerCase();
    return q ? state.allEntities.filter((e) => e.label.toLowerCase().includes(q)) : state.allEntities;
  }, [state.allEntities, entityQuery]);

  const filteredMessages = useMemo(() => {
    const q = messageQuery.toLowerCase();
    return q ? state.allMessages.filter((m) => m.label.toLowerCase().includes(q)) : state.allMessages;
  }, [state.allMessages, messageQuery]);

  // Signal ready to extension → triggers "init" response
  useEffect(() => {
    dispatch({ type: "ready", meta: { toExtension: true } });
  }, []);

  // Load all entities once after init (narrow dep intentional — runs once)
  useEffect(() => {
    if (options) {
      dispatch({ type: "loadEntities", meta: { toExtension: true } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options?.pluginTypeId]);

  // Load messages for the initial entity in edit mode (narrow dep intentional — runs once)
  useEffect(() => {
    if (options && form.entityCode) {
      const cached = state.messageCache[form.entityCode];
      if (cached) {
        dispatch({ type: "setMessagesFromCache", payload: cached });
      } else {
        dispatch({ type: "loadMessages", payload: form.entityCode, meta: { toExtension: true } });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options?.pluginTypeId]);

  // Auto-generate step name when message/entity/stage changes
  useEffect(() => {
    if (!form.stepNameManuallySet && form.messageName) {
      dispatch({
        type: "setForm",
        payload: { stepName: autoName(form.messageName, form.entityCode, form.stage) },
      });
    }
  }, [form.messageName, form.entityCode, form.stage, form.stepNameManuallySet]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleEntityChange = useCallback((code: string) => {
    dispatch({ type: "setForm", payload: { entityCode: code, messageId: "", messageName: "", filteringAttributes: "" } });
    setMessageQuery("");
    if (!code) {
      dispatch({ type: "setMessagesFromCache", payload: [] });
      return;
    }
    // Load messages for the selected entity (check cache first)
    const cached = state.messageCache[code];
    if (cached) {
      dispatch({ type: "setMessagesFromCache", payload: cached });
    } else {
      dispatch({ type: "loadMessages", payload: code, meta: { toExtension: true } });
    }
  }, [state.messageCache]);

  const handleMessageChange = useCallback((id: string, name: string) => {
    dispatch({ type: "setForm", payload: { messageId: id, messageName: name } });
  }, []);

  const handlePickAttributes = useCallback(() => {
    if (!form.entityCode) {
      dispatch({ type: "setError", payload: "Select a primary entity first" });
      return;
    }
    const current = form.filteringAttributes.split(",").map((a) => a.trim()).filter(Boolean);
    dispatch({ type: "pickAttributes", payload: { entityCode: form.entityCode, current }, meta: { toExtension: true } });
  }, [form.entityCode, form.filteringAttributes]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!options) { return; }
    const step: StepData = {
      ...(options.step as StepData),
      sdkmessageid: { sdkmessageid: form.messageId, name: form.messageName },
      sdkmessagefilterid: form.entityCode
        ? { sdkmessagefilterid: undefined, primaryobjecttypecode: form.entityCode }
        : undefined,
      stage: form.stage,
      mode: form.mode,
      rank: form.rank,
      name: form.stepName || autoName(form.messageName, form.entityCode, form.stage),
      filteringattributes: form.filteringAttributes || undefined,
      configuration: form.unsecureConfig || undefined,
      description: form.description || undefined,
      statecode: 0,
      statuscode: 1,
      invocationsource: 0,
      supporteddeployment: 0,
      asyncautodelete: form.mode === 1,
      eventhandler_plugintype: {
        plugintypeid: options.pluginTypeId,
        name: options.pluginTypeName,
      },
    };
    dispatch({ type: "save", payload: step, meta: { toExtension: true } });
  }, [options, form]);

  if (!options) {
    return <div className="loading">Initialising…</div>;
  }

  return (
    <div className="container">
      <h2>{options.mode === "create" ? "Add Step" : "Edit Step"}</h2>
      <p className="subtitle">{options.pluginTypeName}</p>

      <ErrorBanner error={error} />

      <form onSubmit={handleSubmit} noValidate>
        {/* ── Entity + Message ── */}
        <div className="row">
          <Field label="Primary Entity" fieldId="entitySearch">
            <Autocomplete
              fieldId="entitySearch"
              value={form.entityCode ? { key: form.entityCode, label: form.entityCode } : null}
              options={filteredEntities}
              loading={state.entitiesLoading}
              disabled={state.entitiesLoading}
              onSearch={setEntityQuery}
              onSelect={(opt) => handleEntityChange(opt?.label ?? "")}
              placeholder={state.entitiesLoading ? "Loading entities…" : "Search entities…"}
              debounceMs={0}
            />
          </Field>

          <Field label="Message *" fieldId="msgSearch">
            <Autocomplete
              fieldId="msgSearch"
              value={form.messageId ? { key: form.messageId, label: form.messageName } : null}
              options={filteredMessages}
              loading={state.messagesLoading}
              disabled={!form.entityCode || state.messagesLoading}
              onSearch={setMessageQuery}
              onSelect={(opt) => handleMessageChange(opt?.key ?? "", opt?.label ?? "")}
              required
              placeholder={state.messagesLoading ? "Loading messages…" : !form.entityCode ? "Select an entity first" : "Search messages…"}
              debounceMs={0}
            />
          </Field>
        </div>

        {/* ── Execution ── */}
        <fieldset>
          <legend>Execution</legend>
          <div className="execution-row">
            <div className="execution-column">
              <span className="group-label">Stage *</span>
              <RadioGroup
                name="stage"
                value={String(form.stage)}
                onChange={(v) => dispatch({ type: "setForm", payload: { stage: Number(v) } })}
                options={[
                  { value: "10", label: "PreValidation" },
                  { value: "20", label: "PreOperation" },
                  { value: "40", label: "PostOperation" },
                ]}
              />
            </div>
            <div className="execution-column">
              <span className="group-label">Mode *</span>
              <RadioGroup
                name="mode"
                value={String(form.mode)}
                onChange={(v) => dispatch({ type: "setForm", payload: { mode: Number(v) } })}
                options={[
                  { value: "0", label: "Synchronous" },
                  { value: "1", label: "Asynchronous" },
                ]}
              />
            </div>
            <div className="execution-column">
              <Field label="Rank" as="input" fieldId="rankInput"
                type="number" min={1} max={2147483647} value={form.rank}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => dispatch({ type: "setForm", payload: { rank: parseInt(e.target.value) || 1 } })}
              />
            </div>
          </div>
        </fieldset>

        {/* ── Filtering Attributes ── */}
        <Field label="Filtering Attributes" fieldId="filterAttrs"
          hint="Triggers only when these attributes change (Update message only)"
          as="div"
          className="input-group">
          <input
            id="filterAttrs"
            type="text"
            readOnly
            className="readonly-input"
            value={form.filteringAttributes}
            placeholder="Click … to select attributes"
          />
          <button type="button" title="Select attributes" disabled={!form.entityCode || state.attrPickerLoading} onClick={handlePickAttributes}>
            …
          </button>
        </Field>

        {/* ── Step Name ── */}
        <Field label="Step Name" as="input" fieldId="stepName"
          type="text" value={form.stepName} placeholder="Auto-generated if empty"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            dispatch({
              type: "setForm",
              payload: {
                stepName: e.target.value,
                stepNameManuallySet: e.target.value.trim().length > 0,
              },
            })
          }
        />

        {/* ── Unsecure Config ── */}
        <Field label="Unsecure Configuration" as="textarea" fieldId="unsecureConfig"
          value={form.unsecureConfig} placeholder="JSON or plain text passed to plugin constructor"
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => dispatch({ type: "setForm", payload: { unsecureConfig: e.target.value } })}
        />

        {/* ── Description ── */}
        <Field label="Description" as="input" fieldId="descInput"
          type="text" value={form.description}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => dispatch({ type: "setForm", payload: { description: e.target.value } })}
        />

        <div className="actions">
          <button
            type="button"
            className="secondary"
            onClick={() => dispatch({ type: "cancel", meta: { toExtension: true } })}
          >
            Cancel
          </button>
          <button type="submit" className="primary" disabled={saving || !form.messageId || state.messagesLoading}>
            {saving ? "Saving…" : "Save Step"}
          </button>
        </div>
      </form>

      {/* ── Step Images ── */}
      {options.mode === "edit" && (
        <fieldset className="images-section">
          <legend>Step Images</legend>
          {images.length === 0 && (
            <p className="hint" style={{ marginBottom: 10 }}>No images registered for this step.</p>
          )}
          {images.map((img) => (
            <div key={img.sdkmessageprocessingstepimageid ?? img.entityalias} className="image-row">
              <span className="image-name">{img.name}</span>
              <span className="image-alias">alias: {img.entityalias}</span>
              <span className="image-type">{imageTypeLabel(img.imagetype)}</span>
              <div className="image-actions">
                <IconButton
                  icon="edit"
                  label="Edit image"
                  onClick={() => dispatch({ type: "openImageForm", payload: img })}
                />
                <IconButton
                  icon="trash"
                  label="Delete image"
                  variant="danger"
                  onClick={() =>
                    dispatch({ type: "deleteImage", payload: img.sdkmessageprocessingstepimageid!, meta: { toExtension: true } })
                  }
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            className="secondary"
            style={{ marginTop: 8 }}
            onClick={() => dispatch({ type: "openImageForm" })}
          >
            <Codicon name="add" /> <span>Add Image</span>
          </button>
        </fieldset>
      )}

      {/* ── Image Form Modal ── */}
      {imageFormOpen && (
        <ImageForm
          image={editingImage}
          onSave={(img) => dispatch({ type: "saveImage", payload: img, meta: { toExtension: true } })}
          onCancel={() => dispatch({ type: "closeImageForm" })}
        />
      )}
    </div>
  );
}
