import * as vscode from "vscode";
import { Logger } from "../utils/logger";
import type {
  WizardConfig,
  WizardPage,
  QuickPickPageDef,
  InputPageDef,
  MultiInputPageDef,
  QuickPickConfig,
  QuickPickControl,
  QuickPickWizardItem,
  InputFieldConfig,
  StepResult,
} from "./types";

// ── Internal result types ───────────────────────────────────────────────────

type PageResult<S> =
  | { outcome: "cancel" }
  | { outcome: "back" }
  | { outcome: "complete"; stepResult: StepResult<S> };

type FieldResult =
  | { outcome: "cancel" }
  | { outcome: "back" }
  | { outcome: "value"; value: string };

// ── Title helper ────────────────────────────────────────────────────────────

function formatTitle(wizardTitle: string, pageTitle: string, stepNumber: number): string {
  if (stepNumber <= 1) {
    return `${wizardTitle} \u2014 ${pageTitle}`;
  }
  return `${wizardTitle} (Step ${stepNumber}) \u2014 ${pageTitle}`;
}

// ── QuickPick page ──────────────────────────────────────────────────────────

type TaggedItem = vscode.QuickPickItem & {
  _wizardAction?: string;
  _wizardItem?: QuickPickWizardItem;
};

function showQuickPickPage<S>(
  page: WizardPage<S> & QuickPickPageDef<S>,
  state: S,
  wizardTitle: string,
  stepNumber: number,
  canGoBack: boolean,
): Promise<PageResult<S>> {
  const qp = vscode.window.createQuickPick<TaggedItem>();
  qp.title = formatTitle(wizardTitle, page.title, stepNumber);
  qp.ignoreFocusOut = true;
  qp.busy = true;
  qp.items = [];
  if (canGoBack) {
    qp.buttons = [vscode.QuickInputButtons.Back];
  }

  const abortController = new AbortController();

  return new Promise<PageResult<S>>((resolve, reject) => {
    let resolved = false;

    const finish = (result: PageResult<S>): void => {
      if (resolved) { return; }
      resolved = true;
      abortController.abort();
      qp.dispose();
      resolve(result);
    };

    const fail = (err: unknown): void => {
      if (resolved) { return; }
      resolved = true;
      abortController.abort();
      qp.dispose();
      reject(err);
    };

    const applyConfig = (config: QuickPickConfig): void => {
      if (resolved) { return; }
      qp.placeholder = config.placeholder ?? "";
      qp.busy = config.busy ?? false;
      qp.items = config.items.map((item): TaggedItem => ({
        label: item.label,
        description: item.description,
        detail: item.detail,
        kind: item.kind as vscode.QuickPickItemKind | undefined,
        alwaysShow: item.alwaysShow,
        _wizardAction: item.action,
        _wizardItem: item,
      }));
      if (config.activeAction !== undefined) {
        const active = qp.items.find((i) => i._wizardAction === config.activeAction);
        if (active) { qp.activeItems = [active]; }
      }
    };

    // Render items (may be async)
    const renderResult = page.render(state, abortController.signal);

    if (renderResult instanceof Promise) {
      // Show loading state while async render is in flight
      if (page.loading) {
        qp.placeholder = page.loading.placeholder ?? "";
        if (page.loading.items) {
          qp.items = page.loading.items.map((item): TaggedItem => ({
            label: item.label,
            description: item.description,
            detail: item.detail,
            kind: item.kind as vscode.QuickPickItemKind | undefined,
            alwaysShow: item.alwaysShow,
            _wizardAction: item.action,
            _wizardItem: item,
          }));
        }
      }
      qp.show();
      renderResult.then(applyConfig).catch((err) => {
        if (!abortController.signal.aborted) { fail(err); }
      });
    } else {
      applyConfig(renderResult);
      qp.show();
    }

    qp.onDidAccept(() => {
      const selected = qp.selectedItems[0] as TaggedItem | undefined;
      if (!selected?._wizardAction || !selected._wizardItem) { return; }

      qp.enabled = false;

      const ui: QuickPickControl = {
        setBusy(placeholder, clearItems = true) { qp.busy = true; if (clearItems) { qp.items = []; } qp.placeholder = placeholder; },
        setTitle(title) { qp.title = title; },
        setPlaceholder(text) { qp.placeholder = text; },
        setEnabled(enabled) { qp.enabled = enabled; },
      };

      Promise.resolve(page.onSelect(selected._wizardAction, selected._wizardItem, state, ui))
        .then((stepResult) => { finish({ outcome: "complete", stepResult }); })
        .catch(fail);
    });

    qp.onDidTriggerButton((button) => {
      if (button === vscode.QuickInputButtons.Back) {
        finish({ outcome: "back" });
      }
    });

    qp.onDidHide(() => {
      finish({ outcome: "cancel" });
    });
  });
}

