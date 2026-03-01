# Dataverse Tools for VS Code

A modern, code-centric alternative to the XrmToolBox Plugin Registration Tool. Manage Dataverse environments, deploy plugin assemblies, register steps, build FetchXML queries, run SQL, browse metadata, view trace logs, and decompile assemblies — all without leaving VS Code.

> **Status:** Preview (`0.1.0-preview`)
> **Requires:** VS Code 1.96+
> **License:** MIT

---

## Why Dataverse Tools?

The legacy Plugin Registration Tool requires switching between your IDE and a separate desktop app. Dataverse Tools brings the full plugin lifecycle into VS Code so you can **build, deploy, register, debug, and query** in one place.

- **Deploy on build** — prompted to deploy your assembly the moment a build succeeds
- **Differential deployment** — only uploads when the DLL actually changed (SHA-256 hash comparison)
- **Multi-environment** — switch between dev, test, and prod orgs in seconds
- **Modular** — install only the extensions you need; each has a single responsibility

---

## Extensions

The suite is composed of seven extensions that share a common foundation. Install them individually or together.

| Extension | What it does |
|---|---|
| **Environments** | Authentication, environment management, unified explorer tree framework |
| **Assemblies** | Deploy assemblies, register plugin steps, manage pre/post images |
| **Metadata** | Browse entities, attributes, relationships, and messages in the explorer |
| **FetchXML Builder** | Visual query builder with execution, results table, and CSV export |
| **Query Analyzer** | SQL editor for the Dataverse TDS endpoint with autocomplete |
| **Trace Viewer** | Search and inspect plugin execution trace logs |
| **Decompiler** | Browse decompiled C# source from deployed plugin assemblies |

### Architecture

```
                    ┌─────────────────────────────────────────────┐
                    │          Environments (auth + tree)          │
                    └──────────────────┬──────────────────────────┘
                                       │
          ┌────────────┬───────────┬───┴───┬───────────┬──────────┐
          ▼            ▼           ▼       ▼           ▼          ▼
    Assemblies    Metadata    FetchXML  Query      Trace       Decompiler
                              Builder  Analyzer   Viewer
          │                                                       │
          ▼                                                       ▼
   Plugin Analyzer                                       Assembly Decompiler
     (.NET 8)                                               (.NET 8 / ILSpy)
          │                                                       │
          └──────────────────┬────────────────────────────────────┘
                             ▼
                      Assembly Backend
                    (shared .NET host)
```

All extensions depend on **Environments** for authentication and the explorer framework. **core-dataverse** provides shared types, services, and constants consumed by every package.

---

<!--
  SCREENSHOT INSTRUCTIONS
  =======================
  Add screenshots to a /docs/images/ directory (or /media/) at the repo root.
  Recommended dimensions: 1200–1400px wide, PNG or WebP.
  Capture in VS Code with a dark theme for consistency.

  After adding each image, uncomment the relevant ![alt](path) line below.
-->

<!-- HERO SCREENSHOT: Full VS Code window showing the Dataverse Tools activity bar,
     explorer tree with an environment expanded (assemblies + entities visible),
     and ideally a webview panel open (step config or query results).
     Crop to ~1400x900. -->
<!-- ![Dataverse Tools overview](docs/images/overview.png) -->

---

## Features at a glance

### Environment Management

<!-- SCREENSHOT: The "Add Environment" wizard showing Global Discovery results
     (list of orgs grouped by region) or the auth method picker.
     Crop to just the wizard dialog. -->
<!-- ![Add Environment wizard](docs/images/add-environment.png) -->

- Add environments via **Global Discovery Service** (auto-discovers all orgs in your tenant) or manual URL
- Four authentication methods: **VS Code auth**, **Azure CLI**, **device code flow**, **service principal** (client credentials)
- Service principal secrets stored in the OS keychain via VS Code SecretStorage — never written to disk
- Silent token refresh with proactive renewal 60 seconds before expiry
- Test connection (WhoAmI) with latency reporting
- Persistent environment selection across sessions

### Assembly Deployment & Plugin Registration

<!-- SCREENSHOT: Explorer tree showing assembly → plugin type → step hierarchy
     with the right-click context menu open (Deploy, Add Step, Enable/Disable, etc.).
     Crop to the sidebar + context menu. -->
<!-- ![Assembly tree with context menu](docs/images/assembly-tree.png) -->

