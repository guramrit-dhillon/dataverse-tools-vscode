import { type IMetadataService } from "../interfaces/IMetadataService";
import { SolutionComponentType, type DataverseEnvironment, type DataverseSolution, type SolutionComponent, DataverseWebApiClient } from "core-dataverse";
import type { EntityAttribute, EntityRelationships, IntersectRelationship, LookupRelationship, EntityForm, EntityView } from "../types/metadata";

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

  async listAttributes(env: DataverseEnvironment, entityLogicalName: string): Promise<EntityAttribute[]> {
    const res = await this.client(env).get<{ value: EntityAttribute[] }>(
      `EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes` +
      `?$select=MetadataId,LogicalName,DisplayName,AttributeType,AttributeTypeName,RequiredLevel,IsCustomAttribute,IsPrimaryId,IsPrimaryName` +
      `&$orderby=LogicalName`
    );
    return res.value;
  }

  async listRelationships(env: DataverseEnvironment, entityLogicalName: string): Promise<EntityRelationships> {
    const base = `EntityDefinitions(LogicalName='${entityLogicalName}')`;
    const lookupSelect = `$select=MetadataId,SchemaName,ReferencedEntity,ReferencingEntity,ReferencingAttribute,IsCustomRelationship`;
    const intersectSelect = `$select=MetadataId,SchemaName,Entity1LogicalName,Entity2LogicalName,IsCustomRelationship`;

    const [otn, mto, mtm] = await Promise.all([
      this.client(env).get<{ value: LookupRelationship[] }>(`${base}/OneToManyRelationships?${lookupSelect}`),
      this.client(env).get<{ value: LookupRelationship[] }>(`${base}/ManyToOneRelationships?${lookupSelect}`),
      this.client(env).get<{ value: IntersectRelationship[] }>(`${base}/ManyToManyRelationships?${intersectSelect}`),
    ]);

    return {
      oneToMany: otn.value,
      manyToOne: mto.value,
      manyToMany: mtm.value,
    };
  }

  async listForms(env: DataverseEnvironment, entityLogicalName: string): Promise<EntityForm[]> {
    const res = await this.client(env).get<{ value: EntityForm[] }>(
      `systemforms?$select=formid,name,type,ismanaged,description` +
      `&$filter=objecttypecode eq '${entityLogicalName}' and type ne 0` +
      `&$orderby=name`
    );
    return res.value;
  }

  async listViews(env: DataverseEnvironment, entityLogicalName: string): Promise<EntityView[]> {
    const res = await this.client(env).get<{ value: EntityView[] }>(
      `savedqueries?$select=savedqueryid,name,querytype,isdefault,ismanaged,description` +
      `&$filter=returnedtypecode eq '${entityLogicalName}'` +
      `&$orderby=name`
    );
    return res.value;
  }
}
