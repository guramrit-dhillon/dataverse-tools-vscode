import axios, { type AxiosInstance } from "axios";
import { SolutionComponentType, type DataverseEnvironment, type ODataCollection, type SolutionComponent } from "../types";
import { retry, isTransientHttpError, DataverseError } from "../utils";

const API_VERSION = "v9.2";
const TIMEOUT_MS = 30_000;

/**
 * Typed HTTP client for the Dataverse Web API (OData v4).
 *
 * Responsibilities:
 *  - Token acquisition via an injected getter (caching is the caller's concern)
 *  - Base URL construction (`<env.url>/api/data/v9.2`)
 *  - Common OData headers (Content-Type, Accept, OData-MaxVersion, Prefer)
 *  - Typed `get`, `getAll` (pagination), `post`, `patch`, `delete` methods
 *  - Transient-error retry (3 attempts, 800 ms back-off)
 */
export class DataverseWebApiClient {
  readonly baseURL: string;

  constructor(
    readonly env: DataverseEnvironment,
    private readonly getToken: (env: DataverseEnvironment) => Promise<string>
  ) {
    this.baseURL = `${env.url.replace(/\/$/, "")}/api/data/${API_VERSION}`;
  }

  // ── Low-level ──────────────────────────────────────────────────────────────

  /** Builds a fresh axios instance with a valid Bearer token. */
  private async instance(extraHeaders?: Record<string, string>): Promise<AxiosInstance> {
    const token = await this.getToken(this.env);
    return axios.create({
      baseURL: this.baseURL,
      timeout: TIMEOUT_MS,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
        Accept: "application/json",
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0",
        Prefer: 'return=representation,odata.include-annotations="*"',
        ...extraHeaders,
      },
    });
  }

  // ── Read ───────────────────────────────────────────────────────────────────

  async get<T>(path: string, extraHeaders?: Record<string, string>): Promise<T> {
    const http = await this.instance(extraHeaders);
    const res = await this.request(() => http.get<T>(path));
    return res.data;
  }

  /** Follows `@odata.nextLink` pages automatically and returns a flat array. */
  async getAll<T>(entity: string, query: string): Promise<T[]> {
    const http = await this.instance();
    const results: T[] = [];
    let url: string | undefined = `${entity}?${query}`;

    while (url) {
      const res = await this.request(() => http.get<ODataCollection<T>>(url!));
      results.push(...res.data.value);
      url = res.data["@odata.nextLink"];
    }

    return results;
  }

  // ── Write ──────────────────────────────────────────────────────────────────

  async post<T>(path: string, body: unknown): Promise<T> {
    const http = await this.instance();
    const res = await this.request(() => http.post<T>(path, body));
    return res.data;
  }

  async patch<T = unknown>(path: string, body: unknown): Promise<T> {
    const http = await this.instance();
    const res = await this.request(() => http.patch<T>(path, body));
    return res.data;
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async delete(path: string): Promise<void> {
    const http = await this.instance();
    await this.request(() => http.delete(path));
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async request<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await retry(fn, { attempts: 3, delayMs: 800, retryIf: isTransientHttpError });
    } catch (err: unknown) {
      throw DataverseError.fromRequest(err) ?? err;
    }
  }

  /**
   * Query solution component summaries filtered by component types.
   * When `solutionId` is provided, returns only components in that solution.
   * When `includeAllComponents` is true (with a solutionId), returns ALL
   * components ignoring the solution filter (useful for "show out-of-solution").
   * When `solutionId` is omitted, returns all components of the given types.
   *
   * Uses `msdyn_solutioncomponentsummaries` as the data source.
   * Solution membership and root behavior are handled by the framework
   * separately (via direct `solutioncomponents` queries on the context).
   */
  async getSolutionComponents(
    solutionId: string | undefined,
    componentTypes: number[],
    includeAllComponents = false,
    componentScope: "all" | "unmanaged" = "all",
  ): Promise<SolutionComponent[]> {
    const summaryTypeFilter = componentTypes.map((t) => `msdyn_componenttype eq ${t}`).join(" or ");
    const managedFilter = componentScope === "unmanaged" ? " and msdyn_ismanaged eq 'false'" : "";
    const extraFilters = this.getExtraFilters(componentTypes);
    const summaryQuery = solutionId && !includeAllComponents
      ? `$filter=msdyn_solutionid eq ${solutionId} and (${summaryTypeFilter})${managedFilter}${extraFilters}`
      : `$filter=(${summaryTypeFilter})${managedFilter}${extraFilters}`;

    type RawSummary = {
      msdyn_objectid: string;
      msdyn_componenttype: number;
      msdyn_name: string;
      msdyn_displayname: string | null;
      msdyn_schemaname: string | null;
      msdyn_ismanaged: string | null;
      msdyn_iscustom: string | null;
      msdyn_hasactivecustomization: string | null;
      msdyn_modifiedon: string | null;
      msdyn_createdon: string | null;
      msdyn_description: string | null;
      msdyn_uniquename: string | null;
      msdyn_status: number | null;
      msdyn_standardstatus: number | null;
      msdyn_subtype: number | null;
      msdyn_primaryentityname: string | null;
      msdyn_workflowcategory: number | null;
      [key: string]: unknown;
    };

    const selectFields = [
      "msdyn_objectid", "msdyn_componenttype", "msdyn_name", "msdyn_displayname",
      "msdyn_schemaname", "msdyn_ismanaged", "msdyn_iscustom", "msdyn_hasactivecustomization",
      "msdyn_modifiedon", "msdyn_createdon",
      ...this.getExtraSelectFields(componentTypes),
    ];

    const summaries = await this.getAll<RawSummary>(
      "msdyn_solutioncomponentsummaries",
      `${summaryQuery}&$select=${selectFields.join(",")}`,
    );

    return summaries.map((s) => ({
      componentType: s.msdyn_componenttype as SolutionComponentType,
      objectId: s.msdyn_objectid,
      name: s.msdyn_name,
      displayName: s.msdyn_displayname ?? undefined,
      schemaName: s.msdyn_schemaname ?? undefined,
      isManaged: s.msdyn_ismanaged === "true",
      isCustom: s.msdyn_iscustom === "true",
      hasActiveCustomization: s.msdyn_hasactivecustomization === "true" ? true : undefined,
      modifiedOn: s.msdyn_modifiedon ?? undefined,
      createdOn: s.msdyn_createdon ?? undefined,
      description: s.msdyn_description ?? undefined,
      uniqueName: s.msdyn_uniquename ?? undefined,
      status: s.msdyn_status ?? undefined,
      statusCode: s.msdyn_standardstatus ?? undefined,
      subType: s.msdyn_subtype ?? undefined,
      primaryEntityName: s.msdyn_primaryentityname ?? undefined,
      category: s.msdyn_workflowcategory ?? undefined,
    }));
  }

  private getExtraSelectFields(componentTypes: number[]): string[] {
    const fields: string[] = [];
    if (componentTypes.includes(SolutionComponentType.Workflow)) {
      fields.push(
        "msdyn_description", "msdyn_uniquename", "msdyn_status", "msdyn_standardstatus",
        "msdyn_subtype", "msdyn_primaryentityname", "msdyn_workflowcategory",
      );
    }
    return fields;
  }

  private getExtraFilters(componentTypes: number[]): string {
    const filters: string[] = [];
    if (componentTypes.includes(SolutionComponentType.Workflow)) {
      // Only return workflow definitions, not activations or templates
      filters.push("msdyn_subtype eq '1'");
    }
    return filters.length > 0 ? ` and ${filters.join(" and ")}` : "";
  }
}
