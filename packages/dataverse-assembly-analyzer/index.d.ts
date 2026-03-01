export interface AnalyzeOptions {
  /** Override the full binary path. */
  binaryPath?: string;
  /** Override the binary directory. */
  binDir?: string;
  /** Process timeout in ms. Default: 30000. */
  timeout?: number;
}

export interface AssemblyAnalysisResult {
  assemblyName: string;
  version: string;
  culture: string;
  publicKeyToken: string;
  filePath: string;
  fileHash: string;
  plugins: PluginTypeInfo[];
  analyzerVersion: string;
  analyzedAt: string;
}

export interface PluginTypeInfo {
  fullName: string;
  namespace: string;
  className: string;
  constructors: ConstructorInfo[];
  attributes: CustomAttributeInfo[];
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
  name: string | null;
  value: string | null;
}

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

export declare function analyze(
  assemblyPath: string,
  options?: AnalyzeOptions
): Promise<AssemblyAnalysisResult>;

export declare function getBinaryPath(
  options?: { binDir?: string }
): string;
