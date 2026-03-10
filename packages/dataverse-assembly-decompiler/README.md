# Dataverse Tools: Decompiler

Read the C# source code of any plugin assembly stored in Dataverse — even when you don't have the original project.

Expand any assembly in the explorer tree to browse its namespaces and types. Click a class to open the decompiled source as a read-only document, right in VS Code. Works on unmanaged assemblies, managed assemblies, and anything else registered in Dataverse.

## What You Can Do

- **Browse decompiled code** for any assembly directly in the explorer tree — expand to see namespaces and types
- **Open any class** as a read-only document with full C# syntax highlighting
- **Works on managed assemblies** — you don't need the original project or source files
- **On-demand decompilation** — assemblies are downloaded and decompiled only when you expand them, not upfront

---

## Getting Started

1. Install this extension and [Dataverse Tools: Environments](https://marketplace.visualstudio.com/items?itemName=gdhillon.dataverse-environments)
2. Connect to an environment using the Environments extension
3. In the **Dataverse Explorer**, expand any assembly — a **Code** node appears beneath it
4. Expand **Code** to see namespaces → expand a namespace to see its types → click any type to open the decompiled C#

---

## Browsing Decompiled Code

```
Assemblies
  MyPlugin  (v1.2.0)
    Plugins  (2)
      ...
    ► Code
        ► MyPlugin
              ► Handlers
                    AccountHandler   → click to open decompiled C#
                    ContactHandler
              MyPlugin.Plugin
```

The decompiled source opens as a read-only editor tab with the class name in the tab title. You can read, search, and copy from it — but not edit.

> **Performance note:** The decompiler backend starts in the background the first time you expand an assembly. Subsequent types from the same assembly open instantly — the backend stays warm until it idles out.

---

## Settings

| Setting | Default | What It Does |
|---|---|---|
| `dataverse-tools.decompiler.idleTimeoutMs` | `300000` | How long (in milliseconds) the decompiler stays running after the last request. Set to `0` to keep it alive permanently. |
| `dataverse-tools.decompiler.backendPath` | *(empty)* | Path to a custom decompiler binary. Leave empty to use the bundled one. |

---

## Requirements

- **VS Code** 1.96 or later
- **[Dataverse Tools: Environments](https://marketplace.visualstudio.com/items?itemName=gdhillon.dataverse-environments)** — required for authentication and environment access
- **.NET 8 runtime** — used by the bundled decompiler backend

---

## Part of Dataverse Tools

This extension is part of the [Dataverse Tools](https://github.com/guramrit-dhillon/dataverse-tools-vscode) suite — a collection of VS Code extensions for Dynamics 365 / Power Platform developers.

Other extensions in the suite:
- **Dataverse Tools: Environments** — connect and manage environments
- **Dataverse Tools: Assemblies** — deploy and register the assemblies you're reading here

---

## Acknowledgements

Powered by [ILSpy](https://github.com/icsharpcode/ILSpy) (MIT) for .NET assembly decompilation.
