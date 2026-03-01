import { Connection, Request, type ColumnMetaData } from "tedious";
import * as vscode from "vscode";
import { type DataverseEnvironment, Logger } from "core-dataverse";
import {
  type IQueryService,
  type QueryRequest,
  type QueryResult,
  type ColumnInfo,
} from "../interfaces/IQueryService";

interface PooledConnection {
  connection: Connection;
  envId: string;
  ready: boolean;
}

export class QueryService implements IQueryService {
  private pooled: PooledConnection | undefined;
  private connecting: Promise<Connection> | undefined;

  constructor(
    private readonly getToken: (env: DataverseEnvironment) => Promise<string>
  ) {}

  async execute(
    env: DataverseEnvironment,
    request: QueryRequest
  ): Promise<QueryResult> {
    const start = Date.now();

    const timeoutSec =
      request.timeout ??
      vscode.workspace
        .getConfiguration("dataverse-tools.queryAnalyzer")
        .get<number>("queryTimeout", 30);

    const connection = await this.getConnection(env, timeoutSec);

    return new Promise<QueryResult>((resolve, reject) => {
      const columns: ColumnInfo[] = [];
      const rows: Record<string, unknown>[] = [];
      const messages: string[] = [];
      let rowCount = 0;

      const sqlRequest = new Request(request.sql, (err, count) => {
        if (err) {
          // Connection may be in a bad state — evict it
          this.closePooled();
          Logger.error("Query execution failed", err);
          reject(new Error(err.message));
          return;
        }

        rowCount = count ?? 0;
        resolve({
          columns,
          rows,
          rowCount,
          durationMs: Date.now() - start,
          messages,
        });
      });

      sqlRequest.on(
        "columnMetadata" as never,
        (columnsMetadata: ColumnMetaData[]) => {
          for (const col of columnsMetadata) {
            columns.push({
              name: col.colName,
              type: col.type.name,
            });
          }
        }
      );

      sqlRequest.on("row", (rowColumns) => {
        const row: Record<string, unknown> = {};
        for (const col of rowColumns) {
          row[col.metadata.colName] = col.value;
        }
        rows.push(row);
      });

      connection.execSql(sqlRequest);
    });
  }

  dispose(): void {
    this.closePooled();
  }

  private async getConnection(
    env: DataverseEnvironment,
    timeoutSec: number
  ): Promise<Connection> {
    // If we have a pooled connection for the same environment and it's ready, reuse it
    if (this.pooled?.envId === env.id && this.pooled.ready) {
      return this.pooled.connection;
    }

    // If we're already connecting to the same env, wait for it
    if (this.connecting && this.pooled?.envId === env.id) {
      return this.connecting;
    }

    // Different env or no connection — close old one and create new
    this.closePooled();

    const connectPromise = this.createConnection(env, timeoutSec);
    this.connecting = connectPromise;

    try {
      const connection = await connectPromise;
      return connection;
    } finally {
      this.connecting = undefined;
    }
  }

  private async createConnection(
    env: DataverseEnvironment,
    timeoutSec: number
  ): Promise<Connection> {
    const token = await this.getToken(env);
    const server = env.url.replace(/^https?:\/\//, "").replace(/\/$/, "");

    const config = {
      server,
      authentication: {
        type: "azure-active-directory-access-token" as const,
        options: { token },
      },
      options: {
        port: 5558,
        encrypt: true,
        database: server.split(".")[0],
        requestTimeout: timeoutSec * 1000,
        connectTimeout: timeoutSec * 1000,
        rowCollectionOnRequestCompletion: false,
      },
    };

    return new Promise<Connection>((resolve, reject) => {
      const connection = new Connection(config);

      connection.on("error", (err) => {
        Logger.error("TDS connection error", err);
        this.closePooled();
      });

      connection.on("end", () => {
        // Connection closed by server — evict from pool
        if (this.pooled?.connection === connection) {
          this.pooled = undefined;
        }
      });

      connection.connect((err) => {
        if (err) {
          Logger.error("TDS connection failed", err);
          reject(new Error(`Connection failed: ${err.message}`));
          return;
        }

        this.pooled = {
          connection,
          envId: env.id,
          ready: true,
        };

        resolve(connection);
      });
    });
  }

  private closePooled(): void {
    if (this.pooled) {
      try {
        this.pooled.connection.close();
      } catch {
        // Ignore close errors
      }
      this.pooled = undefined;
    }
  }
}
