import { type IRegistrationService } from "../interfaces/IRegistrationService";
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
  PluginAssemblyIsolationMode,
  PluginAssemblySourceType,
  Logger,
  fileToBase64,
  DataverseWebApiClient,
} from "core-dataverse";

/**
 * Dataverse plugin registration operations.
 *
 * Differential deployment strategy:
 *  - Assembly: compare hash stored in description field against local hash
 *  - Types: create if missing, PATCH if present
 *  - Steps: NEVER deleted during assembly re-deployment (preserves registrations)
 */
export class RegistrationService implements IRegistrationService {
  constructor(private readonly getToken: (env: DataverseEnvironment) => Promise<string>) {}

  private client(env: DataverseEnvironment): DataverseWebApiClient {
    return new DataverseWebApiClient(env, this.getToken);
  }

  // ── Read ───────────────────────────────────────────────────────────────────

  async listAssemblies(env: DataverseEnvironment, unmanagedOnly = false): Promise<PluginAssembly[]> {
    const select = "$select=pluginassemblyid,name,version,culture,publickeytoken,isolationmode,sourcetype,description,ismanaged,modifiedon";
    const filter = unmanagedOnly ? "&$filter=ismanaged eq false" : "";
    return this.client(env).getAll<PluginAssembly>("pluginassemblies", `${select}${filter}`);
  }

  async getAssembly(env: DataverseEnvironment, assemblyId: string): Promise<PluginAssembly> {
    return this.client(env).get<PluginAssembly>(`pluginassemblies(${assemblyId})`);
  }

  async listPluginTypes(env: DataverseEnvironment, assemblyId: string): Promise<PluginType[]> {
    return this.client(env).getAll<PluginType>(
      "plugintypes",
      `$select=plugintypeid,typename,name,friendlyname,description,workflowactivitygroupname&$filter=_pluginassemblyid_value eq '${assemblyId}'`
    );
  }

  async listSteps(env: DataverseEnvironment, pluginTypeId: string): Promise<SdkMessageProcessingStep[]> {
    return this.client(env).getAll<SdkMessageProcessingStep>(
      "sdkmessageprocessingsteps",
      `$select=sdkmessageprocessingstepid,name,description,rank,mode,stage,statecode,filteringattributes` +
      `&$filter=_eventhandler_value eq '${pluginTypeId}'` +
      `&$expand=sdkmessageid($select=sdkmessageid,name),sdkmessagefilterid($select=sdkmessagefilterid,primaryobjecttypecode)`
    );
  }

  async listStepsByMessageFilter(env: DataverseEnvironment, filterId: string): Promise<SdkMessageProcessingStep[]> {
    return this.client(env).getAll<SdkMessageProcessingStep>(
      "sdkmessageprocessingsteps",
      `$select=sdkmessageprocessingstepid,name,description,rank,mode,stage,statecode,filteringattributes` +
      `&$filter=_sdkmessagefilterid_value eq '${filterId}'` +
      `&$expand=sdkmessageid($select=sdkmessageid,name),sdkmessagefilterid($select=sdkmessagefilterid,primaryobjecttypecode)` +
      `&$orderby=name`
    );
  }

  async listStepsByEntity(env: DataverseEnvironment, entityLogicalName: string): Promise<SdkMessageProcessingStep[]> {
    return this.client(env).getAll<SdkMessageProcessingStep>(
      "sdkmessageprocessingsteps",
      `$select=sdkmessageprocessingstepid,name,description,rank,mode,stage,statecode,filteringattributes` +
      `&$filter=sdkmessagefilterid/primaryobjecttypecode eq '${entityLogicalName}'` +
      `&$expand=sdkmessageid($select=sdkmessageid,name),sdkmessagefilterid($select=sdkmessagefilterid,primaryobjecttypecode)` +
      `&$orderby=name`
    );
  }

  async listStepImages(env: DataverseEnvironment, stepId: string): Promise<SdkMessageProcessingStepImage[]> {
    return this.client(env).getAll<SdkMessageProcessingStepImage>(
      "sdkmessageprocessingstepimages",
      `$select=sdkmessageprocessingstepimageid,name,entityalias,imagetype,attributes&$filter=_sdkmessageprocessingstepid_value eq '${stepId}'`
    );
  }

