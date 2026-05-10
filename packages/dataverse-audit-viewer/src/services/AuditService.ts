import {
  DataverseWebApiClient,
  type DataverseEnvironment,
  type ODataCollection,
} from "core-dataverse";
import type { AuditChangeDetail, AuditAttributeChange, AuditFilter, OrgAuditStatus, EntityAuditStatus, EntityWithAuditStatus, AttributeWithAuditStatus } from "../types/dataverse";

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
/** Cached primary-id attribute lookups per environment. */
const primaryIdAttributeCache = new Map<string, Map<string, string>>();

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
   * Retrieves audit records, including inline field-level changes.
   *
   * Two paths:
   *  - When both `recordId` and `entityLogicalName` are set, calls
   *    `RetrieveRecordChangeHistory(EntityMoniker)` — one request that returns
   *    every audit detail with formatted lookup/optionset values.
   *  - Otherwise queries `audits` directly with `$select=...,changedata` and
   *    parses the JSON client-side. Values are raw (GUIDs/integers) — the
   *    detail panel still resolves formatted values via `getAuditDetails()`.
   */
  async getRecordAuditHistory(
    env: DataverseEnvironment,
    filter: AuditFilter,
  ): Promise<AuditChangeDetail[]> {
    const maxCount = Math.min(filter.maxCount ?? 50, 500);

    if (filter.recordId && filter.entityLogicalName) {
      return this.getRecordAuditHistoryViaChangeHistory(env, filter.entityLogicalName, filter.recordId, maxCount);
    }
    return this.getRecordAuditHistoryViaList(env, filter, maxCount);
  }

  private async getRecordAuditHistoryViaList(
    env: DataverseEnvironment,
    filter: AuditFilter,
    maxCount: number,
  ): Promise<AuditChangeDetail[]> {
    const client = this.client(env);

    const clauses: string[] = [];
    if (filter.recordId) {
      clauses.push(`_objectid_value eq '${filter.recordId}'`);
    }
    if (filter.entityLogicalName) {
      clauses.push(`objecttypecode eq '${filter.entityLogicalName}'`);
    }

    const filterPart = clauses.length > 0 ? `&$filter=${clauses.join(" and ")}` : "";
    const select = "$select=auditid,createdon,_userid_value,_objectid_value,objecttypecode,action,operation,transactionid,changedata";
    const query = `audits?${select}&$orderby=createdon desc&$top=${maxCount}${filterPart}`;

    const data = await client.get<ODataCollection<RawAuditRecord>>(query);

    return data.value.map((r) => ({
      auditid: r.auditid,
      createdon: r.createdon,
      userId: r._userid_value,
      userDisplayName: r["_userid_value@OData.Community.Display.V1.FormattedValue"] ?? r._userid_value,
      operation: r["operation@OData.Community.Display.V1.FormattedValue"] ?? String(r.operation),
      action: r["action@OData.Community.Display.V1.FormattedValue"] ?? String(r.action),
      transactionId: r.transactionid as string | undefined,
      changes: parseChangeDataJson(r.changedata as string | null | undefined),
    }));
  }

  private async getRecordAuditHistoryViaChangeHistory(
    env: DataverseEnvironment,
    entityLogicalName: string,
    recordId: string,
    maxCount: number,
  ): Promise<AuditChangeDetail[]> {
    const client = this.client(env);

    // EntityMoniker requires the primary-key attribute name (e.g. contactid for contact).
    const primaryIdAttribute = await this.resolvePrimaryIdAttribute(env, entityLogicalName);
    const moniker = {
      "@odata.type": `Microsoft.Dynamics.CRM.${entityLogicalName}`,
      [primaryIdAttribute]: recordId,
    };
    const param = encodeURIComponent(JSON.stringify(moniker));
    const url = `RetrieveRecordChangeHistory(Target=@p1)?@p1=${param}`;

    const data = await client.get<{
      AuditDetailCollection: { AuditDetails: RawAuditDetailWithRecord[] };
    }>(url);

    const details = data.AuditDetailCollection?.AuditDetails ?? [];
    return details.slice(0, maxCount).map((d) => {
      const record = d.AuditRecord ?? {} as RawAuditRecord;
      return {
        auditid: record.auditid,
        createdon: record.createdon,
        userId: record._userid_value,
        userDisplayName: record["_userid_value@OData.Community.Display.V1.FormattedValue"] ?? record._userid_value,
        operation: record["operation@OData.Community.Display.V1.FormattedValue"] ?? String(record.operation),
        action: record["action@OData.Community.Display.V1.FormattedValue"] ?? String(record.action),
        transactionId: record.transactionid as string | undefined,
        changes: this.parseAttributeAuditDetail(d),
      };
    });
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

  /** Returns the organization's audit enablement status and its record ID. */
  async getOrgAuditStatus(env: DataverseEnvironment): Promise<OrgAuditStatus> {
    const data = await this.client(env).get<ODataCollection<{ organizationid: string; isauditenabled: boolean; isuseraccessauditenabled: boolean }>>(
      "organizations?$select=organizationid,isauditenabled,isuseraccessauditenabled"
    );
    const org = data.value[0];
    return { orgId: org.organizationid, isEnabled: org.isauditenabled, isUserAccessAuditEnabled: org.isuseraccessauditenabled };
  }

  /** Enables or disables auditing at the organization level. */
  async setOrgAuditStatus(env: DataverseEnvironment, orgId: string, isEnabled: boolean): Promise<void> {
    await this.client(env).patch(`organizations(${orgId})`, { isauditenabled: isEnabled });
  }

  /** Enables or disables user access auditing at the organization level. */
  async setUserAccessAuditStatus(env: DataverseEnvironment, orgId: string, isEnabled: boolean): Promise<void> {
    await this.client(env).patch(`organizations(${orgId})`, { isuseraccessauditenabled: isEnabled });
  }

  /**
   * Returns all entities with their audit enablement status.
   * Sorted by display name; includes both enabled and disabled entities.
   *
   * NOTE: EntityDefinitions does NOT support $orderby — we sort client-side.
   */
  async listAllEntitiesWithAuditStatus(env: DataverseEnvironment): Promise<EntityWithAuditStatus[]> {
    const data = await this.client(env).get<ODataCollection<{
      MetadataId: string;
      LogicalName: string;
      DisplayName: { UserLocalizedLabel?: { Label: string } };
      EntitySetName: string;
      IsAuditEnabled: { Value: boolean };
    }>>(
      "EntityDefinitions?$select=MetadataId,LogicalName,DisplayName,EntitySetName,IsAuditEnabled"
    );

    // Prime the entity-set-name cache while we have the data
    const cache = getOrCreateCache(env.id);
    for (const e of data.value) {
      cache.set(e.LogicalName, e.EntitySetName);
    }

    return data.value
      .map((e) => ({
        metadataId: e.MetadataId,
        logicalName: e.LogicalName,
        displayName: e.DisplayName?.UserLocalizedLabel?.Label ?? e.LogicalName,
        isAuditEnabled: e.IsAuditEnabled.Value,
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  /** Returns the audit enablement status for a specific entity. */
  async getEntityAuditStatus(env: DataverseEnvironment, entityLogicalName: string): Promise<EntityAuditStatus> {
    const data = await this.client(env).get<{ MetadataId: string; IsAuditEnabled: { Value: boolean } }>(
      `EntityDefinitions(LogicalName='${entityLogicalName}')?$select=MetadataId,IsAuditEnabled`
    );
    return { metadataId: data.MetadataId, isEnabled: data.IsAuditEnabled.Value };
  }

  /**
   * Enables or disables auditing for a specific entity, then publishes the change.
   * Uses MSCRM.MergeLabels to avoid resetting display name labels.
   */
  async setEntityAuditStatus(
    env: DataverseEnvironment,
    metadataId: string,
    entityLogicalName: string,
    isEnabled: boolean,
  ): Promise<void> {
    await this.client(env).patch(
      `EntityDefinitions(${metadataId})`,
      {
        "@odata.type": "Microsoft.Dynamics.CRM.EntityMetadata",
        IsAuditEnabled: { Value: isEnabled },
      },
      { "MSCRM.MergeLabels": "true" },
    );
    // Publish the metadata change
    await this.client(env).post("PublishXml", {
      ParameterXml: `<importexportxml><entities><entity>${entityLogicalName}</entity></entities></importexportxml>`,
    });
  }

  /**
   * Returns all attributes for an entity with their audit enablement status.
   * Excludes Virtual attributes and attributes whose audit setting cannot be changed.
   * Sorted by display name.
   */
  async listAttributesWithAuditStatus(
    env: DataverseEnvironment,
    entityLogicalName: string,
  ): Promise<AttributeWithAuditStatus[]> {
    const data = await this.client(env).get<ODataCollection<RawAttributeMetadata>>(
      `EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes` +
      `?$select=MetadataId,LogicalName,DisplayName,AttributeType,IsAuditEnabled` +
      `&$filter=AttributeType ne 'Virtual' and AttributeType ne 'EntityName'`
    );

    return data.value
      .map((a) => ({
        metadataId: a.MetadataId,
        logicalName: a.LogicalName,
        displayName: a.DisplayName?.UserLocalizedLabel?.Label ?? a.LogicalName,
        attributeType: a.AttributeType,
        odataType: a["@odata.type"] ?? "Microsoft.Dynamics.CRM.AttributeMetadata",
        isAuditEnabled: a.IsAuditEnabled.Value,
        canBeChanged: a.IsAuditEnabled.CanBeChanged,
      }))
      .filter((a) => a.canBeChanged)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  /**
   * Applies audit status changes to a batch of attributes for one entity,
   * then publishes once at the end.
   */
  async setAttributesAuditStatus(
    env: DataverseEnvironment,
    entityMetadataId: string,
    entityLogicalName: string,
    changes: Array<{ attribute: AttributeWithAuditStatus; isEnabled: boolean }>,
  ): Promise<{ errors: string[] }> {
    const errors: string[] = [];

    for (const { attribute, isEnabled } of changes) {
      try {
        await this.client(env).patch(
          `EntityDefinitions(${entityMetadataId})/Attributes(${attribute.metadataId})`,
          {
            "@odata.type": attribute.odataType,
            IsAuditEnabled: { Value: isEnabled },
          },
          { "MSCRM.MergeLabels": "true" },
        );
      } catch (err) {
        errors.push(`${attribute.displayName}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Publish once for the whole entity
    if (errors.length < changes.length) {
      try {
        await this.client(env).post("PublishXml", {
          ParameterXml: `<importexportxml><entities><entity>${entityLogicalName}</entity></entities></importexportxml>`,
        });
      } catch (err) {
        errors.push(`Publish: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return { errors };
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

  private async resolvePrimaryIdAttribute(env: DataverseEnvironment, logicalName: string): Promise<string> {
    const cache = getOrCreatePrimaryIdCache(env.id);
    const cached = cache.get(logicalName);
    if (cached) { return cached; }

    const data = await this.client(env).get<{ PrimaryIdAttribute: string }>(
      `EntityDefinitions(LogicalName='${logicalName}')?$select=PrimaryIdAttribute`
    );
    cache.set(logicalName, data.PrimaryIdAttribute);
    return data.PrimaryIdAttribute;
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

// ── Raw API types ──────────────────────────────────────────────────────────

interface RawAttributeMetadata {
  "@odata.type": string;
  MetadataId: string;
  LogicalName: string;
  DisplayName: { UserLocalizedLabel?: { Label: string } };
  AttributeType: string;
  IsAuditEnabled: { Value: boolean; CanBeChanged: boolean };
}


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

/** Shape returned per-detail from RetrieveRecordChangeHistory — extends the
 *  detail response with the parent AuditRecord. */
interface RawAuditDetailWithRecord extends RawAuditDetailResponse {
  AuditRecord?: RawAuditRecord;
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

function getOrCreatePrimaryIdCache(envId: string): Map<string, string> {
  let cache = primaryIdAttributeCache.get(envId);
  if (!cache) {
    cache = new Map();
    primaryIdAttributeCache.set(envId, cache);
  }
  return cache;
}

/**
 * Parses the `changedata` JSON column on an audit row.
 * Modern Dataverse shape:
 *   { "changedAttributes": [{ "logicalName": "name", "oldValue": "...", "newValue": "..." }] }
 * Older or alternate shapes (`attributes`, `Changes`) are handled defensively.
 */
function parseChangeDataJson(raw: string | null | undefined): AuditAttributeChange[] {
  if (!raw) { return []; }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== "object") { return []; }
  const obj = parsed as Record<string, unknown>;
  const arr =
    (Array.isArray(obj.changedAttributes) && obj.changedAttributes) ||
    (Array.isArray(obj.attributes) && obj.attributes) ||
    (Array.isArray(obj.Changes) && obj.Changes) ||
    [];
  const out: AuditAttributeChange[] = [];
  for (const item of arr as Array<Record<string, unknown>>) {
    const logicalName =
      (item.logicalName as string | undefined) ??
      (item.LogicalName as string | undefined) ??
      (item.attributeName as string | undefined);
    if (!logicalName) { continue; }
    const oldRaw = item.oldValue ?? item.OldValue ?? null;
    const newRaw = item.newValue ?? item.NewValue ?? null;
    out.push({
      attributeName: logicalName,
      displayName: logicalName,
      oldValue: oldRaw === null || oldRaw === undefined ? null : formatRawValue(oldRaw) ?? null,
      newValue: newRaw === null || newRaw === undefined ? null : formatRawValue(newRaw) ?? null,
    });
  }
  return out;
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
