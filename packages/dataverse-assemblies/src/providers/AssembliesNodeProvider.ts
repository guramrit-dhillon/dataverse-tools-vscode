import {
  SolutionComponentType,
  StepStateCode,
  type DetailItem,
  type DetailProperty,
  type ExplorerContext,
  type ExplorerNode,
  type NodeProvider,
  type PluginAssembly,
  type PluginType,
  type SdkMessageProcessingStep,
  PluginAssemblyIsolationMode,
  StepMode,
  StepStage,
  Logger,
} from "core-dataverse";
import { type IRegistrationService } from "../interfaces/IRegistrationService";

const GUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isGuid(s: string | undefined): boolean {
  return !!s && GUID_RE.test(s);
}

function typeDisplayName(t: PluginType): string {
  return (!isGuid(t.friendlyname) && t.friendlyname) ||
    t.typename.split(".").pop() ||
    t.typename;
}

function stageToLabel(stage: number): string {
  switch (stage) {
    case StepStage.PreValidation: return "PreValidation";
    case StepStage.PreOperation: return "PreOperation";
    case StepStage.PostOperation: return "PostOperation";
    default: return `Stage ${stage}`;
  }
}

/**
 * Contributes the "Assemblies" group to the unified Dataverse Explorer.
 *
 * Tree structure:
 *   ► Assembly
 *     ► Plugins (count)
 *       ► PluginType
 *         ● Step (message:entity, stage)
 *     ► Workflow Activities (count)
 *       ► ActivityType
 *
 * Registered by the dataverse-assemblies extension via {@link DataverseExplorerApi}.
 */
export class AssembliesNodeProvider implements NodeProvider {
  readonly id = "assemblies";
  readonly label = "Assemblies";
  readonly icon = "package";
  readonly sortOrder = 20;

  private readonly cache = new Map<string, ExplorerNode[]>();
  private readonly inflight = new Map<string, Promise<ExplorerNode[]>>();

  constructor(private readonly registrationSvc: IRegistrationService) {}

  // ── NodeProvider ────────────────────────────────────────────────────────────

  async getRoots(context: ExplorerContext): Promise<ExplorerNode[]> {
    return this.fetchCached("__roots__", async () => {
      let assemblies = await this.registrationSvc.listAssemblies(
        context.environment,
      );

      if (context.filter.componentScope === "unmanaged") {
        assemblies = assemblies.filter((a) => !a.ismanaged);
      }

      assemblies.sort((a, b) => a.name.localeCompare(b.name));
      return assemblies.map((a) => this.assemblyNode(a));
    });
  }

  async getChildren(
    node: ExplorerNode,
    context: ExplorerContext,
  ): Promise<ExplorerNode[]> {
    // Assembly → fetch types, split into Plugins / Activities group nodes
    if (node.contextValue === "assembly") {
      const assembly = node.data?.assembly as PluginAssembly | undefined;
      if (!assembly?.pluginassemblyid) { return []; }
      return this.fetchCached(assembly.pluginassemblyid, async () => {
        const types = await this.registrationSvc.listPluginTypes(
          context.environment,
          assembly.pluginassemblyid!,
        );
        const plugins = types.filter((t) => !t.workflowactivitygroupname);
        const activities = types.filter((t) => !!t.workflowactivitygroupname);
        const groups: ExplorerNode[] = [];
        if (plugins.length > 0) {
          groups.push(this.pluginGroupNode(assembly, plugins));
        }
        if (activities.length > 0) {
          groups.push(this.activityGroupNode(assembly, activities));
        }
        return groups;
      });
    }

    // Plugins group → list plugin type nodes
    if (node.contextValue === "pluginGroup") {
      const types = node.data?.types as PluginType[] | undefined;
      if (!types) { return []; }
      return [...types]
        .sort((a, b) => typeDisplayName(a).localeCompare(typeDisplayName(b)))
        .map((t) => this.pluginTypeNode(t));
    }

    // Activities group → list activity type nodes
    if (node.contextValue === "activityGroup") {
      const types = node.data?.types as PluginType[] | undefined;
      if (!types) { return []; }
      return [...types]
        .sort((a, b) => typeDisplayName(a).localeCompare(typeDisplayName(b)))
        .map((t) => this.pluginTypeNode(t));
    }

    // Activity types have no step children
    if (node.contextValue === "activityType") {
      return [];
    }

    // Plugin type → list steps
    if (node.contextValue === "pluginType") {
      const pluginType = node.data?.pluginType as PluginType | undefined;
      if (!pluginType?.plugintypeid) { return []; }
      return this.fetchCached(pluginType.plugintypeid, async () => {
        const steps = await this.registrationSvc.listSteps(
          context.environment,
          pluginType.plugintypeid!,
        );
        steps.sort((a, b) => a.name.localeCompare(b.name));
        return steps.map((s) => this.stepNode(s));
      });
    }

    return [];
  }

