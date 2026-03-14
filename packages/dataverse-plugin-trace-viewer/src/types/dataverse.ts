/**
 * Dataverse entity types specific to plugin trace log viewing.
 * Aligned with the Web API OData schema — property names use Dataverse logical names.
 */

export interface PluginTraceLog {
  plugintracelogid: string;
  correlationid?: string;
  requestid?: string;
  typename: string;
  messagename: string;
  primaryentityname?: string;
  depth: number;
  mode: number;           // 0=Synchronous, 1=Asynchronous
  operationtype: number;  // 1=Plugin, 2=WorkflowActivity
  exceptiondetails?: string;
  messageblock?: string;
  performanceinitializationduration?: number;
  performanceexecutionduration?: number;
  createdon: string;
}

export interface TraceLogSuggestions {
  pluginTypeNames: string[];
  messageNames: string[];
  entityNames: string[];
}

export interface TraceLogFilter {
  pluginTypeName?: string;
  messageName?: string;
  entityName?: string;
  correlationId?: string;
  exceptionsOnly?: boolean;
  dateFrom?: string;
  dateTo?: string;
  maxCount?: number;
}
