import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs/promises";
import { type IAssemblyAnalyzer } from "../interfaces/IAssemblyAnalyzer";
import { Logger } from "core-dataverse";
import type { AssemblyAnalysisResult, AnalyzerError } from "core-dataverse";
import analyzer from "dataverse-assembly-analyzer";

/**
 * Invokes the out-of-process .NET CLI analyzer tool via the
 * `dataverse-assembly-analyzer` npm package.
 *
 * Resolution order for the binary:
 *  1. User setting: dataverse-tools.analyzerPath (absolute path)
 *  2. Package default: resolved by the npm package
 */
export class AssemblyAnalyzer implements IAssemblyAnalyzer {
  async analyze(assemblyPath: string): Promise<AssemblyAnalysisResult> {
    const binaryPath = this.resolveAnalyzerBin();
    Logger.debug("Invoking analyzer", { assemblyPath, binaryPath: binaryPath ?? "(package default)" });

    try {
      const result = await analyzer.analyze(assemblyPath, { binaryPath });
      Logger.info("Assembly analyzed", {
        name: result.assemblyName,
        pluginCount: result.plugins.length,
      });
      return result;
    } catch (err) {
      const analyzerErr = err as AnalyzerError;
      Logger.error("Analyzer failed", err);
      throw analyzerErr;
    }
  }

  async findAssembly(workspaceFolderPath: string): Promise<string | undefined> {
    // Common .NET build output directories searched in priority order
    const searchRoots = [
      path.join(workspaceFolderPath, "bin", "Debug"),
      path.join(workspaceFolderPath, "bin", "Release"),
    ];

    for (const root of searchRoots) {
      const candidate = await this.findDllRecursive(root);
      if (candidate) {
        Logger.debug("Assembly located", { path: candidate });
        return candidate;
      }
    }
    return undefined;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const binaryPath = this.resolveAnalyzerBin();
      if (binaryPath) {
        await fs.access(binaryPath);
        return true;
      }
      // Let the package try its default resolution
      analyzer.getBinaryPath();
      return true;
    } catch {
      return false;
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private resolveAnalyzerBin(): string | undefined {
    const configured = vscode.workspace
      .getConfiguration("dataverse-tools")
      .get<string>("analyzerPath", "");

    if (configured) {
      return configured;
    }

    // Let the npm package resolve the binary via its default bin/ directory
    return undefined;
  }

  private async findDllRecursive(dir: string): Promise<string | undefined> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const found = await this.findDllRecursive(full);
          if (found) { return found; }
        } else if (
          entry.isFile() &&
          entry.name.endsWith(".dll") &&
          !entry.name.startsWith("Microsoft.") &&
          !entry.name.startsWith("System.")
        ) {
          return full;
        }
      }
    } catch {
      // Directory doesn't exist – silently skip
    }
    return undefined;
  }
}
