/**
 * Dataverse entity types aligned with the Web API OData schema.
 * Property names use the Dataverse logical names where possible.
 */

/** How the extension acquires tokens for a specific environment. */
export type AuthMethod = "vscode" | "azcli" | "devicecode" | "clientcredentials";

export interface DataverseEnvironment {
  id: string;
  name: string;
  url: string;           // e.g. https://org.crm.dynamics.com
  authMethod: AuthMethod;
  accountId?: string;    // VS Code auth only: the specific Microsoft account to use
  tenantId?: string;     // optional — inferred at auth time for most methods
  clientId?: string;     // optional per-env override for custom app registrations
  // Populated from WhoAmI on first successful connection
  userId?: string;
  organizationId?: string;
}

// ─── Plugin Assembly ───────────────────────────────────────────────────────

export interface PluginAssembly {
  pluginassemblyid?: string;
  name: string;
  version: string;
  culture: string;
  publickeytoken: string;
  sourcetype: PluginAssemblySourceType;
  isolationmode: PluginAssemblyIsolationMode;
  ismanaged?: boolean; // Managed or unmanaged
  content?: string; // base64-encoded DLL for database-sourced assemblies
  description?: string;
  // computed from server
  createdon?: string;
  modifiedon?: string;
}

export const enum PluginAssemblySourceType {
  Database = 0,
  Disk = 1,
  GAC = 2,
}

export const enum PluginAssemblyIsolationMode {
  None = 1,
  Sandbox = 2,
}

// ─── Plugin Type ───────────────────────────────────────────────────────────

export interface PluginType {
  plugintypeid?: string;
  typename: string;
  name: string;
  friendlyname: string;
  description?: string;
  assemblyname: string;
  workflowactivitygroupname?: string;
  // navigation property (expand)
  pluginassemblyid_pluginassembly?: { pluginassemblyid: string; name: string };
}

// ─── SDK Message Processing Step ───────────────────────────────────────────

export interface SdkMessageProcessingStep {
  sdkmessageprocessingstepid?: string;
  name: string;
  description?: string;
  rank: number; // execution order
  mode: StepMode;
  stage: StepStage;
  invocationsource: StepInvocationSource;
  supporteddeployment: StepSupportedDeployment;
  asyncautodelete: boolean;
  filteringattributes?: string; // comma-separated logical names
  configuration?: string; // unsecure config
  secureconfig?: string; // stored in SdkMessageProcessingStepSecureConfig
  statecode: StepStateCode;
  statuscode: StepStatusCode;
  // raw foreign key (used in OData $filter)
  _eventhandler_value?: string;
  // navigation properties
  sdkmessageid: { sdkmessageid: string; name: string };
  sdkmessagefilterid?: { sdkmessagefilterid: string; primaryobjecttypecode: string };
  eventhandler_plugintype?: { plugintypeid: string; name: string };
}

export const enum StepMode {
  Synchronous = 0,
  Asynchronous = 1,
}

export const enum StepStage {
  PreValidation = 10,
  PreOperation = 20,
  MainOperation = 30,
  PostOperation = 40,
}

export const enum StepInvocationSource {
  Parent = 0,
  Child = 1,
}

export const enum StepSupportedDeployment {
  ServerOnly = 0,
  OfflineOnly = 1,
  Both = 2,
}

export const enum StepStateCode {
  Enabled = 0,
  Disabled = 1,
}

export const enum StepStatusCode {
  Enabled = 1,
  Disabled = 2,
}

// ─── Step Image ─────────────────────────────────────────────────────────────

export interface SdkMessageProcessingStepImage {
  sdkmessageprocessingstepimageid?: string;
  name: string;
  entityalias: string;
  imagetype: StepImageType;
  attributes?: string; // comma-separated logical names; null = all
  messagepropertyname: string; // Target for most messages
  // raw foreign key (used in OData $filter)
  _sdkmessageprocessingstepid_value?: string;
  sdkmessageprocessingstepid: { sdkmessageprocessingstepid: string };
}

export const enum StepImageType {
  PreImage = 0,
  PostImage = 1,
  Both = 2,
}

// ─── SDK Message / Filter ───────────────────────────────────────────────────

export interface SdkMessage {
  sdkmessageid: string;
  name: string;
}

