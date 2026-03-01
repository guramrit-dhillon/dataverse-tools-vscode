# Dataverse Assembly Analyzer

.NET CLI tool that inspects Dataverse plugin assemblies using `MetadataLoadContext`. Returns assembly metadata, plugin types, and step registrations as JSON.

## How it works

The `PluginAnalyzer` binary runs in **exec mode** — each call spawns a fresh process, analyzes the assembly, and exits. The Node.js wrapper (`index.js`) provides two functions:

- `analyze(assemblyPath)` — run the analyzer and get parsed results
- `getBinaryPath()` — resolve the platform-specific binary path

## Examples

### Analyze an assembly

```js
const { analyze } = require("dataverse-assembly-analyzer");

const result = await analyze("/path/to/MyPlugin.dll");

console.log(result.assemblyName);  // "MyPlugin"
console.log(result.version);       // "1.0.0.0"
console.log(result.fileHash);      // sha256 hash of the dll
console.log(result.plugins);       // [{ name: "MyPlugin.PreCreate", steps: [...] }]
```

### Custom binary path or timeout

```js
const result = await analyze("/path/to/MyPlugin.dll", {
  binaryPath: "/custom/path/PluginAnalyzer",
  timeout: 60000,
});
```

### Check if the analyzer is available

```js
const { getBinaryPath } = require("dataverse-assembly-analyzer");

try {
  const binPath = getBinaryPath();
  console.log("Analyzer found at", binPath);
} catch {
  console.log("Analyzer not built — run npm run build");
}
```

## Consumed by

- `dataverse-assemblies` extension via `AssemblyAnalyzer` service

## Building

```bash
npm run build      # current platform only
npm run build:all  # all platforms (win-x64, linux-x64, osx-x64, osx-arm64)
```

Requires .NET 8 SDK. Skips gracefully if `dotnet` is not available. Binaries go to `bin/{rid}/PluginAnalyzer[.exe]`.

## Testing

```bash
npm test    # integration tests (skipped if binaries not built)
```
