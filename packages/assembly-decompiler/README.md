# Assembly Decompiler

.NET backend that decompiles assemblies to C# source using ILSpy (`ICSharpCode.Decompiler`). Runs as a long-lived stdin/stdout JSON-RPC server with idle timeout.

## How it works

The `AssemblyDecompiler` binary runs in **stdio mode** — it stays alive between calls, holding loaded assemblies in memory. The Node.js wrapper (`index.js`) provides:

- `createDecompiler()` — returns a `Decompiler` that manages the backend process
- `getBinaryPath()` — resolve the platform-specific binary path

Loading an assembly returns a `DecompiledAssembly` object with methods for browsing and decompiling.

## Examples

### Decompile a type

```js
const { createDecompiler } = require("assembly-decompiler");

const decompiler = createDecompiler({ idleTimeoutMs: 300000 });

// Load an assembly — returns a DecompiledAssembly
const assembly = await decompiler.loadAssembly("my-asm", base64DllContent);
console.log(assembly.namespaces);  // ["MyPlugin", "MyPlugin.Handlers"]
console.log(assembly.typeCount);   // 5

// Browse and decompile via the assembly object
const types = await assembly.listTypes("MyPlugin");
// [{ fullName: "MyPlugin.PreCreate", name: "PreCreate", kind: "Class" }, ...]

const source = await assembly.decompileType("MyPlugin.PreCreate");
// using System;
// using Microsoft.Xrm.Sdk;
// namespace MyPlugin { public class PreCreate : IPlugin { ... } }

await decompiler.shutdown();
```

### Custom binary path

```js
const decompiler = createDecompiler({
  binaryPath: "/custom/path/AssemblyDecompiler",
  requestTimeout: 60000,
  logger: (level, message, data) => console.log(`[${level}]`, message, data),
});
```

### Check if the decompiler is available

```js
const { getBinaryPath } = require("assembly-decompiler");

try {
  const binPath = getBinaryPath();
  console.log("Decompiler found at", binPath);
} catch {
  console.log("Decompiler not built — run npm run build");
}
```

## Consumed by

- `dataverse-assembly-decompiler` extension via its `DecompilerBackend` service

## Building

```bash
npm run build      # current platform only
npm run build:all  # all platforms (win-x64, linux-x64, osx-x64, osx-arm64)
```

Requires .NET 8 SDK. Skips gracefully if `dotnet` is not available. Binaries go to `bin/{rid}/AssemblyDecompiler[.exe]`.

## Acknowledgements

Powered by [ILSpy](https://github.com/icsharpcode/ILSpy) (`ICSharpCode.Decompiler`, MIT license) for .NET assembly decompilation.

## Testing

```bash
npm test    # integration tests (skipped if binaries not built)
```
