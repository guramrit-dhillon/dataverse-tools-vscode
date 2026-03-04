import { type DataverseEnvironment, type DataverseSolution, type SolutionComponent } from "core-dataverse";

export interface IMetadataService {
  listEntities(
    env: DataverseEnvironment,
    solutionId?: string,
    includeAllComponents?: boolean,
  ): Promise<SolutionComponent[]>;
  listSolutions(env: DataverseEnvironment): Promise<DataverseSolution[]>;
}
