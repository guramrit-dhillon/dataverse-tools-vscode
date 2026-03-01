import { type DataverseEnvironment } from "core-dataverse";

export interface TableSuggestion {
  logicalName: string;
  displayName: string;
}

export interface ColumnSuggestion {
  logicalName: string;
  type: string;
  displayName: string;
}

export interface SchemaMap {
  tables: TableSuggestion[];
  columns: Record<string, ColumnSuggestion[]>;
}

export interface IMetadataCache {
  getTableNames(env: DataverseEnvironment): Promise<TableSuggestion[]>;
  getColumns(env: DataverseEnvironment, tableName: string): Promise<ColumnSuggestion[]>;
  getSchema(env: DataverseEnvironment): Promise<SchemaMap>;
  invalidate(): void;
}