  getDetailItem(node: ExplorerNode): DetailItem | undefined {
    if (node.contextValue === "assembly") {
      return this.assemblyDetail(node.data?.assembly as PluginAssembly | undefined);
    }
    if (node.contextValue === "pluginType" || node.contextValue === "activityType") {
      return this.pluginTypeDetail(node.data?.pluginType as PluginType | undefined);
    }
    if (node.contextValue === "step.enabled" || node.contextValue === "step.disabled") {
      return this.stepDetail(node.data?.step as SdkMessageProcessingStep | undefined);
    }
    return undefined;
  }

  onRefresh(): void {
    this.cache.clear();
    this.inflight.clear();
  }

  // ── Node builders ───────────────────────────────────────────────────────────

  private pluginGroupNode(assembly: PluginAssembly, types: PluginType[]): ExplorerNode {
    return {
      id: `assemblies:pluginGroup:${assembly.pluginassemblyid}`,
      label: "Plugins",
      description: `${types.length}`,
      icon: "symbol-class",
      contextValue: "pluginGroup",
      children: "lazy",
      data: { assembly, types },
    };
  }

  private activityGroupNode(assembly: PluginAssembly, types: PluginType[]): ExplorerNode {
    return {
      id: `assemblies:activityGroup:${assembly.pluginassemblyid}`,
      label: "Workflow Activities",
      description: `${types.length}`,
      icon: "symbol-event",
      contextValue: "activityGroup",
      children: "lazy",
      data: { assembly, types },
    };
  }

  private assemblyNode(assembly: PluginAssembly): ExplorerNode {
    return {
      id: `assemblies:assembly:${assembly.pluginassemblyid}`,
      label: assembly.name,
      description: `v${assembly.version}`,
      tooltip: `${assembly.name} ${assembly.version}\nPublicKeyToken: ${assembly.publickeytoken}`,
      icon: "package",
      contextValue: "assembly",
      children: "lazy",
      solutionComponent: {
        componentType: SolutionComponentType.PluginAssembly,
        componentId: assembly.pluginassemblyid!,
      },
      data: { assembly },
    };
  }

  private pluginTypeNode(pluginType: PluginType): ExplorerNode {
    const displayName = typeDisplayName(pluginType);
    const isActivity = !!pluginType.workflowactivitygroupname;
    return {
      id: `assemblies:pluginType:${pluginType.plugintypeid}`,
      label: displayName,
      description: pluginType.typename,
      tooltip: pluginType.typename,
      icon: isActivity ? "symbol-event" : "symbol-class",
      contextValue: isActivity ? "activityType" : "pluginType",
      children: isActivity ? "none" : "lazy",
      // PluginTypes are auto-included as subcomponents of their assembly —
      // no independent solutionComponent annotation needed.
      data: { pluginType },
    };
  }