  async listMessages(env: DataverseEnvironment): Promise<SdkMessage[]> {
    return this.client(env).getAll<SdkMessage>(
      "sdkmessages",
      "$select=sdkmessageid,name&$orderby=name"
    );
  }

  async searchMessages(env: DataverseEnvironment, query: string): Promise<SdkMessage[]> {
    const filter = query
      ? `&$filter=contains(name,'${query.replace(/'/g, "''")}')`
      : "";
    return this.client(env).getAll<SdkMessage>(
      "sdkmessages",
      `$select=sdkmessageid,name&$orderby=name${filter}`
    );
  }

  async listMessageFilters(env: DataverseEnvironment, messageId: string): Promise<SdkMessageFilter[]> {
    return this.client(env).getAll<SdkMessageFilter>(
      "sdkmessagefilters",
      `$select=sdkmessagefilterid,primaryobjecttypecode,secondaryobjecttypecode,availability&$filter=_sdkmessageid_value eq '${messageId}'`
    );
  }

  async listMessagesForEntity(env: DataverseEnvironment, entityCode: string): Promise<SdkMessage[]> {
    const filters = await this.client(env).getAll<{ sdkmessageid: SdkMessage }>(
      "sdkmessagefilters",
      `$select=sdkmessagefilterid&$filter=primaryobjecttypecode eq '${entityCode}'&$expand=sdkmessageid($select=sdkmessageid,name)`
    );
    const seen = new Map<string, SdkMessage>();
    for (const f of filters) {
      if (f.sdkmessageid && !seen.has(f.sdkmessageid.sdkmessageid)) {
        seen.set(f.sdkmessageid.sdkmessageid, f.sdkmessageid);
      }
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  async listEntityNames(env: DataverseEnvironment): Promise<string[]> {
    const entities = await this.client(env).getAll<{ LogicalName: string }>(
      "EntityDefinitions",
      "$select=LogicalName&$orderby=LogicalName",
    );
    return entities.map((e) => e.LogicalName);
  }

  async listEntityAttributes(env: DataverseEnvironment, entityLogicalName: string): Promise<string[]> {
    const attrs = await this.client(env).getAll<{ LogicalName: string }>(
      `EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes`,
      "$select=LogicalName&$orderby=LogicalName",
    );
    return attrs.map((a) => a.LogicalName);
  }

  // ── Write ──────────────────────────────────────────────────────────────────

  async upsertAssembly(env: DataverseEnvironment, assembly: PluginAssembly): Promise<PluginAssembly> {
    const client = this.client(env);
    if (assembly.pluginassemblyid) {
      return client.patch<PluginAssembly>(`pluginassemblies(${assembly.pluginassemblyid})`, assembly);
    }
    return client.post<PluginAssembly>("pluginassemblies", assembly);
  }

  async upsertPluginType(env: DataverseEnvironment, type: PluginType): Promise<PluginType> {
    const client = this.client(env);
    if (type.plugintypeid) {
      return client.patch<PluginType>(`plugintypes(${type.plugintypeid})`, type);
    }
    return client.post<PluginType>("plugintypes", type);
  }

  async upsertStep(env: DataverseEnvironment, step: SdkMessageProcessingStep): Promise<SdkMessageProcessingStep> {
    const client = this.client(env);
    if (step.sdkmessageprocessingstepid) {
      return client.patch<SdkMessageProcessingStep>(
        `sdkmessageprocessingsteps(${step.sdkmessageprocessingstepid})`,
        step
      );
    }
    return client.post<SdkMessageProcessingStep>("sdkmessageprocessingsteps", step);
  }

  async upsertStepImage(
    env: DataverseEnvironment,
    image: SdkMessageProcessingStepImage
  ): Promise<SdkMessageProcessingStepImage> {
    const client = this.client(env);
    if (image.sdkmessageprocessingstepimageid) {
      return client.patch<SdkMessageProcessingStepImage>(
        `sdkmessageprocessingstepimages(${image.sdkmessageprocessingstepimageid})`,
        image
      );
    }
    return client.post<SdkMessageProcessingStepImage>("sdkmessageprocessingstepimages", image);
  }

  async setStepState(env: DataverseEnvironment, stepId: string, enabled: boolean): Promise<void> {
    await this.client(env).patch(
      `sdkmessageprocessingsteps(${stepId})`,
      { statecode: enabled ? 0 : 1, statuscode: enabled ? 1 : 2 }
    );
  }

  async renameAssembly(env: DataverseEnvironment, assemblyId: string, newName: string): Promise<void> {
    await this.client(env).patch(`pluginassemblies(${assemblyId})`, { name: newName });
  }

  async renamePluginType(env: DataverseEnvironment, typeId: string, newFriendlyName: string): Promise<void> {
    await this.client(env).patch(`plugintypes(${typeId})`, { friendlyname: newFriendlyName });
  }

  async renameStep(env: DataverseEnvironment, stepId: string, newName: string): Promise<void> {
    await this.client(env).patch(`sdkmessageprocessingsteps(${stepId})`, { name: newName });
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async deleteAssembly(env: DataverseEnvironment, assemblyId: string): Promise<void> {
    await this.client(env).delete(`pluginassemblies(${assemblyId})`);
  }

  async deletePluginType(env: DataverseEnvironment, typeId: string): Promise<void> {
    await this.client(env).delete(`plugintypes(${typeId})`);
  }

  async deleteStep(env: DataverseEnvironment, stepId: string): Promise<void> {
    await this.client(env).delete(`sdkmessageprocessingsteps(${stepId})`);
  }

  async deleteStepImage(env: DataverseEnvironment, imageId: string): Promise<void> {
    await this.client(env).delete(`sdkmessageprocessingstepimages(${imageId})`);
  }

  async changeActivityGroup(env: DataverseEnvironment, typeId: string, groupName: string): Promise<void> {
    await this.client(env).patch(`plugintypes(${typeId})`, { workflowactivitygroupname: groupName });
  }

  // ── Smart Deployment ───────────────────────────────────────────────────────

  async deployAssembly(
    env: DataverseEnvironment,
    analysis: AssemblyAnalysisResult,
    dllPath: string,
    options?: { selectedTypes?: string[]; typesToDelete?: PluginType[]; activityGroupName?: string },
    onProgress?: (message: string) => void,
  ): Promise<DeploymentResult> {
    const result: DeploymentResult = {
      assemblyId: "",
      assemblyName: analysis.assemblyName,
      assemblyAction: "unchanged",
      typesCreated: [],
      typesDeleted: [],
      typesUnchanged: [],
      stepsDeleted: [],
      errors: [],
      timestamp: new Date(),
    };
    const report = onProgress ?? (() => {});
    const selectedTypes = options?.selectedTypes;
    const typesToDelete = options?.typesToDelete ?? [];
    const activityGroupName = options?.activityGroupName ?? analysis.assemblyName;

    // ── Step 1: Find existing assembly ────────────────────────────────────────
    report("Looking up assembly…");
    const existingAssemblies = await this.listAssemblies(env);
    const existing = existingAssemblies.find(
      (a) => a.name === analysis.assemblyName
    );

    // ── Step 2: Delete removed types (must happen BEFORE assembly upload) ────
    // Dataverse rejects assembly updates if the DLL no longer contains
    // types that still have registrations on the server.
    if (typesToDelete.length > 0) {
      for (const serverType of typesToDelete) {
        const typeName = serverType.friendlyname || serverType.typename.split(".").pop() || serverType.typename;
        try {
          // Delete steps first — types with active steps can't be deleted
          const steps = await this.listSteps(env, serverType.plugintypeid!);
          for (const step of steps) {
            report(`Deleting step "${step.name}"…`);
            await this.deleteStep(env, step.sdkmessageprocessingstepid!);
            result.stepsDeleted.push(step.name);
            Logger.info(`Deleted step "${step.name}" for removed type ${serverType.typename}`);
          }
          report(`Deleting type ${typeName}…`);
          await this.deletePluginType(env, serverType.plugintypeid!);
          result.typesDeleted.push(serverType.typename);
          Logger.info(`Deleted removed type ${serverType.typename}`);
        } catch (err) {
          result.errors.push({
            phase: "type",
            entityName: serverType.typename,
            message: err instanceof Error ? err.message : String(err),
          });
          Logger.error(`Failed to delete type ${serverType.typename}`, err);
        }
      }
    }

    // ── Step 3: Upsert assembly ──────────────────────────────────────────────
    const b64Content = await fileToBase64(dllPath);
    const hashTag = `#hash:${analysis.fileHash}`;

    let assembly: PluginAssembly;

    if (existing) {
      const storedHash = this.extractHash(existing.description);
      if (storedHash === analysis.fileHash) {
        Logger.info("Assembly unchanged – skipping upload", { name: analysis.assemblyName });
        report("Assembly unchanged – skipping upload");
        result.assemblyAction = "unchanged";
        assembly = existing;
      } else {
        Logger.info("Assembly changed – updating", { name: analysis.assemblyName });
        report("Uploading assembly…");
        assembly = await this.upsertAssembly(env, {
          ...existing,
          version: analysis.version,
          culture: analysis.culture,
          publickeytoken: analysis.publicKeyToken,
          content: b64Content,
          description: `Deployed by VS Code extension. ${hashTag}`,
        });
        result.assemblyAction = "updated";
      }
    } else {
      Logger.info("Assembly not found – creating", { name: analysis.assemblyName });
      report("Creating assembly…");
      assembly = await this.upsertAssembly(env, {
        name: analysis.assemblyName,
        version: analysis.version,
        culture: analysis.culture,
        publickeytoken: analysis.publicKeyToken,
        sourcetype: PluginAssemblySourceType.Database,
        isolationmode: PluginAssemblyIsolationMode.Sandbox,
        content: b64Content,
        description: `Deployed by VS Code extension. ${hashTag}`,
      });
      result.assemblyAction = "created";
    }

    result.assemblyId = assembly.pluginassemblyid ?? "";
    Logger.info("Assembly resolved", {
      id: assembly.pluginassemblyid,
      name: assembly.name,
      action: result.assemblyAction,
    });

    if (!assembly.pluginassemblyid) {
      result.errors.push({
        phase: "assembly",
        entityName: analysis.assemblyName,
        message: "Assembly ID is missing after upsert. Cannot create plugin types.",
      });
      return result;
    }

    // ── Step 4: Reconcile Plugin Types ───────────────────────────────────────
    report("Reconciling types…");
    const serverTypes = await this.listPluginTypes(env, assembly.pluginassemblyid!);
    const serverTypeMap = new Map(serverTypes.map((t) => [t.typename, t]));

    for (const pluginInfo of analysis.plugins) {
      if (selectedTypes && !selectedTypes.includes(pluginInfo.fullName)) {
        continue;
      }

      const serverType = serverTypeMap.get(pluginInfo.fullName);
      const isActivity = pluginInfo.kind === "activity";

      // Already registered — nothing to update
      if (serverType) {
        result.typesUnchanged.push(pluginInfo.fullName);
        continue;
      }

      report(`Registering ${pluginInfo.className}…`);
      try {
        await this.upsertPluginType(env, {
          typename: pluginInfo.fullName,
          name: pluginInfo.fullName,
          friendlyname: pluginInfo.className,
          assemblyname: analysis.assemblyName,
          ...(isActivity ? { workflowactivitygroupname: activityGroupName } : {}),
          "pluginassemblyid@odata.bind": `pluginassemblies(${assembly.pluginassemblyid})`,
        } as unknown as PluginType);
        result.typesCreated.push(pluginInfo.fullName);
      } catch (err) {
        result.errors.push({
          phase: "type",
          entityName: pluginInfo.fullName,
          message: err instanceof Error ? err.message : String(err),
        });
        Logger.error(`Failed to create type ${pluginInfo.fullName}`, err);
      }
    }

    Logger.info("Deployment complete", {
      action: result.assemblyAction,
      typesCreated: result.typesCreated.length,
      typesUnchanged: result.typesUnchanged.length,
      typesDeleted: result.typesDeleted.length,
      stepsDeleted: result.stepsDeleted.length,
      errors: result.errors.length,
    });

    return result;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private extractHash(description: string | undefined): string | undefined {
    if (!description) { return undefined; }
    const match = description.match(/#hash:([a-f0-9]{64})/);
    return match?.[1];
  }
}
