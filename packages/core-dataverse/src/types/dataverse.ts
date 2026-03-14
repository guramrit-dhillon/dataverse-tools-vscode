/**
 * Shared Dataverse entity types used across multiple extensions.
 * Extension-specific types live in each extension's own types/ directory.
 *
 * Property names use the Dataverse logical names where possible.
 */

/** How the extension acquires tokens for a specific environment. */
export type AuthMethod = "vscode" | "azcli" | "devicecode" | "clientcredentials";

export interface DataverseEnvironment {
  id: string;
  name: string;
  url: string;           // e.g. https://org.crm.dynamics.com
  authMethod: AuthMethod;
  accountId?: string;    // VS Code auth only: the specific Microsoft account to use
  tenantId?: string;     // optional — inferred at auth time for most methods
  clientId?: string;     // optional per-env override for custom app registrations
  // Populated from WhoAmI on first successful connection
  userId?: string;
  organizationId?: string;
}

// ─── Plugin Assembly ───────────────────────────────────────────────────────

export interface PluginAssembly {
  pluginassemblyid?: string;
  name: string;
  version: string;
  culture: string;
  publickeytoken: string;
  sourcetype: PluginAssemblySourceType;
  isolationmode: PluginAssemblyIsolationMode;
  ismanaged?: boolean; // Managed or unmanaged
  content?: string; // base64-encoded DLL for database-sourced assemblies
  description?: string;
  // computed from server
  createdon?: string;
  modifiedon?: string;
}

export const enum PluginAssemblySourceType {
  Database = 0,
  Disk = 1,
  GAC = 2,
}

export const enum PluginAssemblyIsolationMode {
  None = 1,
  Sandbox = 2,
}

// ─── Plugin Type ───────────────────────────────────────────────────────────

export interface PluginType {
  plugintypeid?: string;
  typename: string;
  name: string;
  friendlyname: string;
  description?: string;
  assemblyname: string;
  workflowactivitygroupname?: string;
  // navigation property (expand)
  pluginassemblyid_pluginassembly?: { pluginassemblyid: string; name: string };
}

// ─── Cross-extension contracts ─────────────────────────────────────────────

/**
 * Strongly-typed argument passed from dataverse-assemblies to plugin-trace-viewer
 * via `Commands.OpenTraceViewer` → `Commands.TraceLog`.
 *
 * Replaces the duck-typed `Record<string, unknown>` inspection that was
 * previously used in plugin-trace-viewer to extract the filter from a
 * PluginTreeItem. Both sides now share this contract through core-dataverse.
 */
export type TraceLogTarget =
  | { readonly kind: "assembly"; readonly assemblyName: string }
  | { readonly kind: "pluginType"; readonly pluginTypeName: string };

// ─── Details panel ──────────────────────────────────────────────────────────

/** A single row in the Details panel property table. */
export interface DetailProperty {
  label: string;
  value: string | number;
  mono?: boolean;                                      // render in monospace (GUIDs, tokens)
  badge?: "green" | "grey" | "orange" | "blue";       // render as a coloured badge instead of text
}

/**
 * Generic item shown in the shared Details panel owned by dataverse-environments.
 * Each extension converts its selected tree item into this shape and calls
 * `DataverseAccountApi.showDetails()`.
 */
export interface DetailItem {
  icon: string;              // codicon name, e.g. "$(package)"
  label: string;             // displayed in the panel header
  properties: DetailProperty[];
}

// ─── Web API response wrappers ──────────────────────────────────────────────

export interface ODataCollection<T> {
  "@odata.context": string;
  value: T[];
  "@odata.nextLink"?: string;
}

export interface ODataError {
  error: {
    code: string;
    message: string;
    innererror?: {
      message: string;
      type: string;
      stacktrace: string;
    };
  };
}
