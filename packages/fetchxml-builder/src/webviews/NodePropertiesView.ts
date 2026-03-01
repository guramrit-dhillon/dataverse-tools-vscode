import type * as vscode from "vscode";
import { View, Views, DataverseWebApiClient, type ODataCollection } from "core-dataverse";
import { type FetchNode, DEFAULT_ATTRS } from "../model/FetchXmlNode";
import { type FetchXmlTreeProvider } from "../providers/FetchXmlTreeProvider";

export class NodePropertiesView extends View {
  static readonly viewType = Views.FetchXmlProperties;

  // ── Metadata cache (extension-side) ────────────────────────────────────────
  // Entities are fetched once and reused for any node. Typed attributes are
  // cached per entity logical-name. Both are invalidated on env change.
  #entityCache: string[] | null = null;
  #entityLoading: Promise<string[]> | null = null;
  #attributeCache = new Map<string, { name: string; type: string }[]>();
  #relationshipCache = new Map<string, RelationshipMeta[]>();
  #executing = false;

  constructor(
    extensionUri: vscode.Uri,
    private readonly treeProvider: FetchXmlTreeProvider,
    private readonly getClient: () => DataverseWebApiClient | undefined,
  ) {
    super(extensionUri, NodePropertiesView.viewType);

    this.initListeners({
      updateNode: this.handleUpdateNode.bind(this),
      loadEntities: this.handleLoadEntities.bind(this),
      loadAttributes: this.handleLoadAttributes.bind(this),
      loadFromAttributes: this.handleLoadFromAttributes.bind(this),
      loadLinkedEntities: this.handleLoadLinkedEntities.bind(this),
      loadRelationships: this.handleLoadRelationships.bind(this),
    });
  }

  /**
   * Push a node to the webview for display/editing.
   * Merges DEFAULT_ATTRS so the form always renders all fields for the kind,
   * even when the node was parsed from XML that omitted empty-string attrs.
   */
  showNode(node: FetchNode | null): void {
    if (node) {
      const defaults = DEFAULT_ATTRS[node.kind] ?? {};
      // Stamp context flags (prefixed with _ so they're stripped before XML commit).
      // _underLinkEntity tells the webview whether to show the entityname field.
      const contextFlags: Record<string, string> =
        node.kind === "condition"
          ? { _underLinkEntity: this.treeProvider.isUnderLinkEntity(node.id) ? "true" : "false" }
          : node.kind === "link-entity"
          ? { _parentEntity: this.treeProvider.getContainingEntityName(node.id) ?? "" }
          : {};
      const nodeWithDefaults: FetchNode = {
        ...node,
        attrs: { ...defaults, ...node.attrs, ...contextFlags },
      };
      this.setInitPayload(nodeWithDefaults);
    } else {
      this.setInitPayload(null);
    }
  }

  /**
   * Call when the active environment changes to invalidate cached metadata and
   * proactively push fresh entity names to the webview. This handles the race
   * where the webview's initial loadEntities request arrived before the service
   * was ready (e.g. view resolves during extension activation before setEnv runs).
   */
  notifyEnvChanged(): void {
    this.#entityCache = null;
    this.#entityLoading = null;
    this.#attributeCache.clear();
    this.#relationshipCache.clear();
    void this.#pushEntities();
  }

