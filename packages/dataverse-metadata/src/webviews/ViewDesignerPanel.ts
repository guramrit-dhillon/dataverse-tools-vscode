import * as vscode from "vscode";
import { type DataverseEnvironment, Panel } from "core-dataverse";
import type { IMetadataService } from "../interfaces/IMetadataService";
import { VIEW_DESIGNER_VIEW_TYPE } from "../constants";

/**
 * Webview panel for the View Designer. Opens one panel per entity (keyed by
 * `entityLogicalName`). Loads the list of views and initial view details on
 * ready, then handles `switchView` messages from the webview.
 */
export class ViewDesignerPanel extends Panel {
  static readonly #instances = new Map<string, ViewDesignerPanel>();

  private constructor(
    extensionUri: vscode.Uri,
    private env: DataverseEnvironment,
    private metadataSvc: IMetadataService,
    private readonly entityLogicalName: string,
    private readonly entityDisplayName: string | undefined,
    private readonly initialViewId: string,
  ) {
    const title = (entityDisplayName || entityLogicalName) + " — Views";
    super(extensionUri, VIEW_DESIGNER_VIEW_TYPE, title, undefined);

    this.initListeners({
      switchView: async ({ savedqueryid }: { savedqueryid: string }, successCallback: (r: undefined) => void) => {
        successCallback(undefined);
        try {
          const current = await this.metadataSvc.getViewDetails(this.env, savedqueryid);
          this.postMessage({ type: "viewLoaded", payload: { current } });
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : "Failed to load view";
          this.postMessage({ type: "viewError", payload: { message: msg } });
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
    initialViewId: string,
  ): void {
    const existing = ViewDesignerPanel.#instances.get(entityLogicalName);
    if (existing) {
      existing.env = env;
      existing.metadataSvc = metadataSvc;
      existing.reveal();
      existing.postMessage({ type: "setView", payload: { savedqueryid: initialViewId } });
      return;
    }
    const instance = new ViewDesignerPanel(
      extensionUri,
      env,
      metadataSvc,
      entityLogicalName,
      entityDisplayName,
      initialViewId,
    );
    ViewDesignerPanel.#instances.set(entityLogicalName, instance);
  }

  protected override async onReady(): Promise<void> {
    const [viewsResult, detailResult] = await Promise.allSettled([
      this.metadataSvc.listViews(this.env, this.entityLogicalName),
      this.metadataSvc.getViewDetails(this.env, this.initialViewId),
    ]);
    if (viewsResult.status === "fulfilled") {
      this.postMessage({
        type: "viewInit",
        payload: { views: viewsResult.value, entityDisplayName: this.entityDisplayName },
      });
    }
    if (detailResult.status === "fulfilled") {
      this.postMessage({ type: "viewLoaded", payload: { current: detailResult.value } });
    } else {
      this.postMessage({
        type: "viewError",
        payload: { message: detailResult.reason instanceof Error ? detailResult.reason.message : "Failed to load view" },
      });
    }
  }

  protected override dispose(): void {
    ViewDesignerPanel.#instances.delete(this.entityLogicalName);
    super.dispose();
  }
}
