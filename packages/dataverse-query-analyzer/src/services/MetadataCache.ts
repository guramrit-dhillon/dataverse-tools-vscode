import { DataverseWebApiClient, type DataverseEnvironment } from "core-dataverse";
import {
  type IMetadataCache,
  type TableSuggestion,
  type ColumnSuggestion,
  type SchemaMap,
} from "../interfaces/IMetadataCache";

const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface EntityDef {
  LogicalName: string;
  DisplayName?: { UserLocalizedLabel?: { Label?: string } };
}

interface AttributeDef {
  LogicalName: string;
  AttributeType: string;
  DisplayName?: { UserLocalizedLabel?: { Label?: string } };
}

export class MetadataCache implements IMetadataCache {
  private tableCache = new Map<string, CacheEntry<TableSuggestion[]>>();
  private columnCache = new Map<string, CacheEntry<ColumnSuggestion[]>>();

  constructor(
    private readonly getToken: (env: DataverseEnvironment) => Promise<string>
  ) {}

  async getTableNames(env: DataverseEnvironment): Promise<TableSuggestion[]> {
    const key = env.id;
    const cached = this.tableCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    const client = new DataverseWebApiClient(env, this.getToken);
    const data = await client.get<{ value: EntityDef[] }>(
      "EntityDefinitions?$select=LogicalName,DisplayName"
    );

    const tables: TableSuggestion[] = data.value
      .map((e) => ({
        logicalName: e.LogicalName,
        displayName:
          e.DisplayName?.UserLocalizedLabel?.Label ?? e.LogicalName,
      }))
      .sort((a, b) => a.logicalName.localeCompare(b.logicalName));

    this.tableCache.set(key, { data: tables, timestamp: Date.now() });
    return tables;
  }

  async getColumns(
    env: DataverseEnvironment,
    tableName: string
  ): Promise<ColumnSuggestion[]> {
    const key = `${env.id}:${tableName}`;
    const cached = this.columnCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    const client = new DataverseWebApiClient(env, this.getToken);
    const data = await client.get<{ value: AttributeDef[] }>(
      `EntityDefinitions(LogicalName='${tableName}')/Attributes?$select=LogicalName,AttributeType,DisplayName`
    );

    const columns: ColumnSuggestion[] = data.value
      .map((a) => ({
        logicalName: a.LogicalName,
        type: a.AttributeType,
        displayName:
          a.DisplayName?.UserLocalizedLabel?.Label ?? a.LogicalName,
      }))
      .sort((a, b) => a.logicalName.localeCompare(b.logicalName));

    this.columnCache.set(key, { data: columns, timestamp: Date.now() });
    return columns;
  }

  async getSchema(env: DataverseEnvironment): Promise<SchemaMap> {
    const tables = await this.getTableNames(env);
    return {
      tables,
      columns: {},
    };
  }

  invalidate(): void {
    this.tableCache.clear();
    this.columnCache.clear();
  }
}
