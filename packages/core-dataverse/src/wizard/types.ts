// ── Step result ─────────────────────────────────────────────────────────────

export interface StepResult<S> {
  /** Page id to navigate to. `undefined` means the wizard is done. */
  next?: string;
  /** Shallow-merged into wizard state. */
  update?: Partial<S>;
  /** When true, pop the last entry from the back-history before navigating. */
  pop?: boolean;
}

// ── QuickPick page ──────────────────────────────────────────────────────────

export interface QuickPickWizardItem {
  label: string;
  description?: string;
  detail?: string;
  /** Routed to `onSelect` when the user picks this item. */
  action: string;
  /** `vscode.QuickPickItemKind` value (Separator = -1, Default = 0). */
  kind?: number;
  alwaysShow?: boolean;
  /** Arbitrary payload the consumer can attach and read back in `onSelect`. */
  data?: unknown;
}

export interface QuickPickConfig {
  placeholder?: string;
  items: QuickPickWizardItem[];
  busy?: boolean;
  /** Action string of the item to pre-select (highlight). */
  activeAction?: string;
}

/** Control handle passed to `onSelect`, allowing the consumer to update the QuickPick UI during async work. */
export interface QuickPickControl {
  /** Show a busy shimmer and display the given placeholder text. Clears items by default unless `clearItems` is false. */
  setBusy(placeholder: string, clearItems?: boolean): void;
  /** Update the title bar text. */
  setTitle(title: string): void;
  /** Update the placeholder text without affecting items or busy state. */
  setPlaceholder(text: string): void;
  /** Enable or disable the QuickPick input. */
  setEnabled(enabled: boolean): void;
}

export interface QuickPickPageDef<S> {
  type: "quickpick";
  /** Shown while an async `render` is in flight. Ignored for sync renders. */
  loading?: {
    placeholder?: string;
    /** Items the user can interact with during loading (e.g. "Enter custom URL…"). */
    items?: QuickPickWizardItem[];
  };
  render: (state: S, signal: AbortSignal) => QuickPickConfig | Promise<QuickPickConfig>;
  onSelect: (action: string, item: QuickPickWizardItem, state: S, ui: QuickPickControl) => StepResult<S> | Promise<StepResult<S>>;
}

// ── Input page ──────────────────────────────────────────────────────────────

export interface InputConfig {
  prompt: string;
  value?: string;
  placeholder?: string;
  password?: boolean;
  validate?: (value: string) => string | undefined;
}

export interface InputPageDef<S> {
  type: "input";
  render: (state: S) => InputConfig;
  onSubmit: (value: string, state: S) => StepResult<S> | Promise<StepResult<S>>;
}

// ── Multi-input page ────────────────────────────────────────────────────────

export interface InputFieldConfig {
  key: string;
  title: string;
  prompt: string;
  value?: string;
  placeholder?: string;
  password?: boolean;
  validate?: (value: string) => string | undefined;
}

export interface MultiInputConfig {
  fields: InputFieldConfig[];
}

export interface MultiInputPageDef<S> {
  type: "multi-input";
  render: (state: S) => MultiInputConfig;
  onSubmit: (values: Record<string, string>, state: S) => StepResult<S> | Promise<StepResult<S>>;
}

// ── Wizard page (union) ─────────────────────────────────────────────────────

export type WizardPage<S> = {
  id: string;
  title: string;
  /** When true, this page is never pushed to the back-history stack. Back from this page returns to the previous non-ephemeral page. */
  ephemeral?: boolean;
} & (QuickPickPageDef<S> | InputPageDef<S> | MultiInputPageDef<S>);

// ── Wizard config ───────────────────────────────────────────────────────────

export interface WizardConfig<S> {
  /** Displayed as the prefix in the title bar, e.g. "Add Dataverse Environment". */
  title: string;
  pages: WizardPage<S>[];
  initialState: S;
  startPage: string;
}
