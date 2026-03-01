import type * as vscode from "vscode";
import { type DataverseAccountApi } from "core-dataverse";
import { type IRegistrationService } from "../interfaces/IRegistrationService";
import { RegistrationService } from "../services/RegistrationService";
import { type IAssemblyAnalyzer } from "../interfaces/IAssemblyAnalyzer";
import { AssemblyAnalyzer } from "../services/AssemblyAnalyzer";
import { AssembliesNodeProvider } from "../providers/AssembliesNodeProvider";
import { MessagesNodeProvider } from "../providers/MessagesNodeProvider";

export class ServiceContainer {
  readonly analyzer: IAssemblyAnalyzer;
  readonly registrationService: IRegistrationService;
  readonly assembliesProvider: AssembliesNodeProvider;
  readonly messagesProvider: MessagesNodeProvider;

  constructor(api: DataverseAccountApi, context: vscode.ExtensionContext) {
    this.analyzer = new AssemblyAnalyzer();
    this.registrationService = new RegistrationService(api.getAccessToken.bind(api));
    this.assembliesProvider = new AssembliesNodeProvider(this.registrationService);
    this.messagesProvider = new MessagesNodeProvider(this.registrationService);
  }
}
