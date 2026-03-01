import * as vscode from "vscode";
import { type IEnvironmentManager } from "../interfaces";
import { type DataverseEnvironment, Logger } from "core-dataverse";

const GLOBAL_KEY = "dataverse-tools.environments";

export class EnvironmentManager implements IEnvironmentManager {
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  constructor(private readonly globalState: vscode.Memento) {}

  getAll(): DataverseEnvironment[] {
    return this.globalState.get<DataverseEnvironment[]>(GLOBAL_KEY, []);
  }

  async save(environment: DataverseEnvironment): Promise<void> {
    const all = this.getAll();
    const idx = all.findIndex((e) => e.id === environment.id);
    if (idx >= 0) {
      all[idx] = environment;
      Logger.info("Environment updated", { name: environment.name });
    } else {
      all.push(environment);
      Logger.info("Environment added", { name: environment.name });
    }
    await this.globalState.update(GLOBAL_KEY, all);
    this._onDidChange.fire();
  }

  async remove(environmentId: string): Promise<void> {
    const all = this.getAll().filter((e) => e.id !== environmentId);
    await this.globalState.update(GLOBAL_KEY, all);
    Logger.info("Environment removed", { id: environmentId });
    this._onDidChange.fire();
  }
}
