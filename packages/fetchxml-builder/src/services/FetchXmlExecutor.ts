import { DataverseWebApiClient, type DataverseEnvironment } from "core-dataverse";
import { type FetchNode } from "../model/FetchXmlNode";
import { serialize } from "../model/FetchXmlSerializer";
import { type QueryResults } from "../webviews/ResultsPanel";

interface EntityDefinition {
  EntitySetName: string;
  LogicalName: string;
}

interface AttributeMeta {
  LogicalName: string;
  DisplayName?: { UserLocalizedLabel?: { Label?: string } };
  AttributeType?: string;
}

/** Lookup-like attribute types whose OData column is _logicalname_value. */
const LOOKUP_TYPES = new Set(["Lookup", "Customer", "Owner"]);

/** Maps Dataverse AttributeType values to the column types used by the results viewer. */
const NUMBER_TYPES = new Set(["Integer", "BigInt", "Decimal", "Double", "Money"]);
const DATE_TYPES = new Set(["DateTime"]);

function mapColumnType(attrType: string | undefined): "text" | "number" | "date" {
  if (!attrType) { return "text"; }
  if (NUMBER_TYPES.has(attrType)) { return "number"; }
  if (DATE_TYPES.has(attrType)) { return "date"; }
  return "text";
}

/** Recursively collect every link-entity's { alias, entityName } from the fetch tree. */
function collectLinkEntities(
  node: FetchNode,
  out: { alias: string; entityName: string }[] = []
): { alias: string; entityName: string }[] {
  for (const child of node.children) {
    if (child.kind === "link-entity" && child.attrs.name) {
      // Alias defaults to the entity logical name when omitted.
      out.push({ alias: child.attrs.alias || child.attrs.name, entityName: child.attrs.name });
      collectLinkEntities(child, out);
    }
  }
  return out;
}

/**
 * Walk the FetchXML tree to derive OData column names in attribute declaration
 * order. Returns undefined when no explicit <attribute> nodes exist (all-attr fetch).
 *
 * Primary entity attributes:
 *   - plain field   → "fieldname"
 *   - lookup field  → "_fieldname_value"  (Dataverse OData convention)
 *
 * Linked entity attributes:
 *   - "alias_x002e_fieldname"
 *
 * Aggregate attributes with an alias use the alias as the column key.
 */
interface ColumnInfo {
  key: string;
  type: "text" | "number" | "date";
}

function collectTreeColumns(
  entityNode: FetchNode,
  entityAttrMap: Map<string, AttributeMeta[]>
): ColumnInfo[] | undefined {
  const cols = walkNodeColumns(entityNode, entityAttrMap, null, entityNode.attrs.name);
  return cols.length > 0 ? cols : undefined;
}

function walkNodeColumns(
  node: FetchNode,
  entityAttrMap: Map<string, AttributeMeta[]>,
  linkAlias: string | null,
  entityName: string
): ColumnInfo[] {
  const cols: ColumnInfo[] = [];
  for (const child of node.children) {
    if (child.kind === "attribute" && child.attrs.name) {
      const attrName = child.attrs.name;
      const meta = entityAttrMap.get(entityName)?.find((m) => m.LogicalName === attrName);
      const type = mapColumnType(meta?.AttributeType);
      // Aggregate attributes with an alias are returned under that alias.
      if (child.attrs.aggregate && child.attrs.alias) {
        const key = linkAlias ? `${linkAlias}_x002e_${child.attrs.alias}` : child.attrs.alias;
        cols.push({ key, type: "number" }); // aggregates are always numeric
      } else if (linkAlias !== null) {
        cols.push({ key: `${linkAlias}_x002e_${attrName}`, type });
      } else {
        const isLookup = LOOKUP_TYPES.has(meta?.AttributeType ?? "");
        cols.push({ key: isLookup ? `_${attrName}_value` : attrName, type: isLookup ? "text" : type });
      }
    } else if (child.kind === "link-entity" && child.attrs.name) {
      const alias = child.attrs.alias || child.attrs.name;
      cols.push(...walkNodeColumns(child, entityAttrMap, alias, child.attrs.name));
    }
  }
  return cols;
}

export class FetchXmlExecutor {
  constructor(
    private readonly getToken: (env: DataverseEnvironment) => Promise<string>
  ) {}

