import {
  type DataverseEnvironment,
  type PluginAssembly,
  type PluginType,
  type SdkMessageProcessingStep,
  type SdkMessageProcessingStepImage,
  type SdkMessage,
  type SdkMessageFilter,
  type DeploymentResult,
  type AssemblyAnalysisResult,
} from "core-dataverse";

/**
 * Plugin registration operations against the Dataverse Web API.
 *
 * All methods target the /api/data/v9.2 endpoint.
 * Operations are differential: they compare local state against server state
 * before deciding whether to create or update, never blindly delete-recreate.
 */
export interface IRegistrationService {
  // ── Read ──────────────────────────────────────────────────────────────────

  listAssemblies(env: DataverseEnvironment, unmanagedOnly?: boolean): Promise<PluginAssembly[]>;

  getAssembly(
    env: DataverseEnvironment,
    assemblyId: string
  ): Promise<PluginAssembly>;

  listPluginTypes(
    env: DataverseEnvironment,
    assemblyId: string
  ): Promise<PluginType[]>;

  listSteps(
    env: DataverseEnvironment,
    pluginTypeId: string
  ): Promise<SdkMessageProcessingStep[]>;

  listStepsByMessageFilter(
    env: DataverseEnvironment,
    filterId: string
  ): Promise<SdkMessageProcessingStep[]>;

  listStepsByEntity(
    env: DataverseEnvironment,
    entityLogicalName: string
  ): Promise<SdkMessageProcessingStep[]>;

  listStepImages(
    env: DataverseEnvironment,
    stepId: string
  ): Promise<SdkMessageProcessingStepImage[]>;

  listMessages(env: DataverseEnvironment): Promise<SdkMessage[]>;

  searchMessages(
    env: DataverseEnvironment,
    query: string
  ): Promise<SdkMessage[]>;

  listMessageFilters(
    env: DataverseEnvironment,
    messageId: string
  ): Promise<SdkMessageFilter[]>;

  listMessagesForEntity(
    env: DataverseEnvironment,
    entityCode: string
  ): Promise<SdkMessage[]>;

  listEntityNames(env: DataverseEnvironment): Promise<string[]>;

  listEntityAttributes(
    env: DataverseEnvironment,
    entityLogicalName: string
  ): Promise<string[]>;

  // ── Write ─────────────────────────────────────────────────────────────────

  upsertAssembly(
    env: DataverseEnvironment,
    assembly: PluginAssembly
  ): Promise<PluginAssembly>;

  upsertPluginType(
    env: DataverseEnvironment,
    type: PluginType
  ): Promise<PluginType>;

  upsertStep(
    env: DataverseEnvironment,
    step: SdkMessageProcessingStep
  ): Promise<SdkMessageProcessingStep>;

  upsertStepImage(
    env: DataverseEnvironment,
    image: SdkMessageProcessingStepImage
  ): Promise<SdkMessageProcessingStepImage>;

  setStepState(
    env: DataverseEnvironment,
    stepId: string,
    enabled: boolean
  ): Promise<void>;

  renameAssembly(env: DataverseEnvironment, assemblyId: string, newName: string): Promise<void>;
  renamePluginType(env: DataverseEnvironment, typeId: string, newFriendlyName: string): Promise<void>;
  renameStep(env: DataverseEnvironment, stepId: string, newName: string): Promise<void>;

  // ── Delete ────────────────────────────────────────────────────────────────

  deleteAssembly(env: DataverseEnvironment, assemblyId: string): Promise<void>;
  deletePluginType(env: DataverseEnvironment, typeId: string): Promise<void>;
  deleteStep(env: DataverseEnvironment, stepId: string): Promise<void>;
  deleteStepImage(env: DataverseEnvironment, imageId: string): Promise<void>;

  // ── Smart deployment ──────────────────────────────────────────────────────

  deployAssembly(
    env: DataverseEnvironment,
    analysis: AssemblyAnalysisResult,
    dllPath: string,
    options?: { selectedTypes?: string[]; typesToDelete?: PluginType[]; activityGroupName?: string },
    onProgress?: (message: string) => void,
  ): Promise<DeploymentResult>;

  changeActivityGroup(env: DataverseEnvironment, typeId: string, groupName: string): Promise<void>;
}
