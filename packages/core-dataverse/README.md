# core-dataverse

Shared library for the Dataverse Tools extension suite. Provides types, services, constants, and base classes used by all extensions.

## What's inside

- **Constants** — command IDs, view IDs, extension IDs (single source of truth)
- **Types** — entity types (`PluginAssembly`, `PluginType`, `SdkMessageProcessingStep`, etc.)
- **Interfaces** — `IRegistrationService`, `DataverseAccountApi`, `DataverseExplorerApi`
- **Services** — `RegistrationService` (CRUD for Dataverse entities), `DataverseWebApiClient` (OData v9.2 HTTP client)
- **Utilities** — `Logger`, `registerCommand` helper
- **Base classes** — `Panel` (webview IPC), `View` (webview view)

## Usage

Imported directly by each extension via npm workspaces:

```typescript
import { Commands, RegistrationService, type PluginAssembly } from "core-dataverse";
```

## Build

This package has no standalone build step. It is bundled into each extension by esbuild at build time.

## Part of Dataverse Tools

This library is part of the [Dataverse Tools](../../README.md) suite for Dynamics 365 / Power Platform plugin developers.
