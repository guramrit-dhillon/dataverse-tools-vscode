export interface DataverseEntity {
  MetadataId: string;
  LogicalName: string;
  /** Flattened from DisplayName.UserLocalizedLabel.Label */
  DisplayName: string;
  IsManaged: boolean;
  IsCustomEntity: boolean;
}

export interface DataverseSolution {
  solutionid: string;
  uniquename: string;
  friendlyname: string;
  ismanaged: boolean;
}
