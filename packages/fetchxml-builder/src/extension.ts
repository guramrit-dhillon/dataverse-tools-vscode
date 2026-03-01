import * as vscode from "vscode";
import {
  type DataverseAccountApi,
  type DataverseEnvironment,
  DataverseWebApiClient,
  Logger,
  registerCommand,
  ExtensionIds,
  Commands,
} from "core-dataverse";
import { FetchXmlTreeProvider } from "./providers/FetchXmlTreeProvider";
import { FetchXmlTreeItem } from "./providers/FetchXmlTreeItem";
import { NodePropertiesView } from "./webviews/NodePropertiesView";
import { ResultsPanel } from "./webviews/ResultsPanel";
import { FetchXmlExecutor } from "./services/FetchXmlExecutor";
import {
  defaultQuery,
  ALLOWED_CHILDREN,
  type FetchNodeKind,
} from "./model/FetchXmlNode";
import { serialize, parseFetchXml } from "./model/FetchXmlSerializer";
import {
  FetchXmlFileSystemProvider,
  FETCHXML_EDIT_SCHEME,
  FETCHXML_EDIT_URI,
} from "./providers/FetchXmlFileSystemProvider";
import { ExecuteFetchXmlTool } from "./tools/ExecuteFetchXmlTool";
import { CsvEditorProvider } from "./webviews/CsvEditorProvider";

// ── Workspace state keys ───────────────────────────────────────────────────────

const WS_KEY_ENV_ID = "fetchxml.envId";
const WS_KEY_LAST_XML = "fetchxml.lastXml";

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel(
    "Dataverse Tools: FetchXML Builder"
  );
  Logger.init(outputChannel);
  context.subscriptions.push(outputChannel);

  // ── Account extension API ──────────────────────────────────────────────────
  const accountExt = vscode.extensions.getExtension<DataverseAccountApi>(
    ExtensionIds.Environments
  );
  if (!accountExt) {
    vscode.window.showWarningMessage(
      "Dataverse Tools: Environments extension is not installed. FetchXML Builder requires it for environment access."
    );
    return;
  }

  // If Red Hat XML extension is present, associate our XSD with .fetchxml files.
  registerFetchXmlSchema(context);

  // activate() is idempotent — safe to call when already active.
  accountExt.activate().then((api: DataverseAccountApi) => {
    setupExtension(context, api);
  });
}

/**
 * Associates the bundled fetchxml.xsd with *.fetchxml files via the
 * Red Hat XML extension's xml.fileAssociations setting, if available.
 * No-ops silently if the extension is not installed.
 */
function registerFetchXmlSchema(context: vscode.ExtensionContext): void {
  if (!vscode.extensions.getExtension("redhat.vscode-xml")) { return; }

  const xsdUri = vscode.Uri.joinPath(context.extensionUri, "schemas", "fetchxml.xsd").toString();
  const config = vscode.workspace.getConfiguration("xml");
  const existing = config.get<{ pattern: string; systemId: string }[]>("fileAssociations", []);
  if (existing.some((a) => a.pattern === "**/*.fetchxml")) { return; }

  config.update(
    "fileAssociations",
    [...existing, { pattern: "**/*.fetchxml", systemId: xsdUri }],
    vscode.ConfigurationTarget.Global
  ).then(undefined, () => { /* ignore — user may have settings write restrictions */ });
}

