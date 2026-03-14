# Dataverse Decompiler — Feature Status

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

## Decompilation

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | Browse assemblies in explorer tree | `Done` | Lists all assemblies |
| 2 | Expand assembly → namespaces → types | `Done` | Hierarchical browsing |
| 3 | Open type as read-only C# | `Done` | Syntax-highlighted document |
| 4 | On-demand decompilation | `Done` | Decompiles only when expanded |
| 5 | Managed assembly support | `Done` | Works on managed and unmanaged |
| 6 | Backend idle timeout | `Done` | Configurable auto-shutdown |
| 7 | Search within decompiled code | `Not Started` | Find across all types in an assembly |
| 8 | Copy decompiled source | `Not Started` | Copy full file to clipboard |
| 9 | Save decompiled source to file | `Not Started` | Export as .cs file |
| 10 | Decompile entire assembly to folder | `Idea` | Bulk export all types |

## Navigation

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 11 | Go to definition within decompiled code | `Idea` | Click type reference → navigate |
| 12 | Find references in decompiled code | `Idea` | Where is this type used |
| 13 | Type hierarchy view | `Idea` | Show inheritance chain |

## Comparison

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 14 | Diff two assembly versions | `Idea` | Compare decompiled output |
| 15 | Diff across environments | `Idea` | Same assembly, different envs |

## Configuration

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 16 | Idle timeout setting | `Done` | `dataverse-tools.decompiler.idleTimeoutMs` |
| 17 | Custom backend path | `Done` | `dataverse-tools.decompiler.backendPath` |
