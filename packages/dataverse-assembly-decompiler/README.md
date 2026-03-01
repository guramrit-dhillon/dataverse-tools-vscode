# Dataverse Tools: Decompiler

Browse and decompile C# source code from Dataverse plugin assemblies. Expands assemblies in the Explorer tree to show namespaces and types, and opens decompiled source as read-only documents.

## Features

- **Browse decompiled code** directly in the Explorer tree under each assembly
- **View C# source** for any type in a plugin assembly
- **Read-only virtual documents** with C# syntax highlighting
- **On-demand decompilation** — assemblies are downloaded and decompiled only when expanded
- **Auto-cleanup** — the decompiler backend process idles out after configurable inactivity

## Settings

| Setting | Default | Description |
|---|---|---|
| `dataverse-tools.decompiler.idleTimeoutMs` | `300000` | Idle timeout before the backend process is terminated (0 = keep alive) |
| `dataverse-tools.decompiler.backendPath` | `""` | Path to the decompiler backend binary. Empty uses the bundled binary |

## Dependencies

- **Dataverse Tools: Environments** — required for auth and environment access
- **Dataverse Tools: Explorer** — required for the unified tree view

## Requirements

- VS Code 1.96+
- .NET 8 runtime (for the bundled decompiler backend)

## Acknowledgements

Powered by [ILSpy](https://github.com/icsharpcode/ILSpy) (MIT) for .NET assembly decompilation.

## Part of Dataverse Tools

This extension is part of the [Dataverse Tools](../../README.md) suite for Dynamics 365 / Power Platform plugin developers.