<!-- SCREENSHOT: The Step Configuration panel (webview) showing message, entity,
     stage, mode, rank, and filtering attributes fields. -->
<!-- ![Step configuration panel](docs/images/step-config.png) -->

- **One-click deploy** — right-click a `.dll` or get prompted after a successful build
- **Differential deployment** — SHA-256 hash stored in the assembly `description` field; unchanged assemblies are skipped
- **Full step lifecycle** — add, edit, enable, disable, delete processing steps
- Configure message, entity filter, stage, execution mode, rank, and filtering attributes
- **Pre/post entity images** — add, configure, and remove image registrations
- **Download** deployed assemblies back to disk
- Rename and delete assemblies, plugin types, and steps with safety prompts
- Toggle managed assembly visibility in the tree

### Metadata Explorer
- Browse entities with display names and logical names
- Expand to see attributes, relationships, and SDK messages
- Filter by managed/unmanaged components
- Solution scoping — browse components within a specific solution or across the org
- Add/remove components to/from solutions (with inclusion mode selection)

### FetchXML Builder

<!-- SCREENSHOT: FetchXML Builder showing the tree on the left, node properties
     panel on the right, and ideally query results in a bottom panel.
     Full-width capture. -->
<!-- ![FetchXML Builder](docs/images/fetchxml-builder.png) -->

- **Visual tree editor** — build queries by adding entity, link-entity, attribute, filter, condition, and order nodes
- **Smart child rules** — only valid child nodes are offered per parent type
- **Metadata-driven autocomplete** — entity and attribute pickers powered by live Dataverse metadata
- **Type-aware operators** — condition operators adapt to the attribute type (string, number, date, lookup, picklist, etc.)
- **Aggregation support** — count, sum, avg, min, max with group-by and date grouping
- **Execute and view results** — data table with column sorting, cross-column filter, and export to CSV
- **Formatted values** — option set labels, currency formatting, lookup display names
- **Bidirectional XML editing** — edit raw FetchXML in a VS Code editor tab; changes sync back to the tree
- **FetchXML language support** — syntax highlighting for `.fetchxml` files
- Open/save queries to files, copy to clipboard
- Built-in CSV viewer for `.csv` files

### Query Analyzer (SQL)

<!-- SCREENSHOT: Query Analyzer panel with a SQL query in the editor,
     autocomplete dropdown visible, and results table below. -->
<!-- ![Query Analyzer](docs/images/query-analyzer.png) -->

- CodeMirror-based SQL editor with **metadata-driven autocomplete**
- Execute queries against the Dataverse **TDS endpoint** (port 5558)
- Results displayed in the same data table used by the FetchXML Builder
- "Query This Entity" context menu action in the explorer tree
- Configurable query timeout

### Trace Viewer

<!-- SCREENSHOT: Trace Viewer panel showing a list of trace logs with
     filters at the top and an expanded trace showing exception/context details. -->
<!-- ![Trace Viewer](docs/images/trace-viewer.png) -->

- Browse plugin execution trace logs from any connected environment
- Filter by plugin type, message name, and date range
- View full execution context, exception details, stack traces, and input/output parameters
- Launch from the command palette or directly from an assembly/plugin type in the tree

### Decompiler

<!-- SCREENSHOT: Decompiler showing the namespace → type tree on the left
     and decompiled C# source code in the editor on the right. -->
<!-- ![Decompiler](docs/images/decompiler.png) -->

- Expand the **Code** node under any assembly in the explorer tree to browse decompiled source
- Namespace → type hierarchy with class/interface/struct/enum icons
- Full C# syntax highlighting in a read-only virtual document — no temp files on disk
- ILSpy-based decompilation engine running as a long-lived .NET backend with idle timeout

### GitHub Copilot Chat Integration
Four language model tools are exposed for Copilot Chat:
- **List Dataverse Environments** — returns all configured environments
- **Get Environment Details** — returns details for a specific environment
- **Test Dataverse Connection** — runs WhoAmI with confirmation
- **Execute FetchXML Query** — runs a query and returns results as JSON

---

## Getting Started

### Prerequisites
- **VS Code** 1.96 or later
- A **Dataverse / Dynamics 365** environment (online or on-premises)
- **.NET 8 runtime** (only needed if using the Assemblies or Decompiler extensions)

### Installation
Install from the VS Code Marketplace (search for "Dataverse Tools") or from `.vsix` files on the [Releases](../../releases) page.

