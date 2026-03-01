import type * as vscode from "vscode";
import { type DataverseEnvironment } from "core-dataverse";

export interface IEnvironmentManager {
  getAll(): DataverseEnvironment[];
  save(environment: DataverseEnvironment): Promise<void>;
  remove(environmentId: string): Promise<void>;
  readonly onDidChange: vscode.Event<void>;
}
