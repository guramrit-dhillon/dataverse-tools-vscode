import {
  SolutionComponentType,
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
    const solutionId = context.solution?.solutionid;
    const includeAllComponents = context.filter.showOutOfSolution && !!solutionId;

    const components = await this.metadataService.listEntities(
      context.environment,
      solutionId,
      includeAllComponents,
    );

    return components
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => this.toNode(c));
  }

  async getChildren(): Promise<ExplorerNode[]> {
    return [];
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
      children: "none",
      solutionComponent: {
        componentType: SolutionComponentType.Entity,
        componentId: c.objectId,
      },
      data: { entity: c },
    };
  }
}
