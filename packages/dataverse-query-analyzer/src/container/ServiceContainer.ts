import { type DataverseAccountApi } from "core-dataverse";
import { type IQueryService } from "../interfaces/IQueryService";
import { type IMetadataCache } from "../interfaces/IMetadataCache";
import { QueryService } from "../services/QueryService";
import { MetadataCache } from "../services/MetadataCache";

export class ServiceContainer {
  readonly queryService: IQueryService;
  readonly metadataCache: IMetadataCache;

  constructor(api: DataverseAccountApi) {
    this.queryService = new QueryService(api.getAccessToken.bind(api));
    this.metadataCache = new MetadataCache(api.getAccessToken.bind(api));
  }
}
