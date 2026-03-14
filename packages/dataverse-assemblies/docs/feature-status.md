# Dataverse Assemblies — Feature Status

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

## Assembly Deployment

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | Deploy assembly to Dataverse | `Done` | Upload .dll |
| 2 | Smart re-deploy (hash comparison) | `Done` | Only uploads when code changes |
| 3 | Download assembly from Dataverse | `Done` | Save .dll locally |
| 4 | Delete assembly | `Done` | With confirmation |
| 5 | Rename assembly | `Done` | |
| 6 | Auto-deploy after build | `Done` | Configurable prompt |
| 7 | Bulk deploy multiple assemblies | `Not Started` | Deploy all assemblies in workspace |
| 8 | Deploy history / rollback | `Idea` | Track previous versions |

## Step Management

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 9 | Register step (wizard) | `Done` | Guided step creation |
| 10 | Edit step configuration | `Done` | Unsecure config |
| 11 | Edit step secure configuration | `Done` | Secure config |
| 12 | Edit step description | `Done` | |
| 13 | Enable step | `Done` | |
| 14 | Disable step | `Done` | |
| 15 | Delete step | `Done` | With confirmation |
| 16 | Bulk enable/disable steps | `Not Started` | Multi-select toggle |
| 17 | Clone / duplicate step | `Idea` | Copy step to new message/entity |
| 18 | Step execution order management | `Idea` | Visual reordering |

## Step Images

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 19 | Register image | `Done` | Pre/post entity images |
| 20 | Edit image | `Done` | |
| 21 | Unregister image | `Done` | |

## Plugin Types

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 22 | Browse plugin types | `Done` | Listed under assembly |
| 23 | Delete plugin type | `Done` | |
| 24 | Rename plugin type | `Done` | |
| 25 | Change workflow activity group | `Done` | |

## Explorer Integration

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 26 | Assembly tree in explorer | `Done` | Assemblies → Types → Steps → Images |
| 27 | Show/hide managed assemblies | `Done` | Toggle filter |
| 28 | Open trace viewer from tree | `Done` | Right-click assembly or type |

## Cross-Extension Integration

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 29 | Open trace viewer for step | `Done` | Links to plugin-trace-viewer |
| 30 | Decompile assembly | `Done` | Decompiler contributes "Code" child node under each assembly via cross-provider contribution |
| 31 | Copilot: deploy assembly tool | `Idea` | Language model tool for deployment |
| 32 | Copilot: register step tool | `Idea` | Language model tool for step creation |

## Configuration

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 33 | Custom analyzer path | `Done` | `dataverse-tools.analyzerPath` |
| 34 | Deploy on build toggle | `Done` | `dataverse-tools.deployOnBuild` |
