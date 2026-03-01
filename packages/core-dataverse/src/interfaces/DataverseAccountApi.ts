import type * as vscode from "vscode";
import { type DataverseEnvironment, type DataverseSolution, type DetailItem } from "../types";
import { type DataverseExplorerApi } from "./DataverseExplorerApi";

/**
 * Public API exported by the `dataverse-environments` extension.
 *
 * Other extensions obtain this via:
 *   vscode.extensions.getExtension<DataverseAccountApi>(
 *     'gdhillon.dataverse-environments'
 *   )?.exports
 *
 * Token acquisition, environment management, and the explorer tree framework
 * are owned exclusively by `dataverse-environments`. All consumers are read-only.
 */
export interface DataverseAccountApi {
  /** Acquire a Dataverse bearer token for the given environment. */
  getAccessToken(env: DataverseEnvironment): Promise<string>;

  /** List all configured Dataverse environments. */
  getEnvironments(): DataverseEnvironment[];

  /** Fires whenever the environment list or active selection changes. */
  readonly onDidChangeEnvironments: vscode.Event<void>;

  /**
   * Open the shared environment (and optionally solution) picker.
   * Returns the user's selection, or undefined if cancelled.
   * Does NOT mutate global state — the caller owns its own context.
   */
  pickEnvironment(options?: { showSolutions?: boolean; activeEnvironmentId?: string }): Promise<EnvironmentSelection | undefined>;

  /**
   * Show an item in the shared Details panel.
   * Pass null to clear the panel (e.g. when selection is cleared).
   */
  showDetails(item: DetailItem | null): void;

  /**
   * Explorer tree framework API.
   * Extensions use this to register NodeProviders, query context, and refresh the tree.
   */
  readonly explorer: DataverseExplorerApi;
}

/** Result from `pickEnvironment()`. */
export interface EnvironmentSelection {
  environment: DataverseEnvironment;
  solution?: DataverseSolution;
}
