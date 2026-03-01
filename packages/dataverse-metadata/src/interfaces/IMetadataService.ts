import { type DataverseEnvironment, type DataverseEntity, type DataverseSolution } from "core-dataverse";

export interface IMetadataService {
  listEntities(env: DataverseEnvironment, solutionId?: string): Promise<DataverseEntity[]>;
  listSolutions(env: DataverseEnvironment): Promise<DataverseSolution[]>;
}
