/**
 * Types produced by the .NET CLI analyzer tool.
 * These map directly to the JSON output of analyzer/Program.cs.
 */

export interface AssemblyAnalysisResult {
  assemblyName: string;
  version: string;
  culture: string;
  publicKeyToken: string;
  filePath: string;
  fileHash: string; // SHA-256 hex of the DLL bytes
  plugins: PluginTypeInfo[];
  analyzerVersion: string;
  analyzedAt: string; // ISO 8601
}

export interface PluginTypeInfo {
  fullName: string;      // Namespace.ClassName
  namespace: string;
  className: string;
  kind: "plugin" | "activity";
  constructors: ConstructorInfo[];
  attributes: CustomAttributeInfo[];
  // Populated if the type carries [CrmPluginRegistration] attributes
  registrationHints: RegistrationHint[];
}

export interface ConstructorInfo {
  parameters: ParameterInfo[];
}

export interface ParameterInfo {
  name: string;
  type: string;
}

export interface CustomAttributeInfo {
  typeName: string;
  arguments: AttributeArgumentInfo[];
}

export interface AttributeArgumentInfo {
  name: string | null; // null for positional args
  value: string | null;
}

/**
 * Derived from [CrmPluginRegistration(...)] attribute parsing.
 * Allows attribute-driven step registration in Phase 3.
 */
export interface RegistrationHint {
  messageName: string;
  primaryEntityName: string;
  stage: number;
  mode: number;
  rank: number;
  filteringAttributes?: string;
  unsecureConfig?: string;
  description?: string;
  images: ImageHint[];
}

export interface ImageHint {
  imageType: number;
  entityAlias: string;
  attributes?: string;
  messagePropertyName: string;
}

// ─── Analyzer invocation ────────────────────────────────────────────────────

export interface AnalyzerOptions {
  assemblyPath: string;
  /**
   * Absolute path to the analyzer binary.
   * Resolved by AssemblyAnalyzer from settings or bundled location.
   */
  analyzerBinPath: string;
}

export interface AnalyzerError {
  code: "NOT_FOUND" | "PARSE_FAILED" | "PROCESS_ERROR" | "TIMEOUT";
  message: string;
  detail?: string;
}