  /** Fetch entity names and proactively send result to the webview. */
  async #pushEntities(): Promise<void> {
    const names = await this.handleLoadEntities();
    // postMessage is a no-op when #view is not yet resolved — that's fine because
    // handleLoadEntities will be called again by the webview on mount with service ready.
    this.postMessage({ type: "loadEntities:response", payload: names });
  }

  /** Lock/unlock the form during query execution. Blocks writes and dims the UI. */
  setExecuting(executing: boolean): void {
    this.#executing = executing;
    this.postMessage({ type: "executing", payload: executing });
  }

  // ── Message handlers ───────────────────────────────────────────────────────

  private handleUpdateNode({
    id,
    attrs,
  }: {
    id: string;
    attrs: Record<string, string>;
  }): void {
    if (this.#executing) { return; } // silently block writes during execution
    this.treeProvider.updateNodeAttrs(id, attrs);
  }

  private async handleLoadEntities(): Promise<string[]> {
    const client = this.getClient();
    if (!client) { return []; }

    if (this.#entityCache) { return this.#entityCache; }

    if (!this.#entityLoading) {
      this.#entityLoading = client.get<ODataCollection<{ LogicalName: string }>>(
        "EntityDefinitions?$select=LogicalName"
      )
        .then((data) => {
          const names = data.value.map(e => e.LogicalName).sort((a, b) => a.localeCompare(b));
          this.#entityCache = names;
          this.#entityLoading = null;
          return names;
        })
        .catch(() => {
          this.#entityLoading = null;
          return [];
        });
    }
    return this.#entityLoading;
  }

  /**
   * Load attributes for the "to" field (parent entity) and for attribute/condition/order nodes.
   * Fallback uses getContainingEntityName — the nearest ancestor entity, never the node itself.
   */
  private async handleLoadAttributes({
    entityName,
    nodeId,
  }: {
    entityName: string;
    nodeId?: string;
  }): Promise<{ name: string; type: string }[]> {
    const resolvedName =
      entityName || (nodeId ? this.treeProvider.getContainingEntityName(nodeId) : undefined);
    return this.#fetchAttributes(resolvedName);
  }

  /**
   * Load attributes for the "from" field on link-entity nodes (the linked entity itself).
   * Fallback uses getParentEntityName — returns the node's own entity for link-entity nodes.
   */
  private async handleLoadFromAttributes({
    entityName,
    nodeId,
  }: {
    entityName: string;
    nodeId?: string;
  }): Promise<{ name: string; type: string }[]> {
    const resolvedName =
      entityName || (nodeId ? this.treeProvider.getParentEntityName(nodeId) : undefined);
    return this.#fetchAttributes(resolvedName);
  }

  async #fetchAttributes(entityName: string | undefined): Promise<{ name: string; type: string }[]> {
    const client = this.getClient();
    if (!client || !entityName) { return []; }

    const cached = this.#attributeCache.get(entityName);
    if (cached) { return cached; }

    const data = await client.get<ODataCollection<{ LogicalName: string; AttributeType: number }>>(
      `EntityDefinitions(LogicalName='${entityName.replace(/'/g, "''")}')/Attributes?$select=LogicalName,AttributeType`
    );
    const attrs = data.value
      .map(attr => ({ name: attr.LogicalName, type: attrTypeGroup(attr.AttributeType) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    this.#attributeCache.set(entityName, attrs);
    return attrs;
  }

  /** Returns alias/name of every link-entity in the tree (for entityname field). */
  private handleLoadLinkedEntities(): string[] {
    return this.treeProvider.getAllLinkedEntityNames();
  }

  /** Load all relationships for a given parent entity (cached per entity name). */
  private async handleLoadRelationships({
    parentEntity,
  }: {
    parentEntity: string;
  }): Promise<RelationshipMeta[]> {
    const client = this.getClient();
    if (!client || !parentEntity) { return []; }

    const cached = this.#relationshipCache.get(parentEntity);
    if (cached) { return cached; }

    const escaped = parentEntity.replace(/'/g, "''");
    const [o2m, m2o, m2m] = await Promise.all([
      client.get<ODataCollection<OneToManyRel>>(
        `EntityDefinitions(LogicalName='${escaped}')/OneToManyRelationships?$select=SchemaName,ReferencedAttribute,ReferencedEntity,ReferencingAttribute,ReferencingEntity`
      ),
      client.get<ODataCollection<OneToManyRel>>(
        `EntityDefinitions(LogicalName='${escaped}')/ManyToOneRelationships?$select=SchemaName,ReferencedAttribute,ReferencedEntity,ReferencingAttribute,ReferencingEntity`
      ),
      client.get<ODataCollection<ManyToManyRel>>(
        `EntityDefinitions(LogicalName='${escaped}')/ManyToManyRelationships?$select=SchemaName,Entity1LogicalName,Entity2LogicalName,Entity1IntersectAttribute,Entity2IntersectAttribute,IntersectEntityName`
      ),
    ]);

    const results: RelationshipMeta[] = [
      ...o2m.value.map(r => ({
        schemaName: r.SchemaName,
        type: "1:N" as const,
        relatedEntity: r.ReferencingEntity,
        fromAttribute: r.ReferencingAttribute,
        toAttribute: r.ReferencedAttribute,
        intersect: false,
      })),
      ...m2o.value.map(r => ({
        schemaName: r.SchemaName,
        type: "N:1" as const,
        relatedEntity: r.ReferencedEntity,
        fromAttribute: r.ReferencedAttribute,
        toAttribute: r.ReferencingAttribute,
        intersect: false,
      })),
      ...m2m.value.map(r => {
        const isEntity1 = r.Entity1LogicalName === parentEntity;
        return {
          schemaName: r.SchemaName,
          type: "N:N" as const,
          relatedEntity: r.IntersectEntityName,
          fromAttribute: isEntity1 ? r.Entity1IntersectAttribute : r.Entity2IntersectAttribute,
          toAttribute: parentEntity + "id",
          intersect: true,
        };
      }),
    ];

    this.#relationshipCache.set(parentEntity, results);
    return results;
  }
}

// ── Relationship types ────────────────────────────────────────────────────────

interface RelationshipMeta {
  schemaName: string;
  type: "1:N" | "N:1" | "N:N";
  relatedEntity: string;
  fromAttribute: string;
  toAttribute: string;
  intersect: boolean;
}

interface OneToManyRel {
  SchemaName: string;
  ReferencedAttribute: string;
  ReferencedEntity: string;
  ReferencingAttribute: string;
  ReferencingEntity: string;
}

interface ManyToManyRel {
  SchemaName: string;
  Entity1LogicalName: string;
  Entity2LogicalName: string;
  Entity1IntersectAttribute: string;
  Entity2IntersectAttribute: string;
  IntersectEntityName: string;
}

/** Maps a Dataverse AttributeTypeCode integer to a simplified type group. */
function attrTypeGroup(code: number): string {
  switch (code) {
    case 10: return "text";    // String
    case 7:  return "text";    // Memo
    case 16: return "text";    // EntityName
    case 2:  return "date";    // DateTime
    case 0:  return "bool";    // Boolean
    case 15: return "bool";    // ManagedProperty
    case 5:  return "number";  // Integer
    case 14: return "number";  // BigInt
    case 3:  return "number";  // Decimal
    case 4:  return "number";  // Double
    case 8:  return "number";  // Money
    case 6:  return "lookup";  // Lookup
    case 1:  return "lookup";  // Customer
    case 9:  return "lookup";  // Owner
    case 11: return "id";      // UniqueIdentifier
    case 18: return "set";     // Picklist
    case 19: return "set";     // State
    case 20: return "set";     // Status
    default: return "text";    // Virtual, CalendarRules, unknown
  }
}
