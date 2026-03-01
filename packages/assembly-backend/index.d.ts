export type LogLevel = "debug" | "info" | "warn" | "error";
export type Logger = (level: LogLevel, message: string, data?: unknown) => void;

export interface ClientOptions {
  /** Full path to the binary. */
  binaryPath?: string;
  /** Directory containing platform-specific binaries. */
  binDir?: string;
  /** Binary name for auto-resolution (requires binDir). */
  binaryName?: string;
  /** Communication mode. Default: "stdio". */
  mode?: "stdio" | "exec";
  /** Idle timeout before auto-shutdown in stdio mode (ms). Default: 300000. */
  idleTimeoutMs?: number;
  /** Per-request timeout (ms). Default: 30000. */
  requestTimeout?: number;
  /** Optional log function. */
  logger?: Logger;
}

export interface BackendError {
  code: string;
  message: string;
  detail?: string;
}

export declare class BackendClient {
  constructor(options: ClientOptions);
  invoke(method: string, params?: Record<string, unknown>): Promise<unknown>;
  dispose(): void;
}

export declare function createClient(options: ClientOptions): BackendClient;

export declare function getBinaryPath(
  binaryName: string,
  options?: { binDir?: string }
): string;

export declare function getRuntimeIdentifier(): string;

export declare const SUPPORTED_RIDS: readonly string[];
export declare const DEFAULT_IDLE_TIMEOUT: number;
export declare const DEFAULT_REQUEST_TIMEOUT: number;
