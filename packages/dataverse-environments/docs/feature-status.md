# Dataverse Environments — Feature Status

> Last updated: 2026-03-13

## Status Legend

| Tag | Meaning |
|-----|---------|
| `Done` | Shipped and working |
| `In Progress` | Actively being developed |
| `Planned` | Committed to building |
| `Not Started` | Desired but not yet scheduled |
| `Idea` | Under consideration, not committed |

---

## Authentication

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | Microsoft account (VS Code auth) | `Done` | Default auth method |
| 2 | Azure CLI authentication | `Done` | Uses `az` token |
| 3 | Device code flow | `Done` | For headless / remote environments |
| 4 | Service principal (client credentials) | `Done` | Client ID + secret |
| 5 | Certificate-based auth | `Not Started` | Service principal with certificate |
| 6 | Managed identity | `Idea` | For Azure-hosted dev environments |
| 7 | Automatic token refresh | `Done` | Refreshes 60s before expiry |

## Environment Management

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 8 | Add environment manually | `Done` | Enter org URL |
| 9 | Auto-discover via Global Discovery | `Done` | Lists all accessible orgs |
| 10 | Edit environment | `Done` | Change display name, auth method |
| 11 | Remove environment | `Done` | With confirmation |
| 12 | Test connection | `Done` | Shows response time |
| 13 | Environment groups / folders | `Idea` | Organize envs by project or lifecycle |
| 14 | Import/export environment list | `Idea` | Share env config across team |

## Explorer Framework

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 15 | Unified tree view | `Done` | Single explorer, multiple providers |
| 16 | Provider registration API | `Done` | `explorer.registerProvider()` |
| 17 | Solution scoping | `Done` | Filter tree to active solution |
| 18 | Managed/unmanaged filter | `Done` | Toggle visibility |
| 19 | Show global / solution-only toggle | `Done` | |
| 20 | Add to solution | `Done` | From context menu |
| 21 | Remove from solution | `Done` | From context menu |
| 22 | Remove active customizations | `Done` | From context menu |
| 23 | Details panel | `Done` | Webview showing selected node properties |
| 24 | Search / filter within tree | `Not Started` | Type-to-filter across all providers |
| 25 | Bulk solution operations | `Idea` | Multi-select add/remove |

## Copilot Integration

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 26 | List environments tool | `Done` | Language model tool |
| 27 | Get environment details tool | `Done` | Language model tool |
| 28 | Test connection tool | `Done` | Language model tool |
| 29 | Query data via Copilot | `Idea` | Natural language → FetchXML/OData |

## Configuration

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 30 | Auth method setting | `Done` | `dataverse-tools.authMethod` |
| 31 | Log level setting | `Done` | `dataverse-tools.logLevel` |
| 32 | Request timeout setting | `Done` | `dataverse-tools.requestTimeoutMs` |
