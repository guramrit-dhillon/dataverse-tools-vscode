export interface DecompilerOptions {
  /** Override the full binary path. */
  binaryPath?: string;
  /** Override the binary directory. */
  binDir?: string;
  /** Idle timeout before auto-shutdown (ms). Default: 300000. */
  idleTimeoutMs?: number;
  /** Per-request timeout (ms). Default: 30000. */
  requestTimeout?: number;
  /** Optional log function. */
  logger?: (level: string, message: string, data?: unknown) => void;
}

export interface TypeListEntry {
  fullName: string;
  name: string;
  kind: string;
}

export declare class DecompiledAssembly {
  readonly assemblyId: string;
  readonly namespaces: string[];
  readonly typeCount: number;

  listNamespaces(): Promise<string[]>;
  listTypes(namespace: string): Promise<TypeListEntry[]>;
  decompileType(typeFullName: string): Promise<string>;
}

export declare class Decompiler {
  constructor(options?: DecompilerOptions);
  loadAssembly(assemblyId: string, base64Content: string): Promise<DecompiledAssembly>;
  shutdown(): Promise<void>;
  dispose(): void;
}

export declare function createDecompiler(options?: DecompilerOptions): Decompiler;

export declare function getBinaryPath(
  options?: { binDir?: string }
): string;
