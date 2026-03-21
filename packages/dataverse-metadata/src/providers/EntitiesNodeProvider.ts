import {
  SolutionComponentType,
  Logger,
  type DetailItem,
  type DetailProperty,
  type ExplorerContext,
  type ExplorerNode,
  type NodeProvider,
  type SolutionComponent,
} from "core-dataverse";
import type { IMetadataService } from "../interfaces/IMetadataService";

/**
 * Built-in provider that contributes the "Entities" group to the unified
 * explorer tree. Queries entity metadata via {@link IMetadataService}.
 */
export class EntitiesNodeProvider implements NodeProvider {
  readonly id = "entities";
  readonly label = "Entities";
  readonly icon = "symbol-class";
  readonly sortOrder = 10;

  constructor(private readonly metadataService: IMetadataService) {}

  async getRoots(context: ExplorerContext): Promise<ExplorerNode[]> {
    try {
      const solutionId = context.solution?.solutionid;
      const includeAllComponents = context.filter.showOutOfSolution && !!solutionId;

      const components = await this.metadataService.listEntities(
        context.environment,
        solutionId,
        includeAllComponents,
      );

      return components
        .sort((a, b) => (a.displayName || a.name).localeCompare(b.displayName || b.name))
        .map((c) => this.toNode(c));
    } catch (err) {
      Logger.error("EntitiesNodeProvider: failed to load entities", err);
      return [];
    }
  }

  async getChildren(node: ExplorerNode): Promise<ExplorerNode[]> {
    if (node.contextValue !== "entity") { return []; }
    const entity = node.data?.entity as SolutionComponent | undefined;
    if (!entity) { return []; }

    const args = [{ logicalName: entity.name, displayName: entity.displayName }];
    return [
      {
        id: `entities:attributes:${entity.objectId}`,
        label: "Attributes",
        tooltip: `Browse attributes of ${entity.displayName || entity.name}`,
        icon: "symbol-field",
        contextValue: "entity.attributes",
        children: "none",
        command: { command: "dataverse-tools.metadata.openAttributes", title: "Open Attributes", arguments: args },
        data: { entity },
      },
      {
        id: `entities:relationships:${entity.objectId}`,
        label: "Relationships",
        tooltip: `Browse relationships of ${entity.displayName || entity.name}`,
        icon: "references",
        contextValue: "entity.relationships",
        children: "none",
        command: { command: "dataverse-tools.metadata.openRelationships", title: "Open Relationships", arguments: args },
        data: { entity },
      },
      {
        id: `entities:forms:${entity.objectId}`,
        label: "Forms",
        tooltip: `Browse forms of ${entity.displayName || entity.name}`,
        icon: "layout",
        contextValue: "entity.forms",
        children: "none",
        command: { command: "dataverse-tools.metadata.openForms", title: "Open Forms", arguments: args },
        data: { entity },
      },
      {
        id: `entities:views:${entity.objectId}`,
        label: "Views",
        tooltip: `Browse views of ${entity.displayName || entity.name}`,
        icon: "list-flat",
        contextValue: "entity.views",
        children: "none",
        command: { command: "dataverse-tools.metadata.openViews", title: "Open Views", arguments: args },
        data: { entity },
      },
    ];
  }

  getDetailItem(node: ExplorerNode): DetailItem | undefined {
    const c = node.data?.entity as SolutionComponent | undefined;
    if (!c) { return undefined; }

    const props: DetailProperty[] = [
      { label: "Display Name", value: c.displayName || "\u2014" },
      { label: "Logical Name", value: c.name, mono: true },
      { label: "ID", value: c.objectId, mono: true },
    ];

    return {
      icon: "$(table)",
      label: c.displayName || c.name,
      properties: props,
    };
  }

  private toNode(c: SolutionComponent): ExplorerNode {
    return {
      id: `entities:entity:${c.objectId}`,
      label: c.displayName || c.name,
      description: c.name,
      tooltip: `${c.displayName}\n${c.name}`,
      icon: "table",
      contextValue: "entity",
      children: "lazy",
      solutionComponent: {
        componentType: SolutionComponentType.Entity,
        componentId: c.objectId,
      },
      data: { entity: c },
    };
  }
}