function setupExtension(
  context: vscode.ExtensionContext,
  accountApi: DataverseAccountApi
): void {
  // ── Active environment + client ────────────────────────────────────────────
  let activeEnv: DataverseEnvironment | undefined;
  let client: DataverseWebApiClient | undefined;

  const setEnv = (env: DataverseEnvironment | undefined) => {
    activeEnv = env;
    client = env
      ? new DataverseWebApiClient(env, accountApi.getAccessToken.bind(accountApi))
      : undefined;
    treeView.description = env?.name ?? "No environment selected";
    // Invalidate caches and proactively push fresh entities to the webview.
    // Handles the race where the webview mounted before the service was ready.
    propertiesView.notifyEnvChanged();
    // Persist selected environment for this workspace.
    context.workspaceState.update(WS_KEY_ENV_ID, env?.id ?? undefined);
  };

  // ── Tree view ──────────────────────────────────────────────────────────────
  const treeProvider = new FetchXmlTreeProvider();

  const treeView = vscode.window.createTreeView("dataverse-tools.fetchxmlTree", {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  // ── Properties webview view ────────────────────────────────────────────────
  const propertiesView = new NodePropertiesView(
    context.extensionUri,
    treeProvider,
    () => client,
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      NodePropertiesView.viewType,
      propertiesView,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  // ── Editable XML view (FileSystemProvider) ─────────────────────────────────
  const fsProvider = new FetchXmlFileSystemProvider(treeProvider);
  context.subscriptions.push(
    vscode.workspace.registerFileSystemProvider(FETCHXML_EDIT_SCHEME, fsProvider)
  );

  // ── Persist tree XML + update editable XML on every change ────────────────
  // Registered before setRoot so even the initial load is captured.
  context.subscriptions.push(
    treeProvider.onDidChangeTreeData(() => {
      const root = treeProvider.getRoot();
      const xml = root ? serialize(root) : "";
      fsProvider.update(xml);
      if (xml) {
        context.workspaceState.update(WS_KEY_LAST_XML, xml);
      }
    })
  );

  // ── Restore last query (or use default) ───────────────────────────────────
  const savedXml = context.workspaceState.get<string>(WS_KEY_LAST_XML);
  const savedRoot = savedXml ? parseFetchXml(savedXml) : null;
  treeProvider.setRoot(savedRoot ?? defaultQuery());

  // ── Restore last selected environment ─────────────────────────────────────
  // Priority: last saved ID (if still valid) → auto-select when exactly one env exists.
  const savedEnvId = context.workspaceState.get<string>(WS_KEY_ENV_ID);
  const resolveEnv = (): DataverseEnvironment | undefined => {
    const all = accountApi.getEnvironments();
    if (savedEnvId) {
      const saved = all.find((e) => e.id === savedEnvId);
      if (saved) { return saved; }
    }
    return all.length === 1 ? all[0] : undefined;
  };
  setEnv(resolveEnv());

  // ── Executor ───────────────────────────────────────────────────────────────
  const executor = new FetchXmlExecutor(
    accountApi.getAccessToken.bind(accountApi)
  );

  // ── Language Model Tools (Copilot Chat integration) ─────────────────────
  context.subscriptions.push(
    vscode.lm.registerTool(
      "dataverse-tools_executeFetchXml",
      new ExecuteFetchXmlTool(accountApi)
    ),
  );

  // ── CSV Viewer (custom editor for .csv files) ──────────────────────────
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      CsvEditorProvider.viewType,
      new CsvEditorProvider(context.extensionUri),
      { supportsMultipleEditorsPerDocument: false },
    ),
  );

  // ── React to tree selection changes ───────────────────────────────────────
  context.subscriptions.push(
    treeView.onDidChangeSelection((e) => {
      const item = e.selection[0];
      propertiesView.showNode(item?.node ?? null);
    })
  );

  // ── React to global environment changes ───────────────────────────────────
  context.subscriptions.push(
    accountApi.onDidChangeEnvironments(() => {
      setEnv(resolveEnv());
    })
  );

  // ── Commands ───────────────────────────────────────────────────────────────

  registerCommand(context, Commands.FetchXmlSelectNode, () => {
    // Handled by treeView.onDidChangeSelection — no-op here
  });

  registerCommand(context, Commands.FetchXmlNewQuery, () => {
    treeProvider.setRoot(defaultQuery());
    propertiesView.showNode(null);
    vscode.window.showInformationMessage("New FetchXML query created.");
  });

  registerCommand(
    context,
    Commands.FetchXmlExecute,
    async () => {
      if (!activeEnv) {
        const pick = await vscode.window.showWarningMessage(
          "No Dataverse environment selected.",
          "Select Environment"
        );
        if (pick === "Select Environment") {
          await vscode.commands.executeCommand(Commands.FetchXmlSelectEnvironment);
        }
        return;
      }
      const root = treeProvider.getRoot();
      if (!root) {
        vscode.window.showWarningMessage(
          "No query to execute. Create a new query first."
        );
        return;
      }

      await vscode.commands.executeCommand(
        "setContext",
        "dataverse-tools.fetchxml.executing",
        true
      );
      propertiesView.setExecuting(true);
      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Executing FetchXML query…",
            cancellable: false,
          },
          async () => {
            const results = await executor.execute(activeEnv!, root);
            ResultsPanel.show(context.extensionUri, results, activeEnv!);
            Logger.info(
              `FetchXML executed: ${results.rows.length} rows in ${results.durationMs}ms`
            );
          }
        );
      } catch (err) {
        const detail = extractFetchXmlError(err);
        Logger.error("FetchXML execution failed", err);
        const action = await vscode.window.showErrorMessage(
          `FetchXML execution failed: ${detail}`,
          "Show Output"
        );
        if (action === "Show Output") {
          Logger.show();
        }
      } finally {
        propertiesView.setExecuting(false);
        await vscode.commands.executeCommand(
          "setContext",
          "dataverse-tools.fetchxml.executing",
          false
        );
      }
    }
  );

  registerCommand(context, Commands.FetchXmlCopyXml, () => {
    const root = treeProvider.getRoot();
    if (!root) {
      vscode.window.showWarningMessage("No query to copy.");
      return;
    }
    const xml = serialize(root);
    vscode.env.clipboard.writeText(xml);
    vscode.window.showInformationMessage("FetchXML copied to clipboard.");
  });

  registerCommand(context, Commands.FetchXmlOpenFile, async () => {
    const uris = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: { "FetchXML files": ["fetchxml", "xml"], "All files": ["*"] },
      title: "Open FetchXML file",
    });
    if (!uris || uris.length === 0) { return; }

    const bytes = await vscode.workspace.fs.readFile(uris[0]);
    const xml = Buffer.from(bytes).toString("utf-8");
    const root = parseFetchXml(xml);

    if (!root) {
      vscode.window.showErrorMessage(
        "Could not parse the FetchXML file. Ensure it starts with a valid <fetch> element."
      );
      return;
    }

    treeProvider.setRoot(root);
    propertiesView.showNode(null);
    vscode.window.showInformationMessage(
      `Loaded FetchXML from ${uris[0].fsPath}`
    );
  });

  registerCommand(context, Commands.FetchXmlSaveFile, async () => {
    const root = treeProvider.getRoot();
    if (!root) {
      vscode.window.showWarningMessage("No query to save.");
      return;
    }

    const uri = await vscode.window.showSaveDialog({
      filters: { "FetchXML files": ["fetchxml", "xml"], "All files": ["*"] },
      title: "Save FetchXML file",
    });
    if (!uri) { return; }

    const xml = serialize(root);
    await vscode.workspace.fs.writeFile(uri, Buffer.from(xml, "utf-8"));
    vscode.window.showInformationMessage(`FetchXML saved to ${uri.fsPath}`);
  });

  registerCommand(
    context,
    Commands.FetchXmlAddChild,
    async (item?: FetchXmlTreeItem) => {
      if (!item) {
        vscode.window.showWarningMessage(
          "Select a node in the FetchXML tree first."
        );
        return;
      }

      const allowed = ALLOWED_CHILDREN[item.node.kind];
      if (allowed.length === 0) {
        vscode.window.showInformationMessage(
          `A '${item.node.kind}' node cannot have children.`
        );
        return;
      }

      const picked = await vscode.window.showQuickPick(
        allowed.map((k) => ({ label: k, description: kindDescription(k) })),
        {
          title: `Add child to <${item.node.kind}>`,
          placeHolder: "Select the node type to add",
        }
      );
      if (!picked) { return; }

      const child = treeProvider.addChild(
        item.node.id,
        picked.label as FetchNodeKind
      );
      if (child) {
        const childItem = new FetchXmlTreeItem(child, {
          isRoot: false,
          siblingIndex: item.node.children.length - 1,
          siblingCount: item.node.children.length,
          parentKind: item.node.kind,
        });
        treeView.reveal(childItem, { select: true, focus: true });
      }
    }
  );

  registerCommand(
    context,
    Commands.FetchXmlDeleteNode,
    async (item?: FetchXmlTreeItem) => {
      if (!item) { return; }

      const confirm = await vscode.window.showWarningMessage(
        `Delete <${item.node.kind}> node${
          item.node.children.length > 0
            ? ` and its ${item.node.children.length} child node(s)`
            : ""
        }?`,
        { modal: true },
        "Delete"
      );
      if (confirm !== "Delete") { return; }

      treeProvider.removeNode(item.node.id);
      propertiesView.showNode(null);
    }
  );

  registerCommand(
    context,
    Commands.FetchXmlSelectEnvironment,
    async () => {
      const result = await accountApi.pickEnvironment({ activeEnvironmentId: activeEnv?.id });
      if (!result) { return; }
      setEnv(result.environment);
    }
  );

  registerCommand(
    context,
    Commands.FetchXmlDuplicateNode,
    (item?: FetchXmlTreeItem) => {
      if (!item) { return; }
      const clone = treeProvider.duplicateNode(item.node.id);
      if (clone) {
        propertiesView.showNode(clone);
      }
    }
  );

  registerCommand(
    context,
    Commands.FetchXmlMoveNodeUp,
    (item?: FetchXmlTreeItem) => {
      if (!item) { return; }
      treeProvider.moveNodeUp(item.node.id);
    }
  );

  registerCommand(
    context,
    Commands.FetchXmlMoveNodeDown,
    (item?: FetchXmlTreeItem) => {
      if (!item) { return; }
      treeProvider.moveNodeDown(item.node.id);
    }
  );

  registerCommand(context, Commands.FetchXmlPreviewXml, async () => {
    const root = treeProvider.getRoot();
    if (!root) {
      vscode.window.showWarningMessage("No query to edit.");
      return;
    }
    fsProvider.update(serialize(root));
    const doc = await vscode.workspace.openTextDocument(FETCHXML_EDIT_URI);
    await vscode.languages.setTextDocumentLanguage(doc, "fetchxml");
    await vscode.window.showTextDocument(doc, {
      preview: false,
      viewColumn: vscode.ViewColumn.Beside,
    });
  });
}

