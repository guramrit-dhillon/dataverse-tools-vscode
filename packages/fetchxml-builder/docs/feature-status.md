# FetchXML Builder — Feature Status

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

## Query Building

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | Visual tree-based query builder | `Done` | |
| 2 | Entity picker from live metadata | `Done` | |
| 3 | Field picker from live metadata | `Done` | |
| 4 | Type-aware filter conditions | `Done` | |
| 5 | Join related entities (link-entity) | `Done` | Auto-filled join fields |
| 6 | Aggregation (count, sum, avg, min, max) | `Done` | With group-by |
| 7 | Order by | `Done` | |
| 8 | Top / count | `Done` | |
| 9 | Distinct | `Done` | |
| 10 | Move nodes up / down | `Done` | Reorder in tree |
| 11 | Duplicate node | `Done` | |
| 12 | Delete node | `Done` | |
| 13 | Nested filters (and/or) | `Done` | |
| 14 | Paging cookie support | `Not Started` | Fetch next page of results |
| 15 | FetchXML templates / snippets | `Idea` | Common query patterns |

## XML Editing

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 16 | Raw XML editor | `Done` | |
| 17 | Bidirectional sync (visual ↔ XML) | `Done` | |
| 18 | Preview XML | `Done` | |
| 19 | Copy XML to clipboard | `Done` | |
| 20 | XML validation | `Not Started` | Validate against schema |
| 21 | XML formatting / pretty print | `Not Started` | Auto-format XML |

## Execution & Results

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 22 | Execute query | `Done` | |
| 23 | Formatted results table | `Done` | |
| 24 | Export results to CSV | `Done` | |
| 25 | Copy results to clipboard | `Done` | |
| 26 | Export to JSON | `Not Started` | |
| 27 | Result set pagination | `Not Started` | Navigate pages |
| 28 | Inline record editing | `Idea` | Edit values in result grid |

## File Operations

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 29 | Save .fetchxml files | `Done` | |
| 30 | Open .fetchxml files | `Done` | |
| 31 | CSV viewer for .csv files | `Done` | Custom editor with filter/sort/export |
| 32 | Query library / saved queries | `Idea` | Named queries per workspace |

## Copilot Integration

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 33 | Execute FetchXML via Copilot | `Done` | Language model tool |
| 34 | Natural language → FetchXML | `Idea` | Ask Copilot to build query |

## Environment

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 35 | Select environment | `Done` | |
| 36 | Switch environment on open panel | `Not Started` | Like trace viewer |
