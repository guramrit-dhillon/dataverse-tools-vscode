# Dataverse Tools for VS Code

Deploy plugins, register steps, query data, debug trace logs, browse metadata, manage workflows, edit web resources, and decompile assemblies — without leaving VS Code.

A modern replacement for the XrmToolBox Plugin Registration Tool, built entirely inside VS Code.

> **Status:** Preview (`0.1.0-preview`)
> **Requires:** VS Code 1.96+
> **License:** MIT

---

## Why Dataverse Tools?

Dynamics 365 / Power Platform development has always meant context-switching. You write code in VS Code, then open XrmToolBox to deploy, open the maker portal to check your changes, open a trace log viewer to debug, and so on.

Dataverse Tools puts the whole workflow in one place:

- **Deploy the moment you build** — a prompt appears as soon as your build succeeds; one click deploys to Dataverse
- **Smart uploads** — only uploads when the DLL actually changed; large assemblies are skipped automatically
- **One explorer for everything** — assemblies, entities, workflows, web resources, and trace logs all live in the same sidebar
- **Switch orgs in seconds** — dev, test, and prod environments available from the same tree
- **Modular** — install only the extensions you need; each does one thing

---

## Extensions

Ten extensions share a common foundation. Install them all at once with the [Dataverse Tools](https://marketplace.visualstudio.com/items?itemName=gdhillon.dataverse-tools) extension pack, or pick the ones you need.

| Extension | What it does |
|---|---|
| **Environments** | Connect to environments, manage sign-in, and provide the shared explorer sidebar |
| **Assemblies** | Deploy plugin assemblies, register steps, and manage pre/post images |
| **Metadata** | Browse entities, attributes, relationships, and SDK messages in the explorer |
| **FetchXML Builder** | Visual query builder with execution, results table, and CSV export |
| **Query Analyzer** | SQL editor for the Dataverse TDS endpoint with live autocomplete |
| **Trace Viewer** | Search and inspect plugin execution trace logs |
| **Workflows** | Browse, activate, deactivate, and trigger Dataverse process automation |
| **Web Resources** | Edit and publish JS, CSS, and HTML resources with Ctrl+S |
| **Decompiler** | Browse decompiled C# source from any deployed plugin assembly |
| **Audit Viewer** | View and analyze audit history for Dataverse records |

### Architecture

```
                    ┌─────────────────────────────────────────────┐
                    │          Environments (auth + tree)          │
                    └──────────────────┬──────────────────────────┘
                                       │
          ┌────────────┬───────────┬───┴───┬───────────┬──────────┬──────────┐
          ▼            ▼           ▼       ▼           ▼          ▼          ▼
    Assemblies    Metadata    FetchXML  Query      Trace     Decompiler   Audit
                              Builder  Analyzer   Viewer                 Viewer
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

### Environments — Connect and stay signed in

<!-- SCREENSHOT: The "Add Environment" wizard showing Global Discovery results
     (list of orgs grouped by region) or the auth method picker.
     Crop to just the wizard dialog. -->
<!-- ![Add Environment wizard](docs/images/add-environment.png) -->

Connect using your Microsoft account, Azure CLI, device code, or a service principal — configured per environment. The extension auto-discovers all the Dataverse orgs in your tenant via Global Discovery, so you don't have to remember URLs. Tokens refresh silently 60 seconds before expiry. Switch between environments in one click.

### Assemblies — Deploy plugins and register steps

<!-- SCREENSHOT: Explorer tree showing assembly → plugin type → step hierarchy
     with the right-click context menu open (Deploy, Add Step, Enable/Disable, etc.).
     Crop to the sidebar + context menu. -->
<!-- ![Assembly tree with context menu](docs/images/assembly-tree.png) -->

<!-- SCREENSHOT: The Step Configuration panel (webview) showing message, entity,
     stage, mode, rank, and filtering attributes fields. -->
<!-- ![Step configuration panel](docs/images/step-config.png) -->

Right-click a `.dll` or get prompted automatically when a build succeeds. A SHA-256 hash is compared before uploading — unchanged assemblies are skipped. The step registration wizard walks you through message, entity, stage, mode, rank, filtering attributes, and secure/unsecure config. Enable or disable steps in place. Attach pre/post entity images. Download assemblies back to disk.

### Metadata — Browse your environment's schema

Know exactly what entities, attributes, relationships, and SDK messages exist in your environment. Expand any entity to see field types and logical names — the names you use in plugin code, FetchXML, and SQL queries. Filter by solution or managed/unmanaged state.

### FetchXML Builder — Build queries visually

<!-- SCREENSHOT: FetchXML Builder showing the tree on the left, node properties
     panel on the right, and ideally query results in a bottom panel.
     Full-width capture. -->
<!-- ![FetchXML Builder](docs/images/fetchxml-builder.png) -->

A tree editor where you click to add nodes — entity, attribute, link-entity, filter, condition, order. Entity and attribute pickers are driven by live metadata. Condition operators adapt to the field type. Aggregate queries, relationship joins, and formatted result values (option set labels, currency symbols, lookup names) are all supported. Edit the raw XML directly when you need to — changes sync back to the tree. Built-in CSV viewer for result export.

### Query Analyzer — SQL for Dataverse

<!-- SCREENSHOT: Query Analyzer panel with a SQL query in the editor,
     autocomplete dropdown visible, and results table below. -->
<!-- ![Query Analyzer](docs/images/query-analyzer.png) -->

Write standard SQL against the Dataverse TDS endpoint. Table and column autocomplete is driven by live metadata. Results appear in a sortable, filterable data table with CSV/JSON export. Query history records the last 50 runs with duration and row count. Named queries persist per workspace.

### Trace Viewer — Debug what your plugins did

<!-- SCREENSHOT: Trace Viewer panel showing a list of trace logs with
     filters at the top and an expanded trace showing exception/context details. -->
<!-- ![Trace Viewer](docs/images/trace-viewer.png) -->

Right-click any assembly or plugin type in the tree and open its trace logs pre-filtered. Filter by plugin type, message, entity, correlation ID, or date range. Toggle to show only failed executions. Expand any row to see the full exception, stack trace, plugin context, and any messages logged with `ITracingService`.

### Workflows — Manage process automation

Browse classic workflows, actions, business rules, business process flows, and modern flows — all grouped in one tree. Activate, deactivate, or delete drafts without opening the browser. Trigger on-demand workflows against a specific record by entering its ID.

### Web Resources — Edit files, Ctrl+S publishes

Open any JavaScript, CSS, or HTML web resource as a proper editor tab with syntax highlighting. Ctrl+S writes the change back to Dataverse. A prompt then offers to publish immediately, or save it for a batch publish later. The upload button in the editor title bar saves and publishes in one step.

### Audit Viewer — Trace record changes

Pick an entity, enter a record ID, and see the full audit trail — every field change with old and new values, who made the change, and when. Open from the explorer tree by right-clicking an entity, or from an environment context menu. Supports multiple panels for different environments.

### Decompiler — Read deployed assembly code

<!-- SCREENSHOT: Decompiler showing the namespace → type tree on the left
     and decompiled C# source code in the editor on the right. -->
<!-- ![Decompiler](docs/images/decompiler.png) -->

Expand the **Code** node under any assembly in the explorer tree. Browse namespaces and types. Click a class to open the decompiled C# as a read-only document — works on managed assemblies without the original source.

### GitHub Copilot Chat Integration

Four language model tools exposed for Copilot Chat: list environments, get environment details, test a connection, and execute a FetchXML query with results returned as JSON.

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
├── dataverse-plugin-trace-viewer/ Plugin trace log viewer
├── dataverse-assembly-decompiler/ Assembly code browser
├── dataverse-workflows/         Workflow and process automation browser
├── dataverse-web-resources/     Web resource editor + Ctrl+S publish
├── dataverse-audit-viewer/      Audit history viewer for Dataverse records
├── dataverse-tools-pack/        Extension pack (installs all of the above)
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
| HTTP | Native fetch, OData v9.2 |
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
