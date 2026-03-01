import {
  DataverseWebApiClient,
  type DataverseEnvironment,
  type ODataCollection,
  type PluginTraceLog,
  type TraceLogFilter,
  type TraceLogSuggestions,
} from "core-dataverse";

export class TraceLogService {
  constructor(
    private readonly getToken: (env: DataverseEnvironment) => Promise<string>,
  ) {}

  private client(env: DataverseEnvironment): DataverseWebApiClient {
    return new DataverseWebApiClient(env, this.getToken);
  }

  async listTraceLogs(env: DataverseEnvironment, filter: TraceLogFilter): Promise<PluginTraceLog[]> {
    const clauses: string[] = [];

    if (filter.pluginTypeName) {
      clauses.push(`contains(typename,'${filter.pluginTypeName.replace(/'/g, "''")}')`);
    }
    if (filter.messageName) {
      clauses.push(`messagename eq '${filter.messageName.replace(/'/g, "''")}'`);
    }
    if (filter.entityName) {
      clauses.push(`primaryentity eq '${filter.entityName.replace(/'/g, "''")}'`);
    }
    if (filter.correlationId) {
      clauses.push(`correlationid eq '${filter.correlationId.replace(/'/g, "''")}'`);
    }
    if (filter.exceptionsOnly) {
      clauses.push(`exceptiondetails ne null and exceptiondetails ne ''`);
    }
    if (filter.dateFrom) {
      clauses.push(`createdon ge ${new Date(filter.dateFrom).toISOString()}`);
    }
    if (filter.dateTo) {
      clauses.push(`createdon le ${new Date(filter.dateTo).toISOString()}`);
    }

    const filterPart = clauses.length > 0 ? `&$filter=${clauses.join(" and ")}` : "";
    const top = Math.min(filter.maxCount ?? 50, 5000);
    const query = `plugintracelogs?$orderby=createdon desc&$top=${top}${filterPart}`;

    const data = await this.client(env).get<ODataCollection<PluginTraceLog>>(query);
    return data.value;
  }

  async listSuggestions(env: DataverseEnvironment): Promise<TraceLogSuggestions> {
    const client = this.client(env);

    const [types, messages, entities] = await Promise.all([
      client.get<ODataCollection<{ typename: string }>>(
        "plugintracelogs?fetchXml=<fetch distinct='true' no-lock='true'><entity name='plugintracelog'><attribute name='typename' /></entity></fetch>"
      ),
      client.get<ODataCollection<{ messagename: string }>>(
        "plugintracelogs?fetchXml=<fetch distinct='true' no-lock='true'><entity name='plugintracelog'><attribute name='messagename' /></entity></fetch>"
      ),
      client.get<ODataCollection<{ primaryentity: string }>>(
        "plugintracelogs?fetchXml=<fetch distinct='true' no-lock='true'><entity name='plugintracelog'><attribute name='primaryentity' /></entity></fetch>"
      ),
    ]);

    return {
      pluginTypeNames: types.value.map((r) => r.typename).sort(),
      messageNames: messages.value.map((r) => r.messagename).sort(),
      entityNames: entities.value
        .map((r) => r.primaryentity)
        .filter((e) => e && e !== "none")
        .sort(),
    };
  }
}
