# Query Analyzer — Feature Status

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

## SQL Editor

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | SQL syntax highlighting | `Done` | |
| 2 | Autocomplete from live metadata | `Done` | Cached locally |
| 3 | Table name autocomplete | `Done` | |
| 4 | Column name autocomplete | `Done` | |
| 5 | Multiple statements | `Not Started` | Run multiple queries in one editor |
| 6 | SQL formatting / pretty print | `Idea` | Auto-format query |
| 7 | Query explain / execution plan | `Idea` | Show how query is translated |

## Execution & Results

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 8 | Run query | `Done` | |
| 9 | Results data table | `Done` | |
| 10 | Export to CSV | `Done` | |
| 11 | Export to JSON | `Done` | |
| 12 | Query duration display | `Done` | |
| 13 | Row count display | `Done` | |
| 14 | Result set pagination | `Not Started` | Navigate pages |
| 15 | Inline record editing | `Idea` | Edit values in result grid |

## Query Management

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 16 | Save named queries | `Done` | Per workspace |
| 17 | Query history (last 50) | `Done` | With duration and row count |
| 18 | Favorite queries | `Not Started` | Pin frequently used queries |
| 19 | Share queries | `Idea` | Export/import query files |

## Explorer Integration

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 20 | Open from explorer (entity) | `Done` | Right-click → pre-filled SELECT |
| 21 | Multiple panels per environment | `Done` | |
| 22 | Change environment on open panel | `Done` | |

## Configuration

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 23 | Query timeout setting | `Done` | `dataverse-tools.queryAnalyzer.queryTimeout` |
| 24 | Max results setting | `Not Started` | Limit rows returned |
