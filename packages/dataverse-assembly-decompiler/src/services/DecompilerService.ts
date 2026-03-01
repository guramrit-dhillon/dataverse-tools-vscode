import * as vscode from "vscode";
import { Logger } from "core-dataverse";
import { createDecompiler } from "assembly-decompiler";
import type {
  Decompiler,
  DecompiledAssembly,
  TypeListEntry
} from "assembly-decompiler";

// ─── Re-exported types ───────────────────────────────────────────────────────

export type { TypeListEntry } from "assembly-decompiler";

export interface LoadAssemblyResult {
  assemblyId: string;
  namespaces: string[];
  typeCount: number;
}

// ─── VS Code wrapper ────────────────────────────────────────────────────────

/**
 * Thin wrapper around the `assembly-decompiler` npm package.
 * Reads VS Code settings and delegates to the standalone decompiler.
 * Stores loaded DecompiledAssembly instances and delegates calls through them.
 */
export class DecompilerService implements vscode.Disposable {
  private backend: Decompiler | null = null;
  private assemblies = new Map<string, DecompiledAssembly>();

  constructor(private readonly extensionPath: string) {}

  private ensureBackend(): Decompiler {
    if (this.backend) {
      return this.backend;
    }

    const config = vscode.workspace.getConfiguration("dataverse-tools.decompiler");
    const binaryPath = config.get<string>("backendPath", "") || undefined;
    const idleTimeoutMs = config.get<number>("idleTimeoutMs", 300_000);

    this.backend = createDecompiler({
      binaryPath,
      idleTimeoutMs,
      logger: (level, message, data?: any) => {
        switch (level) {
        case "error": Logger.error(message, data); break;
        case "warn": Logger.warn(message, data); break;
        case "debug": Logger.debug(message, data); break;
        default: Logger.info(message, data);
        }
      },
    });

    return this.backend;
  }

  private getAssembly(assemblyId: string): DecompiledAssembly {
    const assembly = this.assemblies.get(assemblyId);
    if (!assembly) {
      throw new Error(`Assembly "${assemblyId}" is not loaded. Call loadAssembly() first.`);
    }
    return assembly;
  }

  // ── Public API ───────────────────────────────────────────────────────────

  async loadAssembly(assemblyId: string, base64Content: string): Promise<LoadAssemblyResult> {
    const assembly = await this.ensureBackend().loadAssembly(assemblyId, base64Content);
    this.assemblies.set(assemblyId, assembly);
    return {
      assemblyId: assembly.assemblyId,
      namespaces: assembly.namespaces,
      typeCount: assembly.typeCount,
    };
  }

  async listNamespaces(assemblyId: string): Promise<string[]> {
    return this.getAssembly(assemblyId).listNamespaces();
  }

  async listTypes(assemblyId: string, ns: string): Promise<TypeListEntry[]> {
    return this.getAssembly(assemblyId).listTypes(ns);
  }

  async decompileType(assemblyId: string, typeFullName: string): Promise<string> {
    return this.getAssembly(assemblyId).decompileType(typeFullName);
  }

  async shutdown(): Promise<void> {
    if (this.backend) {
      this.assemblies.clear();
      await this.backend.shutdown();
    }
  }

  dispose(): void {
    if (this.backend) {
      this.assemblies.clear();
      this.backend.dispose();
      this.backend = null;
    }
  }
}
