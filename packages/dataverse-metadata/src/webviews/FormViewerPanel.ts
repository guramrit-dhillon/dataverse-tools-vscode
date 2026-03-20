import * as vscode from "vscode";
import { type DataverseEnvironment, Panel } from "core-dataverse";
import type { IMetadataService } from "../interfaces/IMetadataService";
import { FORM_VIEWER_VIEW_TYPE } from "../constants";

/**
 * Webview panel for the Form Viewer. Opens one panel per entity (keyed by
 * `entityLogicalName`). Loads the list of forms and initial form details on
 * ready, then handles `switchForm` messages from the webview.
 */
export class FormViewerPanel extends Panel {
  static readonly #instances = new Map<string, FormViewerPanel>();

  private constructor(
    extensionUri: vscode.Uri,
    private env: DataverseEnvironment,
    private metadataSvc: IMetadataService,
    private readonly entityLogicalName: string,
    private readonly entityDisplayName: string | undefined,
    private readonly initialFormId: string,
  ) {
    const title = (entityDisplayName || entityLogicalName) + " — Forms";
    super(extensionUri, FORM_VIEWER_VIEW_TYPE, title, undefined);

    this.initListeners({
      switchForm: async ({ formid }: { formid: string }, successCallback: (r: undefined) => void) => {
        successCallback(undefined);
        try {
          const current = await this.metadataSvc.getFormDetails(this.env, formid);
          this.postMessage({ type: "formLoaded", payload: { current } });
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : "Failed to load form";
          this.postMessage({ type: "formError", payload: { message: msg } });
        }
      },
    });
  }

  static render(
    extensionUri: vscode.Uri,
    env: DataverseEnvironment,
    metadataSvc: IMetadataService,
    entityLogicalName: string,
    entityDisplayName: string | undefined,
    initialFormId: string,
  ): void {
    const existing = FormViewerPanel.#instances.get(entityLogicalName);
    if (existing) {
      existing.env = env;
      existing.metadataSvc = metadataSvc;
      existing.reveal();
      existing.postMessage({ type: "setForm", payload: { formid: initialFormId } });
      return;
    }
    const instance = new FormViewerPanel(
      extensionUri,
      env,
      metadataSvc,
      entityLogicalName,
      entityDisplayName,
      initialFormId,
    );
    FormViewerPanel.#instances.set(entityLogicalName, instance);
  }

  protected override async onReady(): Promise<void> {
    const [formsResult, detailResult] = await Promise.allSettled([
      this.metadataSvc.listForms(this.env, this.entityLogicalName),
      this.metadataSvc.getFormDetails(this.env, this.initialFormId),
    ]);
    if (formsResult.status === "fulfilled") {
      this.postMessage({
        type: "formInit",
        payload: { forms: formsResult.value, entityDisplayName: this.entityDisplayName },
      });
    }
    if (detailResult.status === "fulfilled") {
      this.postMessage({ type: "formLoaded", payload: { current: detailResult.value } });
    } else {
      this.postMessage({
        type: "formError",
        payload: { message: detailResult.reason instanceof Error ? detailResult.reason.message : "Failed to load form" },
      });
    }
  }

  protected override dispose(): void {
    FormViewerPanel.#instances.delete(this.entityLogicalName);
    super.dispose();
  }
}