// ── Input page ──────────────────────────────────────────────────────────────

function showInputPage<S>(
  page: WizardPage<S> & InputPageDef<S>,
  state: S,
  wizardTitle: string,
  stepNumber: number,
  canGoBack: boolean,
): Promise<PageResult<S>> {
  const config = page.render(state);

  return new Promise<PageResult<S>>((resolve, reject) => {
    let resolved = false;
    const ib = vscode.window.createInputBox();

    const finish = (result: PageResult<S>): void => {
      if (resolved) { return; }
      resolved = true;
      ib.dispose();
      resolve(result);
    };

    const fail = (err: unknown): void => {
      if (resolved) { return; }
      resolved = true;
      ib.dispose();
      reject(err);
    };

    ib.title = formatTitle(wizardTitle, page.title, stepNumber);
    ib.prompt = config.prompt;
    ib.value = config.value ?? "";
    ib.placeholder = config.placeholder ?? "";
    ib.password = config.password ?? false;
    ib.ignoreFocusOut = true;
    if (canGoBack) {
      ib.buttons = [vscode.QuickInputButtons.Back];
    }

    if (config.validate) {
      const validate = config.validate;
      ib.onDidChangeValue((v) => {
        ib.validationMessage = validate(v) ?? "";
      });
    }

    ib.onDidAccept(() => {
      if (config.validate) {
        const err = config.validate(ib.value);
        if (err) { ib.validationMessage = err; return; }
      }

      ib.enabled = false;
      ib.busy = true;

      Promise.resolve(page.onSubmit(ib.value, state))
        .then((stepResult) => { finish({ outcome: "complete", stepResult }); })
        .catch(fail);
    });

    ib.onDidTriggerButton((button) => {
      if (button === vscode.QuickInputButtons.Back) {
        finish({ outcome: "back" });
      }
    });

    ib.onDidHide(() => {
      finish({ outcome: "cancel" });
    });

    ib.show();
  });
}

// ── Multi-input page ────────────────────────────────────────────────────────

function showSingleField(
  field: InputFieldConfig,
  wizardTitle: string,
  pageTitle: string,
  stepNumber: number,
  subStep: number,
  totalSubSteps: number,
  currentValue: string | undefined,
  canGoBack: boolean,
): Promise<FieldResult> {
  return new Promise<FieldResult>((resolve) => {
    let resolved = false;
    const ib = vscode.window.createInputBox();

    const finish = (result: FieldResult): void => {
      if (resolved) { return; }
      resolved = true;
      ib.dispose();
      resolve(result);
    };

    const subStepLabel = totalSubSteps > 1 ? ` (${subStep}/${totalSubSteps})` : "";
    ib.title = `${formatTitle(wizardTitle, pageTitle, stepNumber)} \u2014 ${field.title}${subStepLabel}`;
    ib.prompt = field.prompt;
    ib.value = currentValue ?? field.value ?? "";
    ib.placeholder = field.placeholder ?? "";
    ib.password = field.password ?? false;
    ib.ignoreFocusOut = true;

    if (canGoBack) {
      ib.buttons = [vscode.QuickInputButtons.Back];
    }

    if (field.validate) {
      const validate = field.validate;
      ib.onDidChangeValue((v) => {
        ib.validationMessage = validate(v) ?? "";
      });
    }

    ib.onDidAccept(() => {
      if (field.validate) {
        const err = field.validate(ib.value);
        if (err) { ib.validationMessage = err; return; }
      }
      finish({ outcome: "value", value: ib.value });
    });

    ib.onDidTriggerButton((button) => {
      if (button === vscode.QuickInputButtons.Back) {
        finish({ outcome: "back" });
      }
    });

    ib.onDidHide(() => {
      finish({ outcome: "cancel" });
    });

    ib.show();
  });
}

