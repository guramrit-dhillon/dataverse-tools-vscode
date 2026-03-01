import axios, { type AxiosInstance } from "axios";
import { type DataverseEnvironment, type ODataCollection } from "../types";
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
}
