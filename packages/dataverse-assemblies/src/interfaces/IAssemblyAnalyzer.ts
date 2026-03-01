import { type AssemblyAnalysisResult, AnalyzerError } from "core-dataverse";

/**
 * Invokes the external .NET CLI analyzer tool and returns structured metadata.
 *
 * The implementation shells out to:
 *   dotnet <analyzerBin> --assembly <path> --json
 *
 * The analyzer runs out-of-process to avoid loading plugin DLLs into the
 * VS Code extension host, which could lock files or cause version conflicts.
 */
export interface IAssemblyAnalyzer {
  /**
   * Analyze a compiled .NET plugin assembly.
   *
   * @param assemblyPath  Absolute path to the .dll file.
   * @returns             Parsed metadata or throws AnalyzerError.
   */
  analyze(assemblyPath: string): Promise<AssemblyAnalysisResult>;

  /**
   * Locate the best candidate assembly in the workspace.
   * Searches common output paths: bin/Debug, bin/Release.
   * Returns undefined if no candidate is found.
   */
  findAssembly(workspaceFolderPath: string): Promise<string | undefined>;

  /**
   * Verify the analyzer binary is present and runnable.
   * Used at activation to surface config problems early.
   */
  isAvailable(): Promise<boolean>;
}
