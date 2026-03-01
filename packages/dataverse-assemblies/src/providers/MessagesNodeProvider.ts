import {
  StepStateCode,
  StepMode,
  StepStage,
  SolutionComponentType,
  type DetailItem,
  type DetailProperty,
  type ExplorerContext,
  type ExplorerNode,
  type NodeProvider,
  type SdkMessage,
  type SdkMessageFilter,
  type SdkMessageProcessingStep,
  type DataverseEntity,
  Logger,
} from "core-dataverse";
import { type IRegistrationService } from "../interfaces/IRegistrationService";

function stageToLabel(stage: number): string {
  switch (stage) {
    case StepStage.PreValidation: return "PreValidation";
    case StepStage.PreOperation: return "PreOperation";
    case StepStage.PostOperation: return "PostOperation";
    default: return `Stage ${stage}`;
  }
}

/**
 * Contributes the "Messages" group to the unified Dataverse Explorer
 * and injects step-by-message children under entity nodes from EntitiesNodeProvider.
 *
 * Top-level tree:
 *   ► Message (e.g. Create)
 *     ► Filter / entity (e.g. account)
 *       ● Step
 *
 * Entity contributions:
 *   ► entity (from EntitiesNodeProvider)
 *     ► Messages (Plugins)             ← contributed by this provider
 *       ► message group (e.g. Create)
 *         ● Step
 */
export class MessagesNodeProvider implements NodeProvider {
  readonly id = "messages";
  readonly label = "Messages";
  readonly icon = "mail";
  readonly sortOrder = 15;

  private readonly cache = new Map<string, ExplorerNode[]>();
  private readonly inflight = new Map<string, Promise<ExplorerNode[]>>();

  constructor(private readonly registrationSvc: IRegistrationService) {}

  // ── NodeProvider ────────────────────────────────────────────────────────────

  async getRoots(context: ExplorerContext): Promise<ExplorerNode[]> {
    return this.fetchCached("__roots__", async () => {
      const messages = await this.registrationSvc.listMessages(context.environment);
      return messages.map((m) => this.messageNode(m));
    });
  }

  async getChildren(
    node: ExplorerNode,
    context: ExplorerContext,
  ): Promise<ExplorerNode[]> {
    // Message → filters (entities)
    if (node.contextValue === "message") {
      const msg = node.data?.message as SdkMessage | undefined;
      if (!msg?.sdkmessageid) { return []; }
      return this.fetchCached(`msg:${msg.sdkmessageid}`, async () => {
        const filters = await this.registrationSvc.listMessageFilters(
          context.environment,
          msg.sdkmessageid,
        );
        filters.sort((a, b) =>
          (a.primaryobjecttypecode || "").localeCompare(b.primaryobjecttypecode || ""),
        );
        return filters.map((f) => this.filterNode(f, msg));
      });
    }

    // MessageFilter → steps
    if (node.contextValue === "messageFilter") {
      const filter = node.data?.filter as SdkMessageFilter | undefined;
      if (!filter?.sdkmessagefilterid) { return []; }
      return this.fetchCached(`filter:${filter.sdkmessagefilterid}`, async () => {
        const steps = await this.registrationSvc.listStepsByMessageFilter(
          context.environment,
          filter.sdkmessagefilterid,
        );
        steps.sort((a, b) => a.name.localeCompare(b.name));
        return steps.map((s) => this.stepNode(s));
      });
    }

    // Entity plugin group → message groups (contributed under entity nodes)
    if (node.contextValue === "entityPluginGroup") {
      const steps = node.data?.steps as SdkMessageProcessingStep[] | undefined;
      const entityLogicalName = node.data?.entityLogicalName as string;
      if (!steps || steps.length === 0) { return []; }

      const byMessage = new Map<string, SdkMessageProcessingStep[]>();
      for (const step of steps) {
        const msgName = step.sdkmessageid?.name ?? "Unknown";
        const group = byMessage.get(msgName) ?? [];
        group.push(step);
        byMessage.set(msgName, group);
      }

      return [...byMessage.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([msgName, msgSteps]) => ({
          id: `messages:entity-msg:${entityLogicalName}:${msgName}`,
          label: msgName,
          description: `${msgSteps.length} step${msgSteps.length === 1 ? "" : "s"}`,
          icon: "mail" as const,
          contextValue: "entityMessageGroup",
          children: "lazy" as const,
          data: { steps: msgSteps, entityLogicalName },
        }));
    }

    // Entity message group → steps
    if (node.contextValue === "entityMessageGroup") {
      const steps = node.data?.steps as SdkMessageProcessingStep[] | undefined;
      if (!steps || steps.length === 0) { return []; }
      return steps.map((s) => this.stepNode(s));
    }

    return [];
  }

