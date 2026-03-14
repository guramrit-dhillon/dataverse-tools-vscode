/**
 * Shared constants — only framework-level and cross-extension command IDs.
 * Extension-specific commands live in each extension's own constants.ts.
 */
export const Commands = {
  // ── Environments (framework) ────────────────────────────────────────────
  AddEnvironment: "dataverse-tools.addEnvironment",
  RemoveEnvironment: "dataverse-tools.removeEnvironment",
  EditEnvironment: "dataverse-tools.editEnvironment",
  TestConnection: "dataverse-tools.testConnection",
  // ── Explorer (framework) ────────────────────────────────────────────────
  ExplorerSelectEnvironment: "dataverse-tools.explorer.selectEnvironment",
  ExplorerRefresh: "dataverse-tools.explorer.refresh",
  ExplorerShowAll: "dataverse-tools.explorer.showAll",
  ExplorerFilterUnmanaged: "dataverse-tools.explorer.filterUnmanaged",
  ExplorerShowGlobal: "dataverse-tools.explorer.showGlobal",
  ExplorerShowSolutionOnly: "dataverse-tools.explorer.showSolutionOnly",
  AddToSolution: "dataverse-tools.explorer.addToSolution",
  RemoveFromSolution: "dataverse-tools.explorer.removeFromSolution",
  RemoveActiveCustomizations: "dataverse-tools.explorer.removeActiveCustomizations",
  // ── Cross-extension (shared contract) ───────────────────────────────────
  /** Shared between dataverse-assemblies (caller) and plugin-trace-viewer (handler). */
  TraceLog: "dataverse-tools.traceLog",
} as const;

export const Views = {
  Environments: "dataverse-tools.environments",
  Details: "dataverse-tools.details",
  Explorer: "dataverse-tools.explorer",
} as const;

/** VS Code extension IDs — single source of truth for cross-extension lookups. */
export const ExtensionIds = {
  Environments: "gdhillon.dataverse-environments",
  Metadata: "gdhillon.dataverse-metadata",
  TraceViewer: "gdhillon.dataverse-plugin-trace-viewer",
  FetchXmlBuilder: "gdhillon.fetchxml-builder",
  QueryAnalyzer: "gdhillon.dataverse-query-analyzer",
  AssemblyDecompiler: "gdhillon.dataverse-assembly-decompiler",
  AuditViewer: "gdhillon.dataverse-audit-viewer",
  Workflows: "gdhillon.dataverse-workflows",
  WorkflowDesigner: "gdhillon.dataverse-workflow-designer",
} as const;
