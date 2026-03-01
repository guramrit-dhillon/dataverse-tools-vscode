import { type DataverseEnvironment } from "core-dataverse";

export interface QueryRequest {
  sql: string;
  timeout?: number;
}

export interface ColumnInfo {
  name: string;
  type: string;
}

export interface QueryResult {
  columns: ColumnInfo[];
  rows: Record<string, unknown>[];
  rowCount: number;
  durationMs: number;
  messages: string[];
}

export interface IQueryService {
  execute(env: DataverseEnvironment, request: QueryRequest): Promise<QueryResult>;
  dispose(): void;
}
