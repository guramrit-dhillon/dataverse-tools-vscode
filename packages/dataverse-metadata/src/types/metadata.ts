/**
 * Attribute metadata returned by the Dataverse Web API
 * `EntityDefinitions(LogicalName='{name}')/Attributes` endpoint.
 */

export interface EntityAttribute {
  MetadataId: string;
  LogicalName: string;
  DisplayName: {
    UserLocalizedLabel?: { Label: string };
    LocalizedLabels?: Array<{ Label: string; LanguageCode: number }>;
  };
  /** Coarse type, e.g. "String", "Integer", "Lookup". */
  AttributeType: string;
  /** More specific type, e.g. { Value: "StringType" }. */
  AttributeTypeName?: { Value: string };
  RequiredLevel?: { Value: "None" | "SystemRequired" | "ApplicationRequired" | "Recommended" };
  IsCustomAttribute: boolean;
  IsPrimaryId: boolean;
  IsPrimaryName: boolean;
}

/**
 * One-to-Many or Many-to-One relationship metadata.
 * Returned by `EntityDefinitions(LogicalName='{name}')/OneToManyRelationships`
 * and `/ManyToOneRelationships`.
 */
export interface LookupRelationship {
  MetadataId: string;
  SchemaName: string;
  /** The entity on the "one" side. */
  ReferencedEntity: string;
  /** The entity on the "many" side (holds the FK). */
  ReferencingEntity: string;
  /** The FK attribute on the referencing entity. */
  ReferencingAttribute: string;
  IsCustomRelationship: boolean;
}

/**
 * Many-to-Many relationship metadata.
 * Returned by `EntityDefinitions(LogicalName='{name}')/ManyToManyRelationships`.
 */
export interface IntersectRelationship {
  MetadataId: string;
  SchemaName: string;
  Entity1LogicalName: string;
  Entity2LogicalName: string;
  IsCustomRelationship: boolean;
}

/** Combined result from all three relationship endpoints. */
export interface EntityRelationships {
  oneToMany: LookupRelationship[];
  manyToOne: LookupRelationship[];
  manyToMany: IntersectRelationship[];
}

/**
 * Form record from the `systemforms` OData entity.
 * Form type codes: 2=Main, 5=Mobile Express, 6=Quick View, 7=Quick Create,
 * 8=Dashboard, 11=Dialog, 12=Power BI Dashboard.
 */
export interface EntityForm {
  formid: string;
  name: string;
  /** Numeric form type code. */
  type: number;
  ismanaged: boolean;
  description?: string;
}

/**
 * Extended form record including `formjson` — only populated by `getFormDetails`.
 */
export interface EntityFormDetails extends EntityForm {
  formjson?: string;
}

/**
 * Saved query (view) record from the `savedqueries` OData entity.
 * Query type codes: 0=Public View, 1=Advanced Find, 2=Associated,
 * 4=Quick Find, 64=Lookup.
 */
export interface EntityView {
  savedqueryid: string;
  name: string;
  /** Numeric query type code. */
  querytype: number;
  isdefault: boolean;
  ismanaged: boolean;
  description?: string;
  fetchxml?: string;    // populated by getViewDetails only
  layoutxml?: string;   // populated by getViewDetails only
}
