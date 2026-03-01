import * as vscode from "vscode";
import type { NodeProvider } from "core-dataverse";

/**
 * Registry of {@link NodeProvider}s that contribute subtrees to the unified
 * explorer. Providers are sorted by `sortOrder` (ascending, default 100).
 */
export class ContributionRegistry {
  private readonly providers = new Map<string, NodeProvider>();
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  /** Register a provider. Returns a Disposable that unregisters it. */
  register(provider: NodeProvider): vscode.Disposable {
    if (this.providers.has(provider.id)) {
      throw new Error(`NodeProvider "${provider.id}" is already registered.`);
    }
    this.providers.set(provider.id, provider);
    this._onDidChange.fire();
    return new vscode.Disposable(() => {
      this.providers.delete(provider.id);
      this._onDidChange.fire();
    });
  }

  /** All registered providers, sorted by sortOrder (lower first). */
  getProviders(): NodeProvider[] {
    return [...this.providers.values()].sort(
      (a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100),
    );
  }

  /** Look up a provider by its ID. */
  getProvider(id: string): NodeProvider | undefined {
    return this.providers.get(id);
  }
}
