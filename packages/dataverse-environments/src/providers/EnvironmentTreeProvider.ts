import * as vscode from "vscode";
import { type IEnvironmentManager } from "../interfaces";
import { EnvironmentTreeItem } from "./EnvironmentTreeItem";

/**
 * Provides the "Environments" sidebar tree — a flat list of all configured
 * Dataverse environments with no lazy loading.
 */
export class EnvironmentTreeProvider
  implements vscode.TreeDataProvider<EnvironmentTreeItem>
{
  private readonly _onDidChangeTreeData =
    new vscode.EventEmitter<EnvironmentTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly envManager: IEnvironmentManager) {
    envManager.onDidChange(() => this._onDidChangeTreeData.fire());
  }

  getTreeItem(element: EnvironmentTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: EnvironmentTreeItem): EnvironmentTreeItem[] {
    if (element) { return []; }

    const environments = this.envManager.getAll();
    if (environments.length === 0) {
      return [EnvironmentTreeItem.empty("No environments configured. Click + to add one.")];
    }
    return environments.map(EnvironmentTreeItem.create);
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }
}