async function showMultiInputPage<S>(
  page: WizardPage<S> & MultiInputPageDef<S>,
  state: S,
  wizardTitle: string,
  stepNumber: number,
  canGoBack: boolean,
): Promise<PageResult<S>> {
  const config = page.render(state);
  const { fields } = config;

  if (fields.length === 0) {
    const stepResult = await page.onSubmit({}, state);
    return { outcome: "complete", stepResult };
  }

  // Pre-populate from field defaults; updated as user fills in values
  const values: Record<string, string> = {};
  for (const f of fields) {
    if (f.value !== undefined) {
      values[f.key] = f.value;
    }
  }

  let fieldIndex = 0;

  while (fieldIndex >= 0 && fieldIndex < fields.length) {
    const field = fields[fieldIndex];
    const isFirstField = fieldIndex === 0;
    const isLastField = fieldIndex === fields.length - 1;
    const showBack = canGoBack || !isFirstField;

    const fieldResult = await showSingleField(
      field,
      wizardTitle,
      page.title,
      stepNumber,
      fieldIndex + 1,
      fields.length,
      values[field.key],
      showBack,
    );

    if (fieldResult.outcome === "cancel") {
      return { outcome: "cancel" };
    }

    if (fieldResult.outcome === "back") {
      if (isFirstField) {
        return { outcome: "back" };
      }
      fieldIndex--;
      continue;
    }

    values[field.key] = fieldResult.value;

    if (isLastField) {
      const stepResult = await page.onSubmit(values, state);
      return { outcome: "complete", stepResult };
    }

    fieldIndex++;
  }

  return { outcome: "cancel" };
}

// ── Main runner ─────────────────────────────────────────────────────────────

export async function runWizard<S>(config: WizardConfig<S>): Promise<S | undefined> {
  const pageMap = new Map<string, WizardPage<S>>();
  for (const page of config.pages) {
    pageMap.set(page.id, page);
  }

  let state: S = { ...config.initialState };
  const history: string[] = [];
  let currentPageId = config.startPage;

  while (true) {
    const page = pageMap.get(currentPageId);
    if (!page) {
      Logger.warn("Wizard: unknown page", { pageId: currentPageId });
      return undefined;
    }

    const stepNumber = history.length + 1;
    const canGoBack = history.length > 0;

    let result: PageResult<S>;
    try {
      if (page.type === "quickpick") {
        result = await showQuickPickPage(page as WizardPage<S> & QuickPickPageDef<S>, state, config.title, stepNumber, canGoBack);
      } else if (page.type === "input") {
        result = await showInputPage(page as WizardPage<S> & InputPageDef<S>, state, config.title, stepNumber, canGoBack);
      } else {
        result = await showMultiInputPage(page as WizardPage<S> & MultiInputPageDef<S>, state, config.title, stepNumber, canGoBack);
      }
    } catch (err) {
      Logger.error("Wizard: page error", err);
      vscode.window.showErrorMessage(
        `Wizard error: ${err instanceof Error ? err.message : String(err)}`
      );
      return undefined;
    }

    if (result.outcome === "cancel") {
      return undefined;
    }

    if (result.outcome === "back") {
      currentPageId = history.pop()!;
      continue;
    }

    if (result.stepResult.update) {
      state = { ...state, ...result.stepResult.update };
    }

    if (result.stepResult.next === undefined) {
      return state;
    }

    // Pop last history entry if requested (e.g. ephemeral sub-page cleaning up its parent's duplicate)
    if (result.stepResult.pop && history.length > 0) {
      history.pop();
    }

    // Same-page navigation (e.g. "retry") — re-render without pushing to history
    // Ephemeral pages are never pushed to the back stack
    if (result.stepResult.next !== currentPageId && !page.ephemeral) {
      history.push(currentPageId);
    }
    currentPageId = result.stepResult.next;
  }
}
