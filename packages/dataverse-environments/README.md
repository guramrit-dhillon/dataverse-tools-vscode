# Dataverse Tools: Environments

Manage Dataverse connections and authentication directly from VS Code. This is the foundational extension in the **Dataverse Tools** suite — all other extensions depend on it for auth, environment access, and the shared explorer tree.

## Features

### Environment Management
- **Add environments** via a guided wizard with auto-discovery from the Global Discovery Service — browse all orgs in your tenant grouped by region, or enter a custom URL
- **Edit environments** — change auth method or credentials without removing and re-adding
- **Remove environments** — safely clears cached tokens and stored secrets
- **Test connection** — validates connectivity with a WhoAmI call and reports latency

### Authentication
Four methods, configured per environment:

| Method | Description |
|---|---|
| **VS Code** | Browser-based sign-in via VS Code's built-in Microsoft authentication provider. Silent token refresh when possible. |
| **Azure CLI** | Uses your existing `az login` session. Requires Azure CLI installed and signed in. |
| **Device Code** | MSAL device code flow — works in headless/SSH environments. Optionally use a custom app registration. |
| **Service Principal** | Client ID + secret for app-based access. Secrets stored in the OS keychain via VS Code SecretStorage — never written to disk. |

Token caching with proactive refresh 60 seconds before JWT expiry.

### Explorer Tree
A unified, extensible tree view in the activity bar that other Dataverse Tools extensions contribute nodes to:

- **Select environment** — pick which org to browse
- **Select solution** — optionally scope the tree to a specific solution (managed or unmanaged)
- **Solution management** — add or remove components from a solution directly from the tree, with entity inclusion mode selection (all objects / metadata only / shell)
- **Filter controls** — toggle between all components and unmanaged only; show or hide out-of-solution items
- **Details panel** — select any tree item to view its properties in a sidebar webview

### Copilot Chat Integration
Three language model tools for use with GitHub Copilot Chat:

| Tool | Description |
|---|---|
| `List Dataverse Environments` | Returns all configured environments |
| `Get Environment Details` | Returns details for a specific environment |
| `Test Dataverse Connection` | Runs a WhoAmI call (with confirmation prompt) |

### Extension API
Exports `DataverseAccountApi` for other extensions in the suite:
- `getAccessToken()` — acquire/refresh tokens for any environment
- `getEnvironments()` / `onDidChangeEnvironments` — read and watch environment list
- `pickEnvironment()` — reusable environment + solution picker
- `showDetails()` — push detail items to the shared Details panel
- `explorer.registerProvider()` — register tree node providers
- `explorer.getContext()` / `onDidChangeContext` — read and watch explorer state
- `explorer.refresh()` — trigger tree refresh

## Commands

| Command | Description |
|---|---|
| `Dataverse Tools: Add Environment` | Launch the environment setup wizard |
| `Dataverse Tools: Edit Environment` | Change auth method or credentials |
| `Dataverse Tools: Remove Environment` | Remove an environment |
| `Dataverse Tools: Test Connection` | Verify connectivity and report latency |
| `Dataverse Tools: Select Environment` | Choose the active environment for the explorer |
| `Dataverse Tools: Refresh` | Refresh the explorer tree |
| `Dataverse Tools: Add to Solution` | Add a component to the active solution |
| `Dataverse Tools: Remove from Solution` | Remove a component from the active solution |

## Settings

| Setting | Default | Description |
|---|---|---|
| `dataverse-tools.authMethod` | `vscode` | Default auth method shown in the Add Environment wizard (`vscode`, `azcli`, `devicecode`, `clientcredentials`) |
| `dataverse-tools.logLevel` | `info` | Log verbosity (`debug`, `info`, `warn`, `error`) |
| `dataverse-tools.requestTimeoutMs` | `30000` | HTTP request timeout in milliseconds |

## Requirements

- VS Code 1.96+
- For Azure CLI auth: `az` CLI installed and signed in
- For Service Principal auth: an Azure AD app registration with Dataverse permissions

## Acknowledgements

Inspired by the connection management in the [Plugin Registration Tool](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/download-tools-nuget) from the Dynamics 365 SDK and [XrmToolBox](https://www.xrmtoolbox.com/).

## Part of Dataverse Tools

This extension is part of the [Dataverse Tools](../../README.md) suite for Dynamics 365 / Power Platform developers.
