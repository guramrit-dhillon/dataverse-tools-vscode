/**
 * dataverse-assembly-analyzer
 *
 * Standalone Node.js wrapper for the PluginAnalyzer .NET CLI tool.
 * Provides binary resolution, high-level analysis, and low-level spawn helpers.
 *
 * Uses the shared assembly-backend package for process management.
 *
 * @example
 *   const analyzer = require("dataverse-assembly-analyzer");
 *
 *   // High-level — analyze and get parsed result
 *   const result = await analyzer.analyze("/path/to/Plugin.dll");
 *
 *   // With options
 *   const result = await analyzer.analyze("/path/to/Plugin.dll", {
 *     binaryPath: "/custom/path/PluginAnalyzer",
 *     timeout: 60000,
 *   });
 *
 *   // Binary resolution only
 *   const binPath = analyzer.getBinaryPath();
 *   const binPath = analyzer.getBinaryPath({ binDir: "/custom/bin" });
 */
const path = require("path");
const {
  createClient,
  getBinaryPath: baseBinaryPath,
} = require("assembly-backend");

const BINARY_NAME = "PluginAnalyzer";
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_BIN_DIR = path.join(__dirname, "bin");

/**
 * Returns the absolute path to the PluginAnalyzer binary for the current platform.
 *
 * @param {object} [options]
 * @param {string} [options.binDir] - Override the binary directory (default: package's own bin/)
 * @returns {string} Absolute path to the binary
 * @throws {Error} If the binary does not exist
 */
function getBinaryPath(options) {
  const binDir = (options && options.binDir) || DEFAULT_BIN_DIR;
  return baseBinaryPath(BINARY_NAME, { binDir });
}

/**
 * Analyze a .NET assembly and return the parsed result.
 *
 * @param {string} assemblyPath - Absolute path to the .dll to analyze
 * @param {object} [options]
 * @param {string} [options.binaryPath] - Override the full binary path
 * @param {string} [options.binDir]     - Override the binary directory
 * @param {number} [options.timeout]    - Process timeout in ms (default: 30000)
 * @returns {Promise<object>} Parsed JSON analysis result
 */
function analyze(assemblyPath, options) {
  const client = createClient({
    binaryName: BINARY_NAME,
    binaryPath: options && options.binaryPath,
    binDir: (options && options.binDir) || DEFAULT_BIN_DIR,
    mode: "exec",
    requestTimeout: (options && options.timeout) || DEFAULT_TIMEOUT,
  });

  return client.invoke("analyzePlugins", { assemblyPath })
    .finally(() => client.dispose());
}

module.exports = {
  getBinaryPath,
  analyze,
};
