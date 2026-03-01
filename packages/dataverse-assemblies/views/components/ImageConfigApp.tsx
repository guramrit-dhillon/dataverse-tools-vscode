import * as React from "react";
import { useEffect, useCallback } from "react";
import { useReducer, ErrorBanner, Codicon, IconButton } from "shared-views";
import { ImageForm, imageTypeLabel } from "./ImageForm";
import type { StepImage } from "./ImageForm";

// ── Types ─────────────────────────────────────────────────────────────────────

interface StepInfo {
  sdkmessageprocessingstepid: string;
  name: string;
}

interface InitPayload {
  step: StepInfo;
}

// ── State & Actions ──────────────────────────────────────────────────────────

interface State {
  step: StepInfo | null;
  images: StepImage[];
  loading: boolean;
  error: string | null;
  formOpen: boolean;
  editingImage: StepImage | null;
}

const initialState: State = {
  step: null,
  images: [],
  loading: true,
  error: null,
  formOpen: false,
  editingImage: null,
};

type Action =
  // From extension:
  | { type: "init"; payload: InitPayload }
  | { type: "loadImages:response"; payload: StepImage[] }
  | { type: "loadImages:error"; payload: string }
  | { type: "save:response"; payload: StepImage }
  | { type: "save:error"; payload: string }
  | { type: "delete:response"; payload: string }
  | { type: "delete:error"; payload: string }
  // To extension:
  | { type: "ready"; meta: { toExtension: true } }
  | { type: "loadImages"; meta: { toExtension: true } }
  | { type: "save"; payload: StepImage; meta: { toExtension: true } }
  | { type: "delete"; payload: string; meta: { toExtension: true } }
  // Local UI:
  | { type: "openForm"; payload?: StepImage }
  | { type: "closeForm" }
  | { type: "clearError" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "init":
      return { ...state, step: action.payload.step };
    case "loadImages:response":
      return { ...state, images: action.payload, loading: false };
    case "loadImages:error":
      return { ...state, error: action.payload, loading: false };
    case "save:response": {
      const saved = action.payload;
      const idx = state.images.findIndex(
        (i) => i.sdkmessageprocessingstepimageid === saved.sdkmessageprocessingstepimageid
      );
      return {
        ...state,
        images: idx >= 0
          ? state.images.map((img, n) => (n === idx ? saved : img))
          : [...state.images, saved],
        formOpen: false,
        editingImage: null,
      };
    }
    case "save:error":
      return { ...state, error: action.payload };
    case "delete:response":
      return { ...state, images: state.images.filter((i) => i.sdkmessageprocessingstepimageid !== action.payload) };
    case "delete:error":
      return { ...state, error: action.payload };
    case "openForm":
      return { ...state, formOpen: true, editingImage: action.payload ?? null };
    case "closeForm":
      return { ...state, formOpen: false, editingImage: null };
    case "clearError":
      return { ...state, error: null };
    // Actions sent to extension — no local state change:
    case "ready":
    case "loadImages":
    case "save":
    case "delete":
      return state;
  }
}

// ── Root component ────────────────────────────────────────────────────────────

export function ImageConfigApp(): React.ReactElement {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { step, images, loading, error, formOpen, editingImage } = state;

  useEffect(() => {
    dispatch({ type: "ready", meta: { toExtension: true } });
    dispatch({ type: "loadImages", meta: { toExtension: true } });
  }, []);

  const handleSave = useCallback((img: StepImage) => {
    dispatch({ type: "save", payload: img, meta: { toExtension: true } });
  }, []);

  const handleDelete = useCallback((id: string) => {
    dispatch({ type: "delete", payload: id, meta: { toExtension: true } });
  }, []);

  if (!step) {
    return <div className="loading">Initialising…</div>;
  }

  return (
    <div className="container">
      <h2>Step Images</h2>
      <p className="subtitle">{step.name}</p>

      <ErrorBanner error={error} onDismiss={() => dispatch({ type: "clearError" })} />

      {loading ? (
        <div className="loading">Loading images…</div>
      ) : (
        <>
          {images.length === 0 ? (
            <p className="empty-hint">No images registered for this step.</p>
          ) : (
            images.map((img) => (
              <div className="image-card" key={img.sdkmessageprocessingstepimageid}>
                <div className="image-card-info">
                  <div className="image-card-name">{img.name}</div>
                  <div className="image-card-meta">
                    <span>alias: {img.entityalias}</span>
                    <span className="image-type-badge">{imageTypeLabel(img.imagetype)}</span>
                    <span>prop: {img.messagepropertyname}</span>
                    {img.attributes && <span>attrs: {img.attributes}</span>}
                  </div>
                </div>
                <div className="image-card-actions">
                  <IconButton
                    icon="edit"
                    label="Edit image"
                    onClick={() => dispatch({ type: "openForm", payload: img })}
                  />
                  <IconButton
                    icon="trash"
                    label="Delete image"
                    variant="danger"
                    onClick={() => handleDelete(img.sdkmessageprocessingstepimageid!)}
                  />
                </div>
              </div>
            ))
          )}

          <div className="form-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => dispatch({ type: "openForm" })}
            >
              <Codicon name="add" /> Add Image
            </button>
          </div>
        </>
      )}

      {formOpen && (
        <ImageForm
          image={editingImage}
          onSave={handleSave}
          onCancel={() => dispatch({ type: "closeForm" })}
        />
      )}
    </div>
  );
}
