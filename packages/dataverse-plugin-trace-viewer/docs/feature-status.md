# Plugin Trace Viewer — Feature Status

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

## Search & Filtering

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | Search by plugin type | `Done` | |
| 2 | Search by message name | `Done` | |
| 3 | Search by entity | `Done` | |
| 4 | Search by correlation ID | `Done` | |
| 5 | Filter by date range | `Done` | |
| 6 | Toggle exceptions only | `Done` | |
| 7 | Retrieve up to 5,000 records | `Done` | |
| 8 | Search by operation type | `Not Started` | Sync vs async |
| 9 | Search by execution duration | `Idea` | Find slow plugins |
| 10 | Save search filters | `Idea` | Reuse common searches |

## Trace Log Details

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 11 | Exception message | `Done` | |
| 12 | Stack trace | `Done` | |
| 13 | Execution context | `Done` | |
| 14 | Timing / duration | `Done` | |
| 15 | Logged messages (tracing) | `Done` | |
| 16 | Input/output parameters | `Not Started` | Parsed from execution context |
| 17 | Shared variables | `Not Started` | Parsed from execution context |

## Navigation & UX

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 18 | Open from tree (assembly/type) | `Done` | Right-click context menu |
| 19 | Open from environment | `Done` | Browse all logs |
| 20 | Multiple panels side by side | `Done` | |
| 21 | Switch environments on open panel | `Done` | |
| 22 | Auto-refresh / live tail | `Not Started` | Poll for new traces |
| 23 | Copy trace details | `Not Started` | Copy to clipboard |
| 24 | Export traces to CSV/JSON | `Idea` | Bulk export |

## Analysis

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 25 | Exception frequency chart | `Idea` | Visualize error trends |
| 26 | Duration histogram | `Idea` | Performance distribution |
| 27 | Group by plugin / message | `Idea` | Aggregate view |
| 28 | Trace log cleanup tool | `Idea` | Delete old traces |