### Quick Start
1. Open a workspace containing a `.csproj` file (triggers automatic activation)
2. Click the **Dataverse Tools** icon in the Activity Bar
3. Click **Add Environment** and follow the wizard — choose Global Discovery or enter a URL
4. Select an authentication method and sign in
5. Your environment appears in the tree — expand to browse assemblies, entities, and more

---

## Settings

| Setting | Default | Description |
|---|---|---|
| `dataverse-tools.authMethod` | `vscode` | Default auth method shown in the Add Environment wizard |
| `dataverse-tools.logLevel` | `info` | Log verbosity (`debug`, `info`, `warn`, `error`) |
| `dataverse-tools.requestTimeoutMs` | `30000` | HTTP request timeout in milliseconds |
| `dataverse-tools.deployOnBuild` | `true` | Prompt to deploy assembly after a successful build |
| `dataverse-tools.analyzerPath` | — | Custom path to the .NET Plugin Analyzer binary |
| `dataverse-tools.queryAnalyzer.queryTimeout` | `30` | SQL query timeout in seconds |
| `dataverse-tools.decompiler.idleTimeoutMs` | `300000` | Idle time before the decompiler backend shuts down (0 = keep alive) |
| `dataverse-tools.decompiler.backendPath` | — | Custom path to the decompiler binary |

---

## Monorepo Structure

```
packages/
├── core-dataverse/              Shared types, services, constants (pure library)
├── shared-views/                React component library for webviews (no vscode dep)
├── dataverse-environments/      Auth + environment management + explorer framework
├── dataverse-assemblies/        Plugin deployment + step registration
├── dataverse-metadata/          Entity metadata providers for the explorer
├── fetchxml-builder/            FetchXML visual builder + executor
├── dataverse-query-analyzer/    SQL query editor (TDS endpoint)
├── plugin-trace-viewer/         Plugin trace log viewer
├── dataverse-assembly-decompiler/ Assembly code browser
├── assembly-backend/            Shared .NET host (stdio/exec JSON-RPC)
├── dataverse-assembly-analyzer/ .NET Plugin Analyzer CLI
└── assembly-decompiler/         .NET ILSpy decompiler backend
scripts/
└── build-extension.js           esbuild orchestrator for all extensions
```

### Building from source

```bash
git clone https://github.com/guramrit-dhillon/plugin-registration-tool.git
cd plugin-registration-tool
npm install
npm run build          # build all packages (skips .NET if dotnet SDK is missing)
```

Additional commands:

```bash
npm run watch          # incremental watch mode with sourcemaps
npm run lint           # ESLint
npm run test           # vitest
npm run clean          # remove all out/ directories
```

To build .NET backends for all platforms:

```bash
npm run build:all -w dataverse-assembly-analyzer
npm run build:all -w assembly-decompiler
```

### Tech stack

| Layer | Technology |
|---|---|
| Extensions | TypeScript, VS Code API, esbuild |
| Webviews | React, CodeMirror (SQL editor) |
| HTTP | Axios, OData v9.2 |
| .NET backends | .NET 8, MetadataLoadContext, ILSpy |
| Auth | `@azure/identity` (MSAL, Azure CLI, device code, client credentials) |
| CI/CD | GitHub Actions — lint, build, test, multi-platform .NET builds, VSIX packaging |

### Platform support

.NET binaries are published for: `win-x64`, `linux-x64`, `osx-x64`, `osx-arm64`.

---

## Contributing

1. Fork the repo and create a feature branch
2. `npm install && npm run build`
3. Open the repo in VS Code and press **F5** to launch the Extension Development Host
4. Make changes — `npm run watch` for live rebuilds
5. Run `npm run lint` and `npm run test` before submitting a PR

---

## Acknowledgements

Inspired by the community tools built for [XrmToolBox](https://www.xrmtoolbox.com/) — including the Plugin Registration Tool, [FetchXML Builder](https://fetchxmlbuilder.com/) by Jonas Rapp, [SQL 4 CDS](https://github.com/MarkMpn/Sql4Cds) by Mark Carrington, and the Plugin Trace Viewer. This project aims to bring that ecosystem natively into VS Code.

The decompiler extension is powered by [ILSpy](https://github.com/icsharpcode/ILSpy) (MIT).

---

## License

[MIT](LICENSE) — Copyright (c) 2026 guramrit-dhillon
