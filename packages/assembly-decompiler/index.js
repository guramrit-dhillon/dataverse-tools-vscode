/**
 * assembly-decompiler
 *
 * Standalone Node.js wrapper for the AssemblyDecompiler .NET backend.
 * Provides binary resolution and a managed long-running backend process
 * with stdin/stdout JSON-RPC communication.
 *
 * Uses the shared assembly-backend package for process management.
 *
 * @example
 *   const { createDecompiler, getBinaryPath } = require("assembly-decompiler");
 *
 *   // Create a decompiler and load an assembly
 *   const decompiler = createDecompiler({ idleTimeoutMs: 300000 });
 *   const assembly = await decompiler.loadAssembly("my-assembly", base64Content);
 *
 *   // Work with the loaded assembly
 *   const types = await assembly.listTypes("MyNamespace");
 *   const source = await assembly.decompileType("MyNamespace.MyClass");
 *   decompiler.dispose();
 *
 *   // Binary resolution only
 *   const binPath = getBinaryPath();
 */
const path = require("path");
const {
  createClient,
  getBinaryPath: baseBinaryPath,
} = require("assembly-backend");

const BINARY_NAME = "AssemblyDecompiler";
const DEFAULT_IDLE_TIMEOUT = 300_000;
const DEFAULT_REQUEST_TIMEOUT = 30_000;
const DEFAULT_BIN_DIR = path.join(__dirname, "bin");

/**
 * Returns the absolute path to the AssemblyDecompiler binary for the current platform.
 *
 * @param {object} [options]
 * @param {string} [options.binDir] - Override the binary directory
 * @returns {string}
 * @throws {Error} If the binary does not exist
 */
function getBinaryPath(options) {
  const binDir = (options && options.binDir) || DEFAULT_BIN_DIR;
  return baseBinaryPath(BINARY_NAME, { binDir });
}

/**
 * A loaded assembly with methods for browsing and decompiling its types.
 * Returned by `Decompiler.loadAssembly()`.
 */
class DecompiledAssembly {
  /**
   * @param {object} client - The underlying BackendClient
   * @param {object} loadResult - The result from the loadAssembly command
   */
  constructor(client, loadResult) {
    this._client = client;
    this.assemblyId = loadResult.assemblyId;
    this.namespaces = loadResult.namespaces;
    this.typeCount = loadResult.typeCount;
  }

  async listNamespaces() {
    const result = await this._client.invoke("listNamespaces", { assemblyId: this.assemblyId });
    return result.namespaces;
  }

  async listTypes(namespace) {
    const result = await this._client.invoke("listTypes", { assemblyId: this.assemblyId, namespace });
    return result.types;
  }

  async decompileType(typeFullName) {
    const result = await this._client.invoke("decompileType", { assemblyId: this.assemblyId, typeFullName });
    return result.source;
  }
}

/**
 * Managed long-running decompiler process.
 * Thin facade over BackendClient in stdio mode.
 */
class Decompiler {
  /**
   * @param {object} [options]
   * @param {string} [options.binaryPath]     - Override the full binary path
   * @param {string} [options.binDir]         - Override the binary directory
   * @param {number} [options.idleTimeoutMs]  - Idle timeout before auto-shutdown (default: 300000)
   * @param {number} [options.requestTimeout] - Per-request timeout in ms (default: 30000)
   * @param {function} [options.logger]       - Optional log function: (level, message, data?) => void
   */
  constructor(options) {
    const opts = options || {};
    this._client = createClient({
      binaryName: BINARY_NAME,
      binaryPath: opts.binaryPath,
      binDir: opts.binDir || DEFAULT_BIN_DIR,
      mode: "stdio",
      idleTimeoutMs: opts.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT,
      requestTimeout: opts.requestTimeout ?? DEFAULT_REQUEST_TIMEOUT,
      logger: opts.logger,
    });
  }

  /**
   * Load an assembly and return a DecompiledAssembly for browsing/decompiling.
   *
   * @param {string} assemblyId - Unique identifier for the assembly
   * @param {string} base64Content - Base64-encoded assembly bytes
   * @returns {Promise<DecompiledAssembly>}
   */
  async loadAssembly(assemblyId, base64Content) {
    const result = await this._client.invoke("loadAssembly", { assemblyId, base64: base64Content });
    return new DecompiledAssembly(this._client, result);
  }

  async shutdown() {
    if (!this._client) {
      return;
    }
    try {
      await this._client.invoke("shutdown", {});
    } catch {
      // Ignore — process may already be dead
    }
    this._client.dispose();
  }

  dispose() {
    if (this._client) {
      this._client.dispose();
    }
  }
}

/**
 * Create a managed decompiler instance.
 *
 * @param {object} [options]
 * @param {string} [options.binaryPath]     - Override the full binary path
 * @param {string} [options.binDir]         - Override the binary directory
 * @param {number} [options.idleTimeoutMs]  - Idle timeout before auto-shutdown (default: 300000)
 * @param {number} [options.requestTimeout] - Per-request timeout in ms (default: 30000)
 * @param {function} [options.logger]       - Optional log function: (level, message, data?) => void
 * @returns {Decompiler}
 */
function createDecompiler(options) {
  return new Decompiler(options);
}

module.exports = {
  getBinaryPath,
  createDecompiler,
};
