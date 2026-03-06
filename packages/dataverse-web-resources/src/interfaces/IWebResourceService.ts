import type { DataverseEnvironment } from "core-dataverse";

/**
 * Dataverse web resource type codes.
 * Values from the `webresourcetype` option set on the `webresourceset` entity.
 */
export const WebResourceType = {
  HTML: 1,
  CSS: 2,
  JScript: 3,
  XML: 4,
  PNG: 5,
  JPG: 6,
  GIF: 7,
  XAP: 8,
  XSL: 9,
  ICO: 10,
  SVG: 11,
  RESX: 12,
} as const;

export type WebResourceType = (typeof WebResourceType)[keyof typeof WebResourceType];

/** A Dataverse web resource record from `webresourceset`. */
export interface WebResource {
  readonly webresourceid: string;
  /** Path-like name, e.g. `prefix_/js/main.js` or `contoso_styles.css`. */
  readonly name: string;
  readonly displayname?: string;
  readonly webresourcetype: WebResourceType;
  readonly ismanaged?: boolean;
  readonly description?: string;
  readonly createdon?: string;
  readonly modifiedon?: string;
}

export interface IWebResourceService {
  /**
   * List web resources of the specified types.
   *
   * @param unmanagedOnly  When true, exclude managed components (default false).
   */
  listWebResources(
    env: DataverseEnvironment,
    types: WebResourceType[],
    unmanagedOnly?: boolean,
  ): Promise<WebResource[]>;

  /**
   * Fetch the base64-encoded content of a single web resource.
   * Only called on demand when the user opens a resource.
   */
  getContent(env: DataverseEnvironment, webResourceId: string): Promise<string | undefined>;

  /**
   * Push updated content back to Dataverse.
   * Called by the FileSystemProvider when the user saves (Ctrl+S).
   */
  updateContent(env: DataverseEnvironment, webResourceId: string, base64: string): Promise<void>;

  /**
   * Publish a web resource so changes are live in the application.
   * Calls the `PublishXml` Dataverse action.
   */
  publishWebResource(env: DataverseEnvironment, webResourceId: string): Promise<void>;
}