export interface SdkMessageFilter {
  sdkmessagefilterid: string;
  sdkmessageid: { sdkmessageid: string; name: string };
  primaryobjecttypecode: string;
  secondaryobjecttypecode: string;
  availability: number;
}

// ─── Plugin Trace Log ───────────────────────────────────────────────────────

export interface PluginTraceLog {
  plugintracelogid: string;
  correlationid?: string;
  requestid?: string;
  typename: string;
  messagename: string;
  primaryentityname?: string;
  depth: number;
  mode: number;           // 0=Synchronous, 1=Asynchronous
  operationtype: number;  // 1=Plugin, 2=WorkflowActivity
  exceptiondetails?: string;
  messageblock?: string;
  performanceinitializationduration?: number;
  performanceexecutionduration?: number;
  createdon: string;
}

export interface TraceLogSuggestions {
  pluginTypeNames: string[];
  messageNames: string[];
  entityNames: string[];
}

export interface TraceLogFilter {
  pluginTypeName?: string;
  messageName?: string;
  entityName?: string;
  correlationId?: string;
  exceptionsOnly?: boolean;
  dateFrom?: string;
  dateTo?: string;
  maxCount?: number;
}

/**
 * Strongly-typed argument passed from dataverse-assemblies to plugin-trace-viewer
 * via `Commands.OpenTraceViewer` → `Commands.TraceLog`.
 *
 * Replaces the duck-typed `Record<string, unknown>` inspection that was
 * previously used in plugin-trace-viewer to extract the filter from a
 * PluginTreeItem. Both sides now share this contract through core-dataverse.
 */
export type TraceLogTarget =
  | { readonly kind: "assembly"; readonly assemblyName: string }
  | { readonly kind: "pluginType"; readonly pluginTypeName: string };

// ─── Workflow / Process ─────────────────────────────────────────────────────

/** A Dataverse process from the `workflows` entity set. */
export interface WorkflowProcess {
  workflowid: string;
  name: string;
  uniquename?: string;
  /** 0=Workflow, 1=Dialog, 2=BusinessRule, 3=Action, 4=BPF, 5=ModernFlow */
  category: WorkflowCategory;
  /** 1=Definition, 2=Activation, 3=Template */
  type: WorkflowType;
  /** 0=Draft, 1=Activated */
  statecode: WorkflowStateCode;
  statuscode: number;
  primaryentity: string;
  ismanaged?: boolean;
  description?: string;
  modifiedon?: string;
  createdon?: string;
  _ownerid_value?: string;
}

export const enum WorkflowCategory {
  Workflow = 0,
  Dialog = 1,
  BusinessRule = 2,
  Action = 3,
  BPF = 4,
  ModernFlow = 5,
}

export const enum WorkflowType {
  Definition = 1,
  Activation = 2,
  Template = 3,
}

export const enum WorkflowStateCode {
  Draft = 0,
  Activated = 1,
}

// ─── Details panel ──────────────────────────────────────────────────────────

/** A single row in the Details panel property table. */
export interface DetailProperty {
  label: string;
  value: string | number;
  mono?: boolean;                                      // render in monospace (GUIDs, tokens)
  badge?: "green" | "grey" | "orange" | "blue";       // render as a coloured badge instead of text
}

/**
 * Generic item shown in the shared Details panel owned by dataverse-environments.
 * Each extension converts its selected tree item into this shape and calls
 * `DataverseAccountApi.showDetails()`.
 */
export interface DetailItem {
  icon: string;              // codicon name, e.g. "$(package)"
  label: string;             // displayed in the panel header
  properties: DetailProperty[];
}

// ─── Web API response wrappers ──────────────────────────────────────────────

export interface ODataCollection<T> {
  "@odata.context": string;
  value: T[];
  "@odata.nextLink"?: string;
}

export interface ODataError {
  error: {
    code: string;
    message: string;
    innererror?: {
      message: string;
      type: string;
      stacktrace: string;
    };
  };
}

// ─── Deployment result ──────────────────────────────────────────────────────

export interface DeploymentResult {
  assemblyId: string;
  assemblyName: string;
  assemblyAction: "created" | "updated" | "unchanged";
  typesCreated: string[];
  typesDeleted: string[];
  typesUnchanged: string[];
  stepsDeleted: string[];
  errors: DeploymentError[];
  timestamp: Date;
}

export interface DeploymentError {
  phase: "assembly" | "type" | "step" | "image";
  entityName?: string;
  message: string;
  detail?: string;
}
