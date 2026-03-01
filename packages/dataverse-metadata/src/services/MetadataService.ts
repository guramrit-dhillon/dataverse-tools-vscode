import { type IMetadataService } from "../interfaces/IMetadataService";
import { type DataverseEnvironment, type DataverseEntity, type DataverseSolution, DataverseWebApiClient } from "core-dataverse";

interface RawSolutionComponent {
  msdyn_displayname: string;
  msdyn_ismanaged: boolean;
  msdyn_iscustom: boolean;
  msdyn_name: string;
  msdyn_objectid: string;
  [key: string]: unknown;
}

export class MetadataService implements IMetadataService {
  constructor(private readonly getToken: (env: DataverseEnvironment) => Promise<string>) {}

  private client(env: DataverseEnvironment): DataverseWebApiClient {
    return new DataverseWebApiClient(env, this.getToken);
  }

  async listEntities(env: DataverseEnvironment, solutionId?: string): Promise<DataverseEntity[]> {
    let filter = `(msdyn_componenttype eq 1)`;
    if (solutionId) {
      filter = `(msdyn_solutionid eq ${solutionId}) and ${filter}`;
    }
    const components = await this.client(env).get<{ value: RawSolutionComponent[] }>(
      `msdyn_solutioncomponentsummaries?$filter=${filter}`
    );
    return components.value
      .map((e) => ({
        MetadataId: e.msdyn_objectid,
        LogicalName: e.msdyn_name,
        DisplayName: e.msdyn_displayname ?? e.msdyn_name,
        IsManaged: e.msdyn_ismanaged ?? false,
        IsCustomEntity: e.msdyn_iscustom ?? false,
      }))
      .sort((a, b) => a.LogicalName.localeCompare(b.LogicalName));
  }

  async listSolutions(env: DataverseEnvironment): Promise<DataverseSolution[]> {
    const res = await this.client(env).get<{ value: DataverseSolution[] }>(
      "solutions?$select=solutionid,uniquename,friendlyname,ismanaged&$filter=isvisible eq true&$orderby=friendlyname"
    );
    return res.value;
  }
}
