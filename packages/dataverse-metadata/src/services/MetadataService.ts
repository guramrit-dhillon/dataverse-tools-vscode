import { type IMetadataService } from "../interfaces/IMetadataService";
import { SolutionComponentType, type DataverseEnvironment, type DataverseSolution, type SolutionComponent, DataverseWebApiClient } from "core-dataverse";

export class MetadataService implements IMetadataService {
  constructor(private readonly getToken: (env: DataverseEnvironment) => Promise<string>) {}

  private client(env: DataverseEnvironment): DataverseWebApiClient {
    return new DataverseWebApiClient(env, this.getToken);
  }

  async listEntities(
    env: DataverseEnvironment,
    solutionId?: string,
    includeAllComponents = false,
  ): Promise<SolutionComponent[]> {
    return this.client(env).getSolutionComponents(
      solutionId,
      [SolutionComponentType.Entity],
      includeAllComponents,
    );
  }

  async listSolutions(env: DataverseEnvironment): Promise<DataverseSolution[]> {
    const res = await this.client(env).get<{ value: DataverseSolution[] }>(
      "solutions?$select=solutionid,uniquename,friendlyname,ismanaged&$filter=isvisible eq true&$orderby=friendlyname"
    );
    return res.value;
  }
}
