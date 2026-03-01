# Assembly Backend

Shared process manager and JSON-RPC client for communicating with .NET assembly tools. This is the foundation that both the analyzer and decompiler build on.

## Overview

Provides two communication modes for talking to .NET binaries:

- **stdio** — Spawns a long-running process, communicates via stdin/stdout JSON lines, with idle timeout and auto-shutdown
- **exec** — Spawns a fresh process per call with `--exec --method --params` flags, parses the JSON response from stdout

Also includes a shared .NET class library (`dotnet/`) with:

- `AssemblyManager` — Load/unload assemblies via `MetadataLoadContext` (safe, read-only)
- `CommandRouter` — JSON-RPC command dispatch with built-in `load`, `unload`, `shutdown` commands
- `StdioServer` / `ExecServer` — Process entry points for each mode

## Examples

### Exec mode (one-shot)

```js
const { createClient } = require("assembly-backend");

const client = createClient({
  binaryPath: "/path/to/PluginAnalyzer",
  mode: "exec",
  requestTimeout: 30000,
});

const result = await client.invoke("analyzePlugins", {
  assemblyPath: "/path/to/MyPlugin.dll",
});
console.log(result.assemblyName, result.plugins);
client.dispose();
```

### Stdio mode (long-running)

```js
const { createClient } = require("assembly-backend");

const client = createClient({
  binaryPath: "/path/to/AssemblyDecompiler",
  mode: "stdio",
  idleTimeoutMs: 300000,
});

// Process spawns lazily on first invoke, stays alive between calls
await client.invoke("load", { assemblyId: "my-asm", filePath: "/path/to/Assembly.dll" });
const types = await client.invoke("listTypes", { assemblyId: "my-asm", namespace: "Contoso" });
await client.invoke("shutdown", {});
client.dispose();
```

### Binary resolution

```js
const { getBinaryPath, getRuntimeIdentifier } = require("assembly-backend");

const rid = getRuntimeIdentifier(); // e.g. "osx-arm64", "win-x64"
const binPath = getBinaryPath("PluginAnalyzer", { binDir: "./bin" });
```

## Consumed by

- `dataverse-assembly-analyzer` — uses exec mode for one-shot analysis
- `assembly-decompiler` — uses stdio mode for persistent decompilation sessions

## Building

```bash
npm run build    # builds the .NET class library
```

## Testing

```bash
npm test    # 29 unit tests (mocked, no .NET dependency)
```
