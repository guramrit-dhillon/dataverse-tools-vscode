import {
  DataverseWebApiClient,
  type DataverseEnvironment,
  type ODataCollection,
} from "core-dataverse";
import type { AuditChangeDetail, AuditAttributeChange, AuditFilter } from "../types/dataverse";

interface EntityMetadata {
  LogicalName: string;
  DisplayName: { UserLocalizedLabel?: { Label: string } };
  EntitySetName: string;
}

interface EntityOption {
  logicalName: string;
  displayName: string;
}

/** Cached entity-set-name lookups per environment. */
const entitySetNameCache = new Map<string, Map<string, string>>();

export class AuditService {
  constructor(
    private readonly getToken: (env: DataverseEnvironment) => Promise<string>,
  ) {}

  private client(env: DataverseEnvironment): DataverseWebApiClient {
    return new DataverseWebApiClient(env, this.getToken);
  }

  /**
   * Returns entity logical names that have auditing enabled,
   * with their display names for the autocomplete picker.
   *
   * NOTE: EntityDefinitions does NOT support $orderby — we sort client-side.
   */
  async listAuditableEntities(env: DataverseEnvironment): Promise<EntityOption[]> {
    const data = await this.client(env).get<ODataCollection<EntityMetadata>>(
      "EntityDefinitions?$select=LogicalName,DisplayName,EntitySetName&$filter=IsAuditEnabled/Value eq true"
    );

    // Prime the entity-set-name cache while we have the data
    const cache = getOrCreateCache(env.id);
    for (const e of data.value) {
      cache.set(e.LogicalName, e.EntitySetName);
    }

    return data.value
      .map((e) => ({
        logicalName: e.LogicalName,
        displayName: e.DisplayName?.UserLocalizedLabel?.Label ?? e.LogicalName,
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  /**
   * Retrieves audit records for a specific record from the `audits` entity set.
   * Returns who made the change, when, and what operation — but NOT the field-level diffs.
   * Field-level diffs are fetched on demand via `getAuditDetails()`.
   */
  async getRecordAuditHistory(
    env: DataverseEnvironment,
    filter: AuditFilter,
  ): Promise<AuditChangeDetail[]> {
    const client = this.client(env);
    const maxCount = Math.min(filter.maxCount ?? 50, 500);

    const clauses: string[] = [];
    clauses.push(`_objectid_value eq '${filter.recordId}'`);
    if (filter.entityLogicalName) {
      clauses.push(`objecttypecode eq '${filter.entityLogicalName}'`);
    }

    const filterPart = clauses.length > 0 ? `&$filter=${clauses.join(" and ")}` : "";
    const query = `audits?$orderby=createdon desc&$top=${maxCount}${filterPart}`;

    const data = await client.get<ODataCollection<RawAuditRecord>>(query);

    return data.value.map((r) => ({
      auditid: r.auditid,
      createdon: r.createdon,
      userId: r._userid_value,
      userDisplayName: r["_userid_value@OData.Community.Display.V1.FormattedValue"] ?? r._userid_value,
      operation: r["operation@OData.Community.Display.V1.FormattedValue"] ?? String(r.operation),
      action: r["action@OData.Community.Display.V1.FormattedValue"] ?? String(r.action),
      transactionId: r.transactionid as string | undefined,
      changes: [],
    }));
  }

  /**
   * Retrieves the field-level change details (OldValue / NewValue) for a
   * single audit record using the `RetrieveAuditDetails` bound function.
   *
   * Per the docs, `RetrieveAuditDetails` is bound to the `audit` entity:
   *   GET audits(<auditid>)/Microsoft.Dynamics.CRM.RetrieveAuditDetails
   */
  async getAuditDetails(
    env: DataverseEnvironment,
    auditId: string,
  ): Promise<AuditAttributeChange[]> {
    const client = this.client(env);

    const data = await client.get<{ AuditDetail: RawAuditDetailResponse }>(
      `audits(${auditId})/Microsoft.Dynamics.CRM.RetrieveAuditDetails`
    );

    const detail = data.AuditDetail;
    if (!detail) { return []; }

    return this.parseAttributeAuditDetail(detail);
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private async resolveEntitySetName(env: DataverseEnvironment, logicalName: string): Promise<string> {
    const cache = getOrCreateCache(env.id);
    const cached = cache.get(logicalName);
    if (cached) { return cached; }

    const data = await this.client(env).get<{ EntitySetName: string }>(
      `EntityDefinitions(LogicalName='${logicalName}')?$select=EntitySetName`
    );
    cache.set(logicalName, data.EntitySetName);
    return data.EntitySetName;
  }

  /**
   * Parses the Web API AttributeAuditDetail response.
   *
   * The Web API returns OldValue/NewValue as entity objects where
   * properties are the attribute logical names and values are the raw values.
   * Formatted values appear as OData annotations (e.g.
   * `_ownerid_value@OData.Community.Display.V1.FormattedValue`).
   */
  private parseAttributeAuditDetail(detail: RawAuditDetailResponse): AuditAttributeChange[] {
    const changes: AuditAttributeChange[] = [];

    // Only AttributeAuditDetail has OldValue/NewValue
    if (detail["@odata.type"] && !detail["@odata.type"].includes("AttributeAuditDetail")) {
      // RelationshipAuditDetail, ShareAuditDetail, etc. — no field diffs
      return [];
    }

    const oldValue = detail.OldValue ?? {};
    const newValue = detail.NewValue ?? {};

    // Collect all attribute keys (skip @odata.type and annotation keys)
    const oldKeys = extractAttributeKeys(oldValue);
    const newKeys = extractAttributeKeys(newValue);
    const allKeys = new Set([...oldKeys, ...newKeys]);

    for (const key of allKeys) {
      // Use formatted value if available, otherwise raw value
      const formattedKey = `${key}@OData.Community.Display.V1.FormattedValue`;
      const oldFormatted = oldValue[formattedKey] as string | undefined;
      const newFormatted = newValue[formattedKey] as string | undefined;

      const oldVal = oldFormatted ?? formatRawValue(oldValue[key]);
      const newVal = newFormatted ?? formatRawValue(newValue[key]);

      changes.push({
        attributeName: key,
        displayName: key,
        oldValue: oldVal ?? null,
        newValue: newVal ?? null,
      });
    }

    // InvalidNewValueAttributes — attributes that were set but aren't readable
    if (detail.InvalidNewValueAttributes) {
      for (const attr of detail.InvalidNewValueAttributes) {
        if (!changes.some((c) => c.attributeName === attr)) {
          changes.push({
            attributeName: attr,
            displayName: attr,
            oldValue: null,
            newValue: "(value set)",
          });
        }
      }
    }

    return changes;
  }
}

// ── Raw API types ─────────────────────────────────────────────────────────

interface RawAuditRecord {
  auditid: string;
  createdon: string;
  _objectid_value: string;
  objecttypecode: string;
  _userid_value: string;
  action: number;
  operation: number;
  [annotation: `${string}@${string}`]: string | undefined;
  [key: string]: unknown;
}

/**
 * Shape returned by RetrieveAuditDetails bound function (Web API).
 * For AttributeAuditDetail, OldValue/NewValue are entity objects
 * with attribute logical names as properties.
 */
interface RawAuditDetailResponse {
  "@odata.type"?: string;
  OldValue?: Record<string, unknown>;
  NewValue?: Record<string, unknown>;
  InvalidNewValueAttributes?: string[];
  DeletedAttributes?: { Count: number; Keys: string[]; Values: unknown[] };
  // RelationshipAuditDetail fields
  RelationshipName?: string;
  TargetRecords?: Array<{ Name: string; Id: string }>;
  [key: string]: unknown;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function getOrCreateCache(envId: string): Map<string, string> {
  let cache = entitySetNameCache.get(envId);
  if (!cache) {
    cache = new Map();
    entitySetNameCache.set(envId, cache);
  }
  return cache;
}

/** Extract real attribute keys from an OData entity object, skipping annotations and @odata.type. */
function extractAttributeKeys(obj: Record<string, unknown>): string[] {
  return Object.keys(obj).filter((k) =>
    !k.startsWith("@") &&
    !k.includes("@") &&
    k !== "_transactioncurrencyid_value"
  );
}

function formatRawValue(value: unknown): string | undefined {
  if (value === null || value === undefined) { return undefined; }
  if (typeof value === "boolean") { return value ? "Yes" : "No"; }
  if (typeof value === "number") { return String(value); }
  if (typeof value === "string") { return value; }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}
