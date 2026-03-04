import {
  SolutionComponentType,
  WorkflowCategory,
  WorkflowStateCode,
  Logger,
  type DetailItem,
  type DetailProperty,
  type ExplorerContext,
  type ExplorerNode,
  type NodeProvider,
  type WorkflowProcess,
} from "core-dataverse";
import type { IWorkflowService } from "../interfaces/IWorkflowService";

const CATEGORY_LABEL: Record<number, string> = {
  [WorkflowCategory.Workflow]: "Classic Workflows",
  [WorkflowCategory.Dialog]: "Dialogs",
  [WorkflowCategory.BusinessRule]: "Business Rules",
  [WorkflowCategory.Action]: "Actions",
  [WorkflowCategory.BPF]: "Business Process Flows",
  [WorkflowCategory.ModernFlow]: "Modern Flows",
};

const CATEGORY_ICON: Record<number, string> = {
  [WorkflowCategory.Workflow]: "sync",
  [WorkflowCategory.Dialog]: "comment-discussion",
  [WorkflowCategory.BusinessRule]: "law",
  [WorkflowCategory.Action]: "zap",
  [WorkflowCategory.BPF]: "milestone",
  [WorkflowCategory.ModernFlow]: "cloud",
};

const CATEGORY_CONTEXT: Record<number, string> = {
  [WorkflowCategory.Workflow]: "dv.wf",
  [WorkflowCategory.Dialog]: "dv.dialog",
  [WorkflowCategory.BusinessRule]: "dv.businessrule",
  [WorkflowCategory.Action]: "dv.action",
  [WorkflowCategory.BPF]: "dv.bpf",
  [WorkflowCategory.ModernFlow]: "dv.modernflow",
};

const CATEGORY_ORDER: WorkflowCategory[] = [
  WorkflowCategory.Workflow,
  WorkflowCategory.Action,
  WorkflowCategory.BPF,
  WorkflowCategory.BusinessRule,
  WorkflowCategory.Dialog,
  WorkflowCategory.ModernFlow,
];

export class WorkflowsNodeProvider implements NodeProvider {
  readonly id = "workflows";
  readonly label = "Workflows";
  readonly icon = "git-merge";
  readonly sortOrder = 30;

  private readonly cache = new Map<string, ExplorerNode[]>();
  private readonly inflight = new Map<string, Promise<ExplorerNode[]>>();

  constructor(private readonly workflowSvc: IWorkflowService) {}

  async getRoots(context: ExplorerContext): Promise<ExplorerNode[]> {
    return this.fetchCached("__roots__", async () => {
      const solutionId = context.solution?.solutionid;
      const includeAllComponents = context.filter.showOutOfSolution && !!solutionId;
      const { componentScope } = context.filter;

      const all = await this.workflowSvc.listWorkflows(context.environment, solutionId, includeAllComponents, componentScope);

      const byCategory = new Map<number, WorkflowProcess[]>();
      for (const w of all) {
        const bucket = byCategory.get(w.category) ?? [];
        bucket.push(w);
        byCategory.set(w.category, bucket);
      }

      const groups: ExplorerNode[] = [];
      for (const cat of CATEGORY_ORDER) {
        const items = byCategory.get(cat);
        if (!items || items.length === 0) { continue; }
        groups.push({
          id: `workflows:category:${cat}`,
          label: CATEGORY_LABEL[cat] ?? `Category ${cat}`,
          description: `${items.length}`,
          icon: CATEGORY_ICON[cat] ?? "symbol-misc",
          contextValue: `wfCategory:${cat}`,
          children: "lazy",
          data: { workflows: items },
        });
      }
      return groups;
    });
  }

  async getChildren(node: ExplorerNode): Promise<ExplorerNode[]> {
    if (node.contextValue.startsWith("wfCategory:")) {
      const workflows = node.data?.workflows as WorkflowProcess[] | undefined;
      if (!workflows) { return []; }
      return [...workflows]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((w) => this.workflowNode(w));
    }
    return [];
  }

  getDetailItem(node: ExplorerNode): DetailItem | undefined {
    const w = node.data?.workflow as WorkflowProcess | undefined;
    if (!w) { return undefined; }

    const activated = w.statecode === WorkflowStateCode.Activated;
    const categoryLabels: Record<number, string> = {
      0: "Classic Workflow",
      1: "Dialog",
      2: "Business Rule",
      3: "Action",
      4: "Business Process Flow",
      5: "Modern Flow",
    };

    const props: DetailProperty[] = [
      { label: "Name", value: w.name },
      { label: "Category", value: categoryLabels[w.category] ?? String(w.category) },
      { label: "Primary Entity", value: w.primaryentity },
      { label: "Status", value: activated ? "Activated" : "Draft", badge: activated ? "green" : "grey" },
    ];

    if (w.uniquename) {
      props.push({ label: "Unique Name", value: w.uniquename, mono: true });
    }
    if (w.ismanaged !== undefined) {
      props.push({ label: "Managed", value: w.ismanaged ? "Managed" : "Unmanaged", badge: w.ismanaged ? "orange" : "grey" });
    }
    if (w.description) {
      props.push({ label: "Description", value: w.description });
    }
    if (w.modifiedon) {
      props.push({ label: "Modified", value: new Date(w.modifiedon).toLocaleString() });
    }
    if (w.createdon) {
      props.push({ label: "Created", value: new Date(w.createdon).toLocaleString() });
    }
    props.push({ label: "ID", value: w.workflowid, mono: true });

    return {
      icon: activated ? "$(circle-filled)" : "$(circle-outline)",
      label: w.name,
      properties: props,
    };
  }

  onRefresh(): void {
    this.cache.clear();
    this.inflight.clear();
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private workflowNode(w: WorkflowProcess): ExplorerNode {
    const activated = w.statecode === WorkflowStateCode.Activated;
    const baseCtx = CATEGORY_CONTEXT[w.category] ?? "workflow";

    const contextValue =
      w.category === WorkflowCategory.Workflow && activated
        ? "dv.wf.ondemand"
        : `${baseCtx}.${activated ? "activated" : "draft"}`;

    return {
      id: `workflows:workflow:${w.workflowid}`,
      label: w.name,
      description: w.primaryentity !== "none" ? w.primaryentity : undefined,
      tooltip: [
        w.name,
        `Entity: ${w.primaryentity}`,
        `Status: ${activated ? "Activated" : "Draft"}`,
        w.description ? `\n${w.description}` : undefined,
      ].filter(Boolean).join("\n"),
      icon: activated ? "circle-filled" : "circle-outline",
      iconColor: activated ? undefined : "disabledForeground",
      contextValue,
      children: "none",
      solutionComponent: {
        componentType: SolutionComponentType.Workflow,
        componentId: w.workflowid,
      },
      data: { workflow: w },
    };
  }

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
        Logger.error(`WorkflowsNodeProvider: failed to load "${key}"`, err);
        throw err;
      });

    this.inflight.set(key, promise);
    return promise;
  }
}
