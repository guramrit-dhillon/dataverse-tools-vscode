/**
 * assembly-backend
 *
 * Shared Node.js process manager and JSON-RPC client for .NET assembly
 * backend tools. Supports two communication modes:
 *
 * - "stdio" — long-running process with stdin/stdout JSON-RPC, idle timeout,
 *   crash recovery, and lazy spawn.
 * - "exec"  — one-shot process per invocation: spawns with --exec --method
 *   --params, collects stdout, parses JSON response, exits.
 *
 * @example
 *   const { createClient } = require("assembly-backend");
 *
 *   // Long-running (stdio mode)
 *   const client = createClient({ binaryPath: "/path/to/bin", mode: "stdio" });
 *   const result = await client.invoke("listTypes", { namespace: "Contoso" });
 *   client.dispose();
 *
 *   // One-shot (exec mode)
 *   const client = createClient({ binaryPath: "/path/to/bin", mode: "exec" });
 *   const result = await client.invoke("analyzePlugins", { assemblyPath: "/foo.dll" });
 *   client.dispose();
 */
const childProcess = require("child_process");
const path = require("path");
const fs = require("fs");

const SUPPORTED_RIDS = ["win-x64", "linux-x64", "osx-x64", "osx-arm64"];
const DEFAULT_IDLE_TIMEOUT = 300_000;
const DEFAULT_REQUEST_TIMEOUT = 30_000;

/**
 * Detect the .NET runtime identifier for the current platform.
 * @returns {string}
 */
function getRuntimeIdentifier() {
  const arch = process.arch === "arm64" ? "arm64" : "x64";
  switch (process.platform) {
    case "win32": return `win-${arch}`;
    case "darwin": return `osx-${arch}`;
    default: return `linux-${arch}`;
  }
}

/**
 * Returns the absolute path to a .NET backend binary for the current platform.
 *
 * @param {string} binaryName - Name of the binary (without extension)
 * @param {object} [options]
 * @param {string} [options.binDir] - Override the binary directory
 * @returns {string}
 * @throws {Error} If the binary does not exist
 */
function getBinaryPath(binaryName, options) {
  const binDir = (options && options.binDir) || path.join(process.cwd(), "bin");
  const rid = getRuntimeIdentifier();
  const suffix = process.platform === "win32" ? ".exe" : "";
  const binPath = path.join(binDir, rid, binaryName + suffix);

  if (!fs.existsSync(binPath)) {
    throw new Error(`Binary not found at ${binPath}. Run "npm run build" to build it.`);
  }
  return binPath;
}

/**
 * Managed backend client that communicates with a .NET backend process.
 * Supports both "stdio" (long-running) and "exec" (one-shot) modes.
 */
class BackendClient {
  /**
   * @param {object} options
   * @param {string} [options.binaryPath]     - Override the full binary path
   * @param {string} [options.binDir]         - Override the binary directory
   * @param {string} [options.binaryName]     - Binary name for resolution (required if no binaryPath)
   * @param {string} [options.mode]           - "stdio" or "exec" (default: "stdio")
   * @param {number} [options.idleTimeoutMs]  - Idle timeout for stdio mode (default: 300000)
   * @param {number} [options.requestTimeout] - Per-request timeout in ms (default: 30000)
   * @param {function} [options.logger]       - Optional log function: (level, message, data?) => void
   */
  constructor(options) {
    this._options = options || {};
    this._mode = this._options.mode || "stdio";
    this._requestTimeout = this._options.requestTimeout ?? DEFAULT_REQUEST_TIMEOUT;
    this._log = this._options.logger || (() => {});

    // stdio mode state
    this._process = null;
    this._buffer = "";
    this._requestId = 0;
    this._pending = new Map();
    this._idleTimer = null;
    this._disposed = false;
    this._idleTimeoutMs = this._options.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT;
  }

  /**
   * Invoke a command on the backend.
   * In stdio mode, sends via JSON-RPC. In exec mode, spawns a new process.
   *
   * @param {string} method - Command name
   * @param {object} [params] - Command parameters
   * @returns {Promise<any>}
   */
  async invoke(method, params) {
    if (this._disposed) {
      throw new Error("BackendClient has been disposed");
    }

    if (this._mode === "exec") {
      return this._invokeExec(method, params);
    }
    return this._invokeStdio(method, params);
  }

  /**
   * Dispose the client and kill any running process.
   */
  dispose() {
    this._disposed = true;
    this._clearIdleTimer();
    this._killProcess();
  }

  // ── Exec mode ────────────────────────────────────────────────────────

