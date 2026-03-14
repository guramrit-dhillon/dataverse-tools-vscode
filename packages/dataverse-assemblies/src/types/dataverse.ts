/**
 * Dataverse entity types specific to plugin step registration.
 * Aligned with the Web API OData schema — property names use Dataverse logical names.
 */

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
