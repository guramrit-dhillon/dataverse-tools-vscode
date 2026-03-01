import * as vscode from "vscode";
import {
  type DataverseAccountApi,
  type DataverseEnvironment,
  Logger,
  Panel,
} from "core-dataverse";
import {
  type IQueryService,
  type QueryResult,
} from "../interfaces/IQueryService";
import { type IMetadataCache } from "../interfaces/IMetadataCache";

interface SavedQuery {
  name: string;
  sql: string;
}

interface HistoryEntry {
  sql: string;
  timestamp: string;
  durationMs: number;
  rowCount: number;
}

const WS_KEY_HISTORY = "queryAnalyzer.history";
const MAX_HISTORY = 50;

interface QueryPanelInitPayload {
  envName: string | undefined;
  initialSql?: string;
  savedQueries: SavedQuery[];
}

/**
 * Multi-instance Webview panel for Query Analyzer, keyed by environment ID.
 *
 * Panels without an environment use a shared "no-env" key.
 * When the user picks an environment from within a panel the instance
 * re-keys itself in the map and updates its tab title.
 */
export class QueryPanel extends Panel {
  private static readonly panels = new Map<string, QueryPanel>();
  private static readonly NO_ENV_KEY = "__no-env__";

  private envKey: string;

  static render(
    extensionUri: vscode.Uri,
    env: DataverseEnvironment | undefined,
    api: DataverseAccountApi,
    queryService: IQueryService,
    metadataCache: IMetadataCache,
    workspaceState: vscode.Memento,
    initialSql?: string
  ): void {
    const savedQueries = workspaceState.get<SavedQuery[]>(
      "queryAnalyzer.savedQueries",
      []
    );
    const payload: QueryPanelInitPayload = {
      envName: env?.name,
      initialSql,
      savedQueries,
    };
    const key = env?.id ?? QueryPanel.NO_ENV_KEY;
    const title = env ? `Query Analyzer (${env.name})` : "Query Analyzer";

    const existing = QueryPanel.panels.get(key);
    if (existing) {
      existing.env = env;
      existing.api = api;
      existing.queryService = queryService;
      existing.metadataCache = metadataCache;
      existing.workspaceState = workspaceState;
      existing.activate(title, payload);
      return;
    }
    const instance = new QueryPanel(
      extensionUri,
      key,
      env,
      api,
      queryService,
      metadataCache,
      workspaceState,
      payload
    );
    QueryPanel.panels.set(key, instance);
  }

  static isOpen(): boolean {
    return QueryPanel.panels.size > 0;
  }

  static notifyEnvChanged(env: DataverseEnvironment): void {
    const key = env.id;
    const panel = QueryPanel.panels.get(key);
    if (panel) {
      panel.env = env;
      panel.setTitle(`Query Analyzer (${env.name})`);
      panel.postMessage({
        type: "envChanged",
        payload: { envName: env.name },
      });
    }
  }

  static triggerExecute(): void {
    // Trigger on all open panels
    for (const panel of QueryPanel.panels.values()) {
      panel.postMessage({ type: "triggerExecute" });
    }
  }

  /** Trigger environment change on the currently visible panel (for tab context menu). */
  static async changeEnvironment(): Promise<void> {
    for (const panel of QueryPanel.panels.values()) {
      if (panel.visible) {
        const result = await panel.handleChangeEnvironment();
        if (result) {
          panel.postMessage({ type: "changeEnvironment:response", payload: result });
        }
        return;
      }
    }
  }

  private env: DataverseEnvironment | undefined;
  private api: DataverseAccountApi;
  private queryService: IQueryService;
  private metadataCache: IMetadataCache;
  private workspaceState: vscode.Memento;

  private constructor(
    extensionUri: vscode.Uri,
    envKey: string,
    env: DataverseEnvironment | undefined,
    api: DataverseAccountApi,
    queryService: IQueryService,
    metadataCache: IMetadataCache,
    workspaceState: vscode.Memento,
    payload: QueryPanelInitPayload
  ) {
    const title = env ? `Query Analyzer (${env.name})` : "Query Analyzer";
    const iconPath = {
      light: vscode.Uri.joinPath(extensionUri, "resources", "light", "query-analyzer.svg"),
      dark: vscode.Uri.joinPath(extensionUri, "resources", "dark", "query-analyzer.svg"),
    };
    super(
      extensionUri,
      "dataverse-tools.queryPanel",
      title,
      payload,
      { allowInlineStyles: true, iconPath },
    );
    this.envKey = envKey;
    this.env = env;
    this.api = api;
    this.queryService = queryService;
    this.metadataCache = metadataCache;
    this.workspaceState = workspaceState;

    this.initListeners({
      execute: this.handleExecute.bind(this),
      loadSchema: this.handleLoadSchema.bind(this),
      loadColumnsForTable: this.handleLoadColumnsForTable.bind(this),
      changeEnvironment: this.handleChangeEnvironment.bind(this),
      saveQuery: this.handleSaveQuery.bind(this),
      loadSavedQueries: this.handleLoadSavedQueries.bind(this),
      deleteSavedQuery: this.handleDeleteSavedQuery.bind(this),
      exportResults: this.handleExportResults.bind(this),
      loadHistory: this.handleLoadHistory.bind(this),
      clearHistory: this.handleClearHistory.bind(this),
    });
  }

