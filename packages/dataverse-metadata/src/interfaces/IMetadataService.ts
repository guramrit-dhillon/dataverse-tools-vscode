import { type DataverseEnvironment, type DataverseSolution, type SolutionComponent } from "core-dataverse";
import type { EntityAttribute, EntityRelationships, EntityForm, EntityView } from "../types/metadata";

export interface IMetadataService {
  listEntities(
    env: DataverseEnvironment,
    solutionId?: string,
    includeAllComponents?: boolean,
  ): Promise<SolutionComponent[]>;
  listSolutions(env: DataverseEnvironment): Promise<DataverseSolution[]>;
  listAttributes(env: DataverseEnvironment, entityLogicalName: string): Promise<EntityAttribute[]>;
  listRelationships(env: DataverseEnvironment, entityLogicalName: string): Promise<EntityRelationships>;
  listForms(env: DataverseEnvironment, entityLogicalName: string): Promise<EntityForm[]>;
  listViews(env: DataverseEnvironment, entityLogicalName: string): Promise<EntityView[]>;
  getViewDetails(env: DataverseEnvironment, savedqueryid: string): Promise<EntityView>;
}
