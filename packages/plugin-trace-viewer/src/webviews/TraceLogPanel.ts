import * as vscode from "vscode";
import {
  type DataverseAccountApi,
  type DataverseEnvironment,
  type TraceLogFilter,
  Logger,
  Panel,
} from "core-dataverse";
import type { TraceLogService } from "../services/TraceLogService";

/** Options sent to the webview on init / re-activate. */
interface TraceLogInitPayload {
  filter?: Partial<TraceLogFilter>;
  envName: string;
}

/**
 * Multi-instance Webview panel for Plugin Trace Logs, keyed by environment ID.
 *
 * Opening it from a tree node (assembly or plugin type) sends an
 * "applyFilter" message to pre-fill and auto-retrieve logs for that item.
 * If a panel for the same environment is already open it is revealed and
 * re-filtered in-place. Different environments get separate tabs.
 */
export class TraceLogPanel extends Panel {
  private static readonly panels = new Map<string, TraceLogPanel>();

  private envKey: string;

  private constructor(
    extensionUri: vscode.Uri,
    private env: DataverseEnvironment,
    private api: DataverseAccountApi,
    private traceLogSvc: TraceLogService,
    initialFilter?: Partial<TraceLogFilter>,
  ) {
    const initPayload: TraceLogInitPayload = { filter: initialFilter, envName: env.name };
    const iconPath = {
      light: vscode.Uri.joinPath(extensionUri, "resources", "light", "trace-log.svg"),
      dark: vscode.Uri.joinPath(extensionUri, "resources", "dark", "trace-log.svg"),
    };
    super(
      extensionUri,
      "dataverse-tools.traceLog",
      `Plugin Trace Logs (${env.name})`,
      initPayload,
      { iconPath },
    );
    this.envKey = env.id;

    this.initListeners({
      retrieve: this.handleRetrieve.bind(this),
      suggestions: this.getSuggestions.bind(this),
      changeEnvironment: this.handleChangeEnvironment.bind(this),
    });
  }

  /** Open or focus the panel, optionally pre-applying a filter. */
  static render(
    extensionUri: vscode.Uri,
    env: DataverseEnvironment,
    api: DataverseAccountApi,
    traceLogSvc: TraceLogService,
    initialFilter?: Partial<TraceLogFilter>
  ): void {
    const key = env.id;
    const existing = TraceLogPanel.panels.get(key);
    if (existing) {
      existing.env = env;
      existing.api = api;
      existing.traceLogSvc = traceLogSvc;
      const payload: TraceLogInitPayload = { filter: initialFilter, envName: env.name };
      existing.activate(`Plugin Trace Logs (${env.name})`, payload);
      return;
    }
    const instance = new TraceLogPanel(extensionUri, env, api, traceLogSvc, initialFilter);
    TraceLogPanel.panels.set(key, instance);
  }

  /** Trigger environment change on the currently visible panel (for tab context menu). */
  static async changeEnvironment(): Promise<void> {
    for (const panel of TraceLogPanel.panels.values()) {
      if (panel.visible) {
        const result = await panel.handleChangeEnvironment();
        if (result) {
          panel.postMessage({ type: "changeEnvironment:response", payload: result });
        }
        return;
      }
    }
  }

  // ── Message handlers ───────────────────────────────────────────────────────

  private async handleRetrieve(filter: TraceLogFilter) {
    try {
      return await this.traceLogSvc.listTraceLogs(this.env, filter);
    } catch (err) {
      Logger.error("Failed to retrieve trace logs", err);
      throw new Error(err instanceof Error ? err.message : String(err));
    }
  }

  private async getSuggestions() {
    try {
      return await this.traceLogSvc.listSuggestions(this.env);
    } catch (err) {
      Logger.warn("Failed to load trace log suggestions", err instanceof Error ? { message: err.message } : {});
      throw new Error(err instanceof Error ? err.message : String(err));
    }
  }

  private async handleChangeEnvironment() {
    const result = await this.api.pickEnvironment({ activeEnvironmentId: this.env.id });
    if (!result) { return; }

    const newEnv = result.environment;
    const newKey = newEnv.id;

    // If a panel already exists for the target environment, reveal it instead
    if (newKey !== this.envKey && TraceLogPanel.panels.has(newKey)) {
      const existing = TraceLogPanel.panels.get(newKey)!;
      existing.activate(`Plugin Trace Logs (${newEnv.name})`, { envName: newEnv.name });
      return;
    }

    // Re-key in the map
    TraceLogPanel.panels.delete(this.envKey);
    this.envKey = newKey;
    this.env = newEnv;
    TraceLogPanel.panels.set(newKey, this);

    // Update only the tab title (don't re-send init)
    this.setTitle(`Plugin Trace Logs (${newEnv.name})`);

    return { envName: newEnv.name };
  }

  protected override dispose(): void {
    TraceLogPanel.panels.delete(this.envKey);
    super.dispose();
  }
}
