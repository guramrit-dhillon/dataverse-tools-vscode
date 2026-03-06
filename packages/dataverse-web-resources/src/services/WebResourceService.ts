import { DataverseWebApiClient, type DataverseEnvironment } from "core-dataverse";
import type { IWebResourceService, WebResource, WebResourceType } from "../interfaces/IWebResourceService";

const SELECT = "$select=webresourceid,name,displayname,webresourcetype,ismanaged,description,createdon,modifiedon";

export class WebResourceService implements IWebResourceService {
  constructor(private readonly getToken: (env: DataverseEnvironment) => Promise<string>) {}

  private client(env: DataverseEnvironment): DataverseWebApiClient {
    return new DataverseWebApiClient(env, this.getToken);
  }

  async listWebResources(
    env: DataverseEnvironment,
    types: WebResourceType[],
    unmanagedOnly = false,
  ): Promise<WebResource[]> {
    const typeClause = types.length === 1
      ? `webresourcetype eq ${types[0]}`
      : `(${types.map((t) => `webresourcetype eq ${t}`).join(" or ")})`;

    const filter = unmanagedOnly ? `${typeClause} and ismanaged eq false` : typeClause;
    const query = `${SELECT}&$filter=${filter}&$orderby=name`;

    return this.client(env).getAll<WebResource>("webresourceset", query);
  }

  async getContent(
    env: DataverseEnvironment,
    webResourceId: string,
  ): Promise<string | undefined> {
    const record = await this.client(env).get<{ content?: string }>(
      `webresourceset(${webResourceId})?$select=content`,
    );
    return record.content;
  }

  async updateContent(
    env: DataverseEnvironment,
    webResourceId: string,
    base64: string,
  ): Promise<void> {
    await this.client(env).patch(`webresourceset(${webResourceId})`, { content: base64 });
  }

  async publishWebResource(env: DataverseEnvironment, webResourceId: string): Promise<void> {
    const xml = `<importexportxml><webresources><webresource>${webResourceId}</webresource></webresources></importexportxml>`;
    await this.client(env).post("PublishXml", { ParameterXml: xml });
  }
}
