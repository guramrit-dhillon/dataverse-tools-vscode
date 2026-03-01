/** Extension-wide constants. Single source of truth for command IDs. */
export const Commands = {
  AddEnvironment: "dataverse-tools.addEnvironment",
  RemoveEnvironment: "dataverse-tools.removeEnvironment",
  EditEnvironment: "dataverse-tools.editEnvironment",
  TestConnection: "dataverse-tools.testConnection",
  DeployAssembly: "dataverse-tools.deployAssembly",
  AddStep: "dataverse-tools.addStep",
  EditStep: "dataverse-tools.editStep",
  EnableStep: "dataverse-tools.enableStep",
  DisableStep: "dataverse-tools.disableStep",
  DeleteNode: "dataverse-tools.deleteNode",
  DownloadAssembly: "dataverse-tools.downloadAssembly",
  ManageImages: "dataverse-tools.manageImages",
  RenameNode: "dataverse-tools.renameNode",
  ChangeActivityGroup: "dataverse-tools.changeActivityGroup",
  TraceLog: "dataverse-tools.traceLog",
  TraceLogChangeEnvironment: "dataverse-tools.traceLog.changeEnvironment",
  ShowManaged: "dataverse-tools.assemblies.showManaged",
  HideManaged: "dataverse-tools.assemblies.hideManaged",
  /** Registered by dataverse-assemblies; delegates to TraceLog if plugin-trace-viewer is installed. */
  OpenTraceViewer: "dataverse-tools.openTraceViewer",
  ExplorerSelectEnvironment: "dataverse-tools.explorer.selectEnvironment",
  ExplorerRefresh: "dataverse-tools.explorer.refresh",
  ExplorerShowAll: "dataverse-tools.explorer.showAll",
  ExplorerFilterUnmanaged: "dataverse-tools.explorer.filterUnmanaged",
  ExplorerShowGlobal: "dataverse-tools.explorer.showGlobal",
  ExplorerShowSolutionOnly: "dataverse-tools.explorer.showSolutionOnly",
  AddToSolution: "dataverse-tools.explorer.addToSolution",
  RemoveFromSolution: "dataverse-tools.explorer.removeFromSolution",
  // ── FetchXML Builder ──────────────────────────────────────────────────────
  FetchXmlNewQuery: "dataverse-tools.fetchxml.newQuery",
  FetchXmlExecute: "dataverse-tools.fetchxml.execute",
  FetchXmlCopyXml: "dataverse-tools.fetchxml.copyXml",
  FetchXmlOpenFile: "dataverse-tools.fetchxml.openFile",
  FetchXmlSaveFile: "dataverse-tools.fetchxml.saveFile",
  FetchXmlAddChild: "dataverse-tools.fetchxml.addChild",
  FetchXmlDeleteNode: "dataverse-tools.fetchxml.deleteNode",
  FetchXmlSelectNode: "dataverse-tools.fetchxml.selectNode",
  FetchXmlSelectEnvironment: "dataverse-tools.fetchxml.selectEnvironment",
  FetchXmlPreviewXml: "dataverse-tools.fetchxml.previewXml",
  FetchXmlDuplicateNode: "dataverse-tools.fetchxml.duplicateNode",
  FetchXmlMoveNodeUp: "dataverse-tools.fetchxml.moveNodeUp",
  FetchXmlMoveNodeDown: "dataverse-tools.fetchxml.moveNodeDown",
  // ── Query Analyzer ──────────────────────────────────────────────────────
  QueryAnalyzerOpen: "dataverse-tools.queryAnalyzer.open",
  QueryAnalyzerChangeEnvironment: "dataverse-tools.queryAnalyzer.changeEnvironment",
  QueryAnalyzerSelectEnvironment: "dataverse-tools.queryAnalyzer.selectEnvironment",
  QueryAnalyzerQueryEntity: "dataverse-tools.queryAnalyzer.queryEntity",
  // ── Assembly Decompiler ─────────────────────────────────────────────────
  BrowseAssemblyCode: "dataverse-tools.browseAssemblyCode",
} as const;

export const Views = {
  Environments: "dataverse-tools.environments",
  Details: "dataverse-tools.details",
  Explorer: "dataverse-tools.explorer",
  FetchXmlTree: "dataverse-tools.fetchxmlTree",
  FetchXmlProperties: "dataverse-tools.fetchxmlProperties",
  Decompiler: "dataverse-tools.decompiler",
  CsvViewer: "dataverse-tools.csvViewer",
} as const;

/** VS Code extension IDs — single source of truth for cross-extension lookups. */
export const ExtensionIds = {
  Environments: "gdhillon.dataverse-environments",
  Metadata: "gdhillon.dataverse-metadata",
  TraceViewer: "gdhillon.dataverse-plugin-trace-viewer",
  FetchXmlBuilder: "gdhillon.fetchxml-builder",
  QueryAnalyzer: "gdhillon.dataverse-query-analyzer",
  AssemblyDecompiler: "gdhillon.dataverse-assembly-decompiler",
} as const;
