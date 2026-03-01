import {
  SolutionComponentType,
  type DataverseEntity,
  type DetailItem,
  type DetailProperty,
  type ExplorerContext,
  type ExplorerNode,
  type NodeProvider,
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
    const solutionId = context.filter.showOutOfSolution
      ? undefined
      : context.solution?.solutionid;
    const entities = await this.metadataService.listEntities(
      context.environment,
      solutionId,
    );
    return entities.map((e) => this.toNode(e));
  }

  async getChildren(): Promise<ExplorerNode[]> {
    // Entities are leaf nodes for now — no children
    return [];
  }

  getDetailItem(node: ExplorerNode): DetailItem | undefined {
    const e = node.data?.entity as DataverseEntity | undefined;
    if (!e) { return undefined; }

    const props: DetailProperty[] = [
      { label: "Display Name", value: e.DisplayName || "\u2014" },
      { label: "Logical Name", value: e.LogicalName, mono: true },
      { label: "ID", value: e.MetadataId, mono: true },
    ];

    return {
      icon: "$(table)",
      label: e.DisplayName || e.LogicalName,
      properties: props,
    };
  }

  private toNode(entity: DataverseEntity): ExplorerNode {
    return {
      id: `entities:entity:${entity.MetadataId}`,
      label: entity.DisplayName || entity.LogicalName,
      description: entity.LogicalName,
      tooltip: `${entity.DisplayName}\n${entity.LogicalName}`,
      icon: "table",
      contextValue: "entity",
      children: "none",
      solutionComponent: {
        componentType: SolutionComponentType.Entity,
        componentId: entity.MetadataId,
      },
      data: { entity },
    };
  }
}