  private async handleExecute(payload: {
    sql: string;
  }): Promise<QueryResult> {
    if (!this.env) {
      throw new Error("No environment selected. Select an environment first.");
    }

    Logger.info(`Executing SQL query against ${this.env.name}`);
    const result = await this.queryService.execute(this.env, {
      sql: payload.sql,
    });

    // Auto-record to history
    const history = this.workspaceState.get<HistoryEntry[]>(WS_KEY_HISTORY, []);
    history.unshift({
      sql: payload.sql,
      timestamp: new Date().toISOString(),
      durationMs: result.durationMs,
      rowCount: result.rowCount,
    });
    if (history.length > MAX_HISTORY) { history.length = MAX_HISTORY; }
    await this.workspaceState.update(WS_KEY_HISTORY, history);

    return result;
  }

  private async handleLoadSchema(): Promise<{
    tables: { logicalName: string; displayName: string }[];
  }> {
    if (!this.env) {
      return { tables: [] };
    }
    const schema = await this.metadataCache.getSchema(this.env);
    return { tables: schema.tables };
  }

  private async handleLoadColumnsForTable(payload: {
    tableName: string;
  }): Promise<{
    columns: { logicalName: string; type: string; displayName: string }[];
  }> {
    if (!this.env) {
      return { columns: [] };
    }
    const columns = await this.metadataCache.getColumns(
      this.env,
      payload.tableName
    );
    return { columns };
  }

  private async handleChangeEnvironment(): Promise<
    { envName: string } | undefined
  > {
    const result = await this.api.pickEnvironment({ activeEnvironmentId: this.env?.id });
    if (!result) {
      return undefined;
    }

    const newEnv = result.environment;
    const newKey = newEnv.id;

    // If a panel already exists for the target environment, reveal it instead
    if (newKey !== this.envKey && QueryPanel.panels.has(newKey)) {
      const existing = QueryPanel.panels.get(newKey)!;
      existing.activate(`Query Analyzer (${newEnv.name})`, { envName: newEnv.name, savedQueries: this.workspaceState.get<SavedQuery[]>("queryAnalyzer.savedQueries", []) });
      return;
    }

    // Re-key in the map
    QueryPanel.panels.delete(this.envKey);
    this.envKey = newKey;
    this.env = newEnv;
    QueryPanel.panels.set(newKey, this);

    this.metadataCache.invalidate();
    this.setTitle(`Query Analyzer (${newEnv.name})`);

    return { envName: newEnv.name };
  }

  private async handleSaveQuery(
    payload: SavedQuery
  ): Promise<SavedQuery[]> {
    const key = "queryAnalyzer.savedQueries";
    const saved = this.workspaceState.get<SavedQuery[]>(key, []);
    const existing = saved.findIndex((q) => q.name === payload.name);
    if (existing >= 0) {
      saved[existing] = payload;
    } else {
      saved.push(payload);
    }
    await this.workspaceState.update(key, saved);
    return saved;
  }

  private async handleLoadSavedQueries(): Promise<SavedQuery[]> {
    return this.workspaceState.get<SavedQuery[]>(
      "queryAnalyzer.savedQueries",
      []
    );
  }

  private async handleDeleteSavedQuery(payload: {
    name: string;
  }): Promise<SavedQuery[]> {
    const key = "queryAnalyzer.savedQueries";
    const saved = this.workspaceState.get<SavedQuery[]>(key, []);
    const filtered = saved.filter((q) => q.name !== payload.name);
    await this.workspaceState.update(key, filtered);
    return filtered;
  }

  private async handleLoadHistory(): Promise<HistoryEntry[]> {
    return this.workspaceState.get<HistoryEntry[]>(WS_KEY_HISTORY, []);
  }

  private async handleClearHistory(): Promise<HistoryEntry[]> {
    await this.workspaceState.update(WS_KEY_HISTORY, []);
    return [];
  }

  private async handleExportResults(payload: {
    format: "csv" | "json";
    content: string;
  }): Promise<void> {
    const defaultName =
      payload.format === "csv" ? "query-results.csv" : "query-results.json";
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(defaultName),
      filters:
        payload.format === "csv"
          ? { "CSV Files": ["csv"] }
          : { "JSON Files": ["json"] },
    });
    if (uri) {
      await vscode.workspace.fs.writeFile(
        uri,
        Buffer.from(payload.content, "utf-8")
      );
      vscode.window.showInformationMessage(
        `Results exported to ${uri.fsPath}`
      );
    }
  }

  protected override dispose(): void {
    QueryPanel.panels.delete(this.envKey);
    super.dispose();
  }
}