  _invokeExec(method, params) {
    return new Promise((resolve, reject) => {
      const timeout = this._requestTimeout;

      let binPath;
      try {
        binPath = this._resolveBinaryPath();
      } catch (err) {
        return reject(err);
      }

      const args = ["--exec", "--method", method];
      if (params) {
        args.push("--params", JSON.stringify(params));
      }

      this._log("debug", "Spawning exec process", { binPath, method });

      const child = childProcess.spawn(binPath, args, {
        timeout,
        windowsHide: true,
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString("utf8");
      });

      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString("utf8");
      });

      child.on("close", (code) => {
        // Parse the JSON-RPC response from stdout
        let response;
        try {
          response = JSON.parse(stdout);
        } catch {
          return reject({
            code: "PARSE_FAILED",
            message: `Backend produced invalid JSON (exit code ${code})`,
            detail: (stdout || stderr).slice(0, 500),
          });
        }

        if (response.error) {
          return reject({
            code: response.error.code || "PROCESS_ERROR",
            message: response.error.message || `Backend exited with code ${code}`,
            detail: stderr.slice(0, 1000),
          });
        }

        resolve(response.result);
      });

      child.on("error", (spawnErr) => {
        reject({
          code: "NOT_FOUND",
          message: `Could not launch backend: ${spawnErr.message}`,
        });
      });

      // Belt-and-suspenders timeout guard
      const timer = setTimeout(() => {
        child.kill();
        reject({
          code: "TIMEOUT",
          message: `Backend timed out after ${timeout}ms`,
        });
      }, timeout + 2000);

      child.on("close", () => clearTimeout(timer));
    });
  }

  // ── Stdio mode ───────────────────────────────────────────────────────

  async _invokeStdio(command, params) {
    const proc = await this._ensureProcess();
    const id = `req-${++this._requestId}`;

    this._resetIdleTimer();

    return new Promise((resolve, reject) => {
      this._pending.set(id, { resolve, reject });

      const request = { id, command, params };
      const line = JSON.stringify(request) + "\n";

      const ok = proc.stdin.write(line, "utf8");
      if (!ok) {
        proc.stdin.once("drain", () => {});
      }

      // Per-request timeout
      const timer = setTimeout(() => {
        if (this._pending.has(id)) {
          this._pending.delete(id);
          reject(new Error(`Backend request timed out: ${command}`));
        }
      }, this._requestTimeout);

      // Clear timeout on settle
      const original = this._pending.get(id);
      this._pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          original.resolve(value);
        },
        reject: (reason) => {
          clearTimeout(timer);
          original.reject(reason);
        },
      });
    });
  }

  async _ensureProcess() {
    if (this._process) {
      return this._process;
    }

    const binPath = this._resolveBinaryPath();
    this._log("debug", "Spawning stdio backend", { binPath });

    const child = childProcess.spawn(binPath, ["--stdio"], {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    child.stdout.on("data", (chunk) => {
      this._buffer += chunk.toString("utf8");
      this._processBuffer();
    });

    child.stderr.on("data", (chunk) => {
      this._log("warn", "Backend stderr", { data: chunk.toString("utf8").slice(0, 500) });
    });

    child.on("error", (err) => {
      this._log("error", "Backend process error", { message: err.message });
      this._rejectAllPending(new Error(`Backend process error: ${err.message}`));
      this._process = null;
    });

    child.on("close", (code) => {
      this._log("debug", "Backend process exited", { code });
      this._rejectAllPending(new Error(`Backend process exited with code ${code}`));
      this._process = null;
      this._buffer = "";
    });

    this._process = child;
    return child;
  }

  _processBuffer() {
    const lines = this._buffer.split("\n");
    this._buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      let response;
      try {
        response = JSON.parse(line);
      } catch {
        this._log("warn", "Invalid JSON from backend", { line: line.slice(0, 200) });
        continue;
      }

      const pending = this._pending.get(response.id);
      if (!pending) {
        this._log("warn", "Unmatched response from backend", { id: response.id });
        continue;
      }

      this._pending.delete(response.id);

      if (response.error) {
        pending.reject(new Error(`[${response.error.code}] ${response.error.message}`));
      } else {
        pending.resolve(response.result);
      }
    }
  }

  // ── Process lifecycle ────────────────────────────────────────────────

  _resolveBinaryPath() {
    if (this._options.binaryPath) {
      return this._options.binaryPath;
    }
    if (!this._options.binaryName) {
      throw new Error("Either binaryPath or binaryName must be provided");
    }
    return getBinaryPath(this._options.binaryName, { binDir: this._options.binDir });
  }

  _rejectAllPending(reason) {
    for (const [, pending] of this._pending) {
      pending.reject(reason);
    }
    this._pending.clear();
  }

  _killProcess() {
    if (this._process) {
      try {
        this._process.kill();
      } catch {
        // ignore
      }
      this._process = null;
      this._buffer = "";
    }
  }

  _resetIdleTimer() {
    this._clearIdleTimer();

    if (this._idleTimeoutMs <= 0) {
      return;
    }

    this._idleTimer = setTimeout(() => {
      this._log("debug", "Backend idle timeout — shutting down");
      this.invoke("shutdown", {}).catch(() => {}).finally(() => {
        this._killProcess();
      });
    }, this._idleTimeoutMs);
  }

  _clearIdleTimer() {
    if (this._idleTimer) {
      clearTimeout(this._idleTimer);
      this._idleTimer = null;
    }
  }
}

/**
 * Create a managed backend client instance.
 *
 * @param {object} options - See BackendClient constructor
 * @returns {BackendClient}
 */
function createClient(options) {
  return new BackendClient(options);
}

module.exports = {
  SUPPORTED_RIDS,
  DEFAULT_IDLE_TIMEOUT,
  DEFAULT_REQUEST_TIMEOUT,
  getRuntimeIdentifier,
  getBinaryPath,
  BackendClient,
  createClient,
};
