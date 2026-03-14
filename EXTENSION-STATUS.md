# Dataverse Tools — Extension Status

> Last updated: 2026-03-13

Overview of all extensions in the suite — what exists, what's coming, and what's being considered.

## Status Legend

| Tag | Meaning |
|-----|---------|
| `Released` | Published and available |
| `In Development` | Actively being built |
| `Planned` | Committed, not yet started |
| `Idea` | Under consideration |

---

## Foundation

| Extension | Package | Status | Description |
|-----------|---------|--------|-------------|
| Dataverse Tools: Environments | `dataverse-environments` | `Released` | Auth, environment management, unified explorer framework. Required by all other extensions. |
| core-dataverse | `core-dataverse` | `Released` | Shared library — types, services, constants. Not a VS Code extension. |
| shared-views | `shared-views` | `Released` | React component library for webview UIs. Not a VS Code extension. |
| Dataverse Tools Pack | `dataverse-tools-pack` | `Released` | Extension pack — installs all extensions together. |

## .NET Backend

| Package | Status | Description |
|---------|--------|-------------|
| `assembly-backend` | `Released` | Shared .NET class library — BackendHost, AssemblyManager, JSON-RPC. |
| `dataverse-assembly-analyzer` | `Released` | Plugin analysis CLI — hash, detection, registration hints via MetadataLoadContext. |
| `assembly-decompiler` | `Released` | ILSpy-based decompilation server. |

## Extensions — Existing

| Extension | Package | Status | Feature Tracking |
|-----------|---------|--------|------------------|
| Dataverse Tools: Assemblies | `dataverse-assemblies` | `Released` | [feature-status.md](packages/dataverse-assemblies/docs/feature-status.md) |
| Dataverse Tools: Metadata | `dataverse-metadata` | `Released` | [feature-status.md](packages/dataverse-metadata/docs/feature-status.md) |
| Dataverse Tools: Decompiler | `dataverse-assembly-decompiler` | `Released` | [feature-status.md](packages/dataverse-assembly-decompiler/docs/feature-status.md) |
| Dataverse Tools: Trace Viewer | `dataverse-plugin-trace-viewer` | `Released` | [feature-status.md](packages/dataverse-plugin-trace-viewer/docs/feature-status.md) |
| Dataverse Tools: FetchXML Builder | `fetchxml-builder` | `Released` | [feature-status.md](packages/fetchxml-builder/docs/feature-status.md) |
| Dataverse Tools: Query Analyzer | `dataverse-query-analyzer` | `Released` | [feature-status.md](packages/dataverse-query-analyzer/docs/feature-status.md) |
| Dataverse Tools: Audit Viewer | `dataverse-audit-viewer` | `Released` | [feature-status.md](packages/dataverse-audit-viewer/docs/feature-status.md) |
| Dataverse Tools: Web Resources | `dataverse-web-resources` | `Released` | [feature-status.md](packages/dataverse-web-resources/docs/feature-status.md) |
| Dataverse Tools: Workflows | `dataverse-workflows` | `Released` | [feature-status.md](packages/dataverse-workflows/docs/feature-status.md) |

## Extensions — Ideas

Extensions that could add value but are not yet committed. Ordered roughly by perceived impact.

| Extension | Description | Status | Notes |
|-----------|-------------|--------|-------|
| **Workflow Designer** | Visual designer for classic workflows and actions. Edit XAML visually rather than read-only. | `Idea` | ExtensionId reserved in constants. |
| **Solution Manager** | Full solution lifecycle — create, clone, export, import, compare, diff between environments. Patch and upgrade management. | `Idea` | Currently solution scoping exists in the explorer, but no dedicated solution management UI. |
| **Solution Explorer** | Browse and manage exported solution .zip files. Inspect components, view solution.xml, compare two zips, extract/repack, and diff against a live environment. | `Idea` | Useful for ALM pipelines — inspect what's in a zip without importing. |
| **Form Editor** | Browse and edit Dataverse entity forms. Visual form layout, add/remove fields, configure sections and tabs. | `Idea` | Forms are a major customization surface. Could start read-only (browse form XML) then add editing. |
| **View Editor** | Browse and edit saved queries / system views. Column layout, sort order, filter criteria. | `Idea` | Companion to Form Editor. Views are the other major UI customization surface. |
| **Security Role Manager** | Browse security roles, view/edit privilege matrices, compare roles, assign roles to users/teams. | `Idea` | Security configuration is common and the maker portal experience is clunky. |
| **Environment Variable Manager** | Browse, create, edit environment variables and their values. Compare across environments. | `Idea` | Environment variables are increasingly used in Power Platform. Simple CRUD with env comparison. |
| **Connection Manager** | Browse and manage connection references and connections. View which flows use which connections. | `Idea` | Useful for ALM — connection references are often misconfigured across environments. |
| **Data Migration Tool** | Export/import data between environments. Map entities, transform values, handle lookups. | `Idea` | High value but high complexity. Could start with simple CSV import/export per entity. |
| **Plugin Profiler** | Capture and replay plugin execution context. Profile against local code without deploying. | `Idea` | XrmToolBox has this — would be a major draw for plugin developers. Requires significant .NET backend work. |
| **Business Rule Viewer** | Browse and visualize business rules. Show conditions and actions in a readable format. | `Idea` | Business rules are stored as XAML — could render as a decision table or flowchart. |
| **Canvas App Inspector** | Browse canvas apps in the environment. View screens, controls, data sources, and formulas. | `Idea` | Canvas apps use .msapp format — would need to unpack and parse. Niche but unique. |
| **API Playground** | Interactive HTTP client for Dataverse Web API. Build requests, see responses, save as collection. | `Idea` | Like Postman but integrated with auth and environment switching. Could leverage existing WebApiClient. |
| **Record Inspector** | Open any Dataverse record by entity + ID. View all fields, related records, audit trail. | `Idea` | Quick record lookup without opening browser. Natural extension of Query Analyzer results. |
| **Dependency Analyzer** | Visualize component dependencies. Show what blocks deletion. Trace dependency chains across solutions. | `Idea` | Uses `RetrieveDependenciesForDelete` / `RetrieveDependentComponents` APIs. |
| **Email Template Editor** | Browse and edit email templates with rich preview. | `Idea` | Templates use HTML — good fit for a webview editor. |
| **Sitemap Editor** | Browse and edit model-driven app sitemaps visually. | `Idea` | Sitemaps are XML — could provide visual drag-and-drop editing. |
| **Async Job Monitor** | Browse and manage system jobs — async operations, bulk deletes, imports, workflow jobs. Filter by status (waiting, in progress, failed), retry or cancel stuck jobs. | `Idea` | Developers constantly check system jobs when debugging async plugins or bulk operations. |
| **Ribbon / Command Bar Editor** | Browse and edit command bar definitions. View button visibility rules, actions, and display rules. | `Idea` | Command bar customization currently requires Ribbon Workbench or raw XML editing. |
| **Localization Manager** | Browse and edit translations across entities, attributes, forms, views, option sets. Export/import translation files. Side-by-side language comparison. | `Idea` | Multi-language deployments are common in enterprise. |
