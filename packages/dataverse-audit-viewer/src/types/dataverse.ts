/**
 * Dataverse entity types specific to audit history viewing.
 * Aligned with the Web API OData schema — property names use Dataverse logical names.
 */

export interface AuditRecord {
  auditid: string;
  createdon: string;
  _objectid_value: string;
  objecttypecode: string;
  _userid_value: string;
  action: number;
  operation: number;
  /** OData annotation values (formatted values, lookup names, etc.) */
  [annotation: `${string}@${string}`]: string | undefined;
}

export interface AuditChangeDetail {
  auditid: string;
  createdon: string;
  userId: string;
  userDisplayName: string;
  operation: string;
  action: string;
  transactionId?: string;
  changes: AuditAttributeChange[];
}

export interface AuditAttributeChange {
  attributeName: string;
  displayName: string;
  oldValue: string | null;
  newValue: string | null;
}

export interface AuditFilter {
  entityLogicalName?: string;
  recordId?: string;
  maxCount?: number;
}

export interface OrgAuditStatus {
  orgId: string;
  isEnabled: boolean;
}

export interface EntityAuditStatus {
  metadataId: string;
  isEnabled: boolean;
}