  async execute(env: DataverseEnvironment, root: FetchNode): Promise<QueryResults> {
    const start = Date.now();
    const entityNode = root.children.find((c) => c.kind === "entity");
    if (!entityNode || !entityNode.attrs.name) {
      throw new Error(
        "No entity defined. Add an entity node with a name before executing."
      );
    }

    const fetchXml = serialize(root);
    const client = new DataverseWebApiClient(env, this.getToken);

    // Always request FormattedValue annotations for friendly cell values.
    // Optionally also request totalrecordcount.
    const wantCount = root.attrs.returntotalrecordcount === "true";
    const annotations = wantCount
      ? `odata.include-annotations="OData.Community.Display.V1.FormattedValue,Microsoft.Dynamics.CRM.totalrecordcount"`
      : `odata.include-annotations="OData.Community.Display.V1.FormattedValue"`;
    const extraHeaders: Record<string, string> = { Prefer: annotations };

    // Collect link-entity aliases and unique entity names to fetch metadata for.
    const linkEntities = collectLinkEntities(root);
    const linkedEntityNames = [...new Set(linkEntities.map((l) => l.entityName))];

    // Batch 1: entity set name lookup + all attribute metadata in parallel.
    // The data query depends on entitySetName so it runs after this batch.
    const [defs, primaryAttrMetas, ...linkedAttrMetasAll] = await Promise.all([
      client.getAll<EntityDefinition>(
        "EntityDefinitions",
        `$filter=LogicalName eq '${entityNode.attrs.name}'&$select=EntitySetName,LogicalName`
      ),
      client.getAll<AttributeMeta>(
        `EntityDefinitions(LogicalName='${entityNode.attrs.name}')/Attributes`,
        `$select=LogicalName,DisplayName,AttributeType`
      ).catch(() => [] as AttributeMeta[]),
      ...linkedEntityNames.map((name) =>
        client.getAll<AttributeMeta>(
          `EntityDefinitions(LogicalName='${name}')/Attributes`,
          `$select=LogicalName,DisplayName,AttributeType`
        ).catch(() => [] as AttributeMeta[])
      ),
    ]);

    if (defs.length === 0) {
      throw new Error(
        `Entity '${entityNode.attrs.name}' was not found in this environment.`
      );
    }
    const entitySetName = defs[0].EntitySetName;

    // Build entity name → attribute metadata map (needed for column detection).
    const entityAttrMap = new Map<string, AttributeMeta[]>();
    entityAttrMap.set(entityNode.attrs.name, primaryAttrMetas);
    linkedEntityNames.forEach((name, i) => entityAttrMap.set(name, linkedAttrMetasAll[i]));

    // Derive column order from the FetchXML tree — gives stable ordering and
    // guarantees columns appear even when all rows have null for a field.
    // Falls back to row-based extraction for all-attribute queries (no explicit attrs).
    const treeColumnInfos = collectTreeColumns(entityNode, entityAttrMap);

    // Batch 2: execute the FetchXML query.
    const encoded = encodeURIComponent(fetchXml);
    const url = `${entitySetName}?fetchXml=${encoded}`;
    const response = await client.get<{
      value: Record<string, unknown>[];
      "@Microsoft.Dynamics.CRM.totalrecordcount"?: number;
    }>(url, extraHeaders);

    const rows = response.value;

    // Merge tree-derived columns with any row-based columns Dataverse returned that
    // weren't predicted (e.g. lookup variants we couldn't detect without all metadata).
    const treeKeys = treeColumnInfos?.map((c) => c.key);
    const rowColumns =
      rows.length > 0 ? Object.keys(rows[0]).filter((k) => !k.includes("@")) : [];
    const treeSet = new Set(treeKeys ?? []);
    const extraRowColumns = rowColumns.filter((k) => !treeSet.has(k));
    const columns = treeKeys
      ? [...treeKeys, ...extraRowColumns]
      : rowColumns;

    // Build columnTypes map. When explicit <attribute> nodes exist, use the
    // tree-derived info. For all-attribute queries (no explicit attrs), infer
    // types by matching response columns against the primary entity metadata.
    const columnTypes: Record<string, "text" | "number" | "date"> = {};
    if (treeColumnInfos) {
      for (const info of treeColumnInfos) {
        if (info.type !== "text") {
          columnTypes[info.key] = info.type;
        }
      }
    } else {
      // All-attribute query — match row columns to metadata by logical name.
      for (const col of columns) {
        // Lookup columns: _logicalname_value → strip to logicalname
        const logicalName = col.startsWith("_") && col.endsWith("_value")
          ? col.slice(1, -6)
          : col;
        const meta = primaryAttrMetas.find((m) => m.LogicalName === logicalName);
        const type = mapColumnType(meta?.AttributeType);
        if (type !== "text") {
          columnTypes[col] = type;
        }
      }
    }

    // Build friendlyNames keyed by OData column name so the results view can do
    // a direct lookup without any string manipulation.
    //
    // Primary entity attributes:
    //   - "name"           → "Account Name"
    //   - "_ownerid_value" → "Owner"   (Dataverse lookup column convention)
    //
    // Linked entity attributes (per alias):
    //   - "c_x002e_fullname" → "Full Name"  (alias "c", entity "contact")
    const friendlyNames: Record<string, string> = {};

    for (const attr of primaryAttrMetas) {
      const label = attr.DisplayName?.UserLocalizedLabel?.Label;
      if (label && label !== attr.LogicalName) {
        friendlyNames[attr.LogicalName] = label;
        friendlyNames[`_${attr.LogicalName}_value`] = label; // lookup column variant
      }
    }

    for (const { alias, entityName } of linkEntities) {
      const attrs = entityAttrMap.get(entityName) ?? [];
      for (const attr of attrs) {
        const label = attr.DisplayName?.UserLocalizedLabel?.Label;
        if (label && label !== attr.LogicalName) {
          friendlyNames[`${alias}_x002e_${attr.LogicalName}`] = label;
        }
      }
    }

    return {
      fetchXml,
      columns,
      rows,
      totalCount: response["@Microsoft.Dynamics.CRM.totalrecordcount"],
      durationMs: Date.now() - start,
      friendlyNames: Object.keys(friendlyNames).length > 0 ? friendlyNames : undefined,
      columnTypes: Object.keys(columnTypes).length > 0 ? columnTypes : undefined,
    };
  }
}