  getDetailItem(node: ExplorerNode): DetailItem | undefined {
    if (node.contextValue === "message") {
      return this.messageDetail(node.data?.message as SdkMessage | undefined);
    }
    if (node.contextValue === "messageFilter") {
      return this.filterDetail(node.data?.filter as SdkMessageFilter | undefined);
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

  // ── Cross-provider contributions ──────────────────────────────────────────

  canContributeChildren(contextValue: string): boolean {
    return contextValue === "entity";
  }

  async contributeChildren(
    node: ExplorerNode,
    context: ExplorerContext,
  ): Promise<ExplorerNode[]> {
    const entity = node.data?.entity as DataverseEntity | undefined;
    if (!entity) { return []; }

    return this.fetchCached(`entity:${entity.LogicalName}`, async () => {
      const steps = await this.registrationSvc.listStepsByEntity(
        context.environment,
        entity.LogicalName,
      );
      if (steps.length === 0) { return []; }

      return [{
        id: `messages:entity-plugins:${entity.LogicalName}`,
        label: "Messages (Plugins)",
        description: `${steps.length} step${steps.length === 1 ? "" : "s"}`,
        icon: "mail",
        contextValue: "entityPluginGroup",
        children: "lazy" as const,
        data: { steps, entityLogicalName: entity.LogicalName },
      }];
    });
  }

  // ── Node builders ─────────────────────────────────────────────────────────

  private messageNode(msg: SdkMessage): ExplorerNode {
    return {
      id: `messages:msg:${msg.sdkmessageid}`,
      label: msg.name,
      icon: "mail",
      contextValue: "message",
      children: "lazy",
      data: { message: msg },
    };
  }

  private filterNode(filter: SdkMessageFilter, msg: SdkMessage): ExplorerNode {
    const entity = filter.primaryobjecttypecode || "(global)";
    return {
      id: `messages:filter:${filter.sdkmessagefilterid}`,
      label: entity,
      icon: "filter",
      contextValue: "messageFilter",
      children: "lazy",
      data: { filter, message: msg },
    };
  }

  private stepNode(step: SdkMessageProcessingStep): ExplorerNode {
    const message = step.sdkmessageid?.name ?? "Unknown";
    const entity = step.sdkmessagefilterid?.primaryobjecttypecode ?? "any";
    const disabled = step.statecode === StepStateCode.Disabled;

    return {
      id: `messages:step:${step.sdkmessageprocessingstepid}`,
      label: step.name,
      description: `${stageToLabel(step.stage)} | ${step.mode === StepMode.Synchronous ? "Sync" : "Async"} | rank ${step.rank}`,
      tooltip: [
        `Message: ${message}`,
        `Entity: ${entity}`,
        `Stage: ${stageToLabel(step.stage)}`,
        `Mode: ${step.mode === StepMode.Synchronous ? "Sync" : "Async"}`,
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

  // ── Detail builders ───────────────────────────────────────────────────────

  private messageDetail(msg: SdkMessage | undefined): DetailItem | undefined {
    if (!msg) { return undefined; }
    return {
      icon: "$(mail)",
      label: msg.name,
      properties: [
        prop("Name", msg.name),
        prop("ID", msg.sdkmessageid, { mono: true }),
      ].filter(Boolean) as DetailProperty[],
    };
  }

  private filterDetail(filter: SdkMessageFilter | undefined): DetailItem | undefined {
    if (!filter) { return undefined; }
    const entity = filter.primaryobjecttypecode || "(global)";
    return {
      icon: "$(filter)",
      label: entity,
      properties: [
        prop("Entity", filter.primaryobjecttypecode || "(none)"),
        prop("Secondary Entity", filter.secondaryobjecttypecode || "(none)"),
        prop("Availability", filter.availability),
        prop("ID", filter.sdkmessagefilterid, { mono: true }),
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
        prop("Description", s.description),
        prop("ID", s.sdkmessageprocessingstepid, { mono: true }),
      ].filter(Boolean) as DetailProperty[],
    };
  }

  // ── Caching ───────────────────────────────────────────────────────────────

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
        Logger.error(`MessagesNodeProvider: failed to load "${key}"`, err);
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