export function deactivate(): void {
  Logger.info("Dataverse Tools: FetchXML Builder deactivated.");
}

/**
 * Extracts a human-readable error message from an Axios / Dataverse OData error.
 * Dataverse errors carry structured JSON in response.data.error.
 */
function extractFetchXmlError(err: unknown): string {
  if (err && typeof err === "object" && "response" in err) {
    const res = (err as { response?: { status?: number; data?: unknown } }).response;
    const data = res?.data as
      | { error?: { message?: string; innererror?: { message?: string } } }
      | undefined;
    if (data?.error?.message) {
      // Dataverse sometimes nests the real detail in innererror
      const inner = data.error.innererror?.message;
      return inner && inner !== data.error.message
        ? `${data.error.message}\n${inner}`
        : data.error.message;
    }
    if (res?.status) {
      return `HTTP ${res.status}`;
    }
  }
  return err instanceof Error ? err.message : String(err);
}

function kindDescription(kind: FetchNodeKind): string {
  const descriptions: Record<FetchNodeKind, string> = {
    fetch: "Root fetch element",
    entity: "Primary entity to query",
    attribute: "Column to return in results",
    "link-entity": "Join to a related entity",
    filter: "AND / OR filter group",
    condition: "Filter condition (eq, like, null, in, …)",
    order: "Sort order for results",
  };
  return descriptions[kind] ?? "";
}