  private stepNode(step: SdkMessageProcessingStep): ExplorerNode {
    const message = step.sdkmessageid?.name ?? "Unknown";
    const entity = step.sdkmessagefilterid?.primaryobjecttypecode ?? "any";
    const disabled = step.statecode === StepStateCode.Disabled;

    return {
      id: `assemblies:step:${step.sdkmessageprocessingstepid}`,
      label: `${message}: ${entity}`,
      description: `${stageToLabel(step.stage)} | rank ${step.rank}`,
      tooltip: [
        `Message: ${message}`,
        `Entity: ${entity}`,
        `Stage: ${stageToLabel(step.stage)}`,
        `Mode: ${step.mode === 0 ? "Sync" : "Async"}`,
        `Rank: ${step.rank}`,
        step.filteringattributes ? `Filtering: ${step.filteringattributes}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      icon: disabled ? "debug-pause" : "zap",
      iconColor: disabled ? "disabledForeground" : undefined,
      contextValue: disabled ? "step.disabled" : "step.enabled",
      children: "none",
      solutionComponent: {
        componentType: SolutionComponentType.SdkMessageProcessingStep,
        componentId: step.sdkmessageprocessingstepid!,
      },
      data: { step },
    };
  }

  // ── Detail builders ─────────────────────────────────────────────────────────

  private assemblyDetail(a: PluginAssembly | undefined): DetailItem | undefined {
    if (!a) { return undefined; }
    return {
      icon: "$(package)",
      label: a.name,
      properties: [
        prop("Name", a.name),
        prop("Version", a.version),
        prop("Culture", a.culture || "neutral"),
        prop("Public Key", a.publickeytoken || "null", { mono: true }),
        {
          label: "Isolation",
          value: a.isolationmode === PluginAssemblyIsolationMode.Sandbox ? "Sandbox" : "None",
          badge: a.isolationmode === PluginAssemblyIsolationMode.Sandbox ? "blue" : "grey",
        },
        ...(a.ismanaged !== undefined
          ? [{
              label: "Managed",
              value: a.ismanaged ? "Managed" : "Unmanaged",
              badge: (a.ismanaged ? "orange" : "grey") as DetailProperty["badge"],
            }]
          : []),
        prop("Created", a.createdon ? new Date(a.createdon).toLocaleString() : undefined),
        prop("Modified", a.modifiedon ? new Date(a.modifiedon).toLocaleString() : undefined),
        prop("ID", a.pluginassemblyid, { mono: true }),
      ].filter(Boolean) as DetailProperty[],
    };
  }

  private pluginTypeDetail(t: PluginType | undefined): DetailItem | undefined {
    if (!t) { return undefined; }
    const label = typeDisplayName(t);
    const isActivity = !!t.workflowactivitygroupname;
    return {
      icon: isActivity ? "$(symbol-event)" : "$(symbol-class)",
      label,
      properties: [
        prop("Type Name", t.typename),
        prop("Friendly Name", t.friendlyname),
        ...(isActivity
          ? [{ label: "Kind", value: "Workflow Activity", badge: "blue" as DetailProperty["badge"] }]
          : [{ label: "Kind", value: "Plugin", badge: "grey" as DetailProperty["badge"] }]),
        prop("Activity Group", t.workflowactivitygroupname),
        prop("Description", t.description),
        prop("Assembly", t.assemblyname),
        prop("ID", t.plugintypeid, { mono: true }),
      ].filter(Boolean) as DetailProperty[],
    };
  }

  private stepDetail(s: SdkMessageProcessingStep | undefined): DetailItem | undefined {
    if (!s) { return undefined; }
    const stageMap: Record<number, string> = {
      [StepStage.PreValidation]: "PreValidation (10)",
      [StepStage.PreOperation]: "PreOperation (20)",
      [StepStage.PostOperation]: "PostOperation (40)",
    };
    const enabled = s.statecode === StepStateCode.Enabled;
    return {
      icon: enabled ? "$(zap)" : "$(debug-pause)",
      label: s.name,
      properties: [
        prop("Name", s.name),
        prop("Message", s.sdkmessageid?.name ?? "Unknown"),
        prop("Entity", s.sdkmessagefilterid?.primaryobjecttypecode ?? "any"),
        prop("Stage", stageMap[s.stage] ?? String(s.stage)),
        prop("Mode", s.mode === StepMode.Synchronous ? "Synchronous" : "Asynchronous"),
        prop("Rank", s.rank),
        { label: "State", value: enabled ? "Enabled" : "Disabled", badge: enabled ? "green" : "grey" },
        prop("Filtering", s.filteringattributes),
        prop("Config", s.configuration),
        prop("Description", s.description),
        prop("ID", s.sdkmessageprocessingstepid, { mono: true }),
      ].filter(Boolean) as DetailProperty[],
    };
  }

  // ── Caching ─────────────────────────────────────────────────────────────────

  /**
   * Fetch-and-cache with in-flight deduplication.
   * VS Code may fire getChildren multiple times quickly for the same node;
   * this prevents duplicate API calls.
   */
  private fetchCached(
    key: string,
    loader: () => Promise<ExplorerNode[]>,
  ): Promise<ExplorerNode[]> {
    const cached = this.cache.get(key);
    if (cached) { return Promise.resolve(cached); }

    const existing = this.inflight.get(key);
    if (existing) { return existing; }

    const promise = loader()
      .then((items) => {
        this.cache.set(key, items);
        this.inflight.delete(key);
        return items;
      })
      .catch((err) => {
        this.inflight.delete(key);
        Logger.error(`AssembliesNodeProvider: failed to load "${key}"`, err);
        throw err;
      });

    this.inflight.set(key, promise);
    return promise;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function prop(
  label: string,
  value: string | number | undefined | null,
  opts?: Omit<DetailProperty, "label" | "value">,
): DetailProperty | null {
  if (value === undefined || value === null || value === "") { return null; }
  return { label, value, ...opts };
}
