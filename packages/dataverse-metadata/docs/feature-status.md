# Dataverse Metadata — Feature Status

> Last updated: 2026-03-21

## Status Legend

| Tag | Meaning |
|-----|---------|
| `Done` | Shipped and working |
| `In Progress` | Actively being developed |
| `Planned` | Committed to building |
| `Not Started` | Desired but not yet scheduled |
| `Idea` | Under consideration, not committed |

---

## Entity Browsing

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | List all entities | `Done` | Display name + logical name |
| 2 | Sort entities by display name | `Done` | |
| 3 | Entity detail panel | `Done` | Shows display name, logical name, ID |
| 4 | Richer entity details | `Not Started` | Schema name, collection name, ownership type, primary key, etc. |
| 5 | Entity search / filter | `Not Started` | Type-to-filter by name |
| 6 | Entity count badge | `Not Started` | e.g. "Entities (347)" |

## Form Viewer

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 43 | Open form viewer from entity | `Done` | Click form name in EntityPanel |
| 44 | Form structure tab | `Done` | Parsed from formxml — tabs, sections, fields |
| 45 | Libraries & Events tab | `Done` | Form-level JS libraries and event handlers |
| 46 | FormJSON tab | `Done` | Raw form definition viewer |
| 47 | Field-level event handlers | `Done` | Field events from formxml |
| 48 | Parse formxml (not formjson) | `Done` | Robust XML parsing via parseFormStructure |
| 49 | Multiple form types | `Done` | Main, Quick Create, Quick View, Card, etc. |
| 50 | Form navigation from entity panel | `Done` | Forms listed and clickable in EntityPanel |

## View Designer

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 51 | Open view designer from entity | `Done` | Views listed and clickable in EntityPanel |
| 52 | View columns tab | `Done` | DataTable showing column names, widths, types |
| 53 | View FetchXML tab | `Done` | Read-only FetchXML definition |
| 54 | View properties | `Done` | View name, type, state |
| 55 | Edit view columns | `Not Started` | Modify column order and widths |
| 56 | Edit view FetchXML | `Not Started` | Visual filter/sort editing |
| 57 | Save view changes | `Not Started` | Publish view back to Dataverse |

## Attributes

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 7 | Browse entity attributes | `Not Started` | Entity → Attributes folder → attribute nodes |
| 8 | Attribute type icons | `Not Started` | Distinct icons per type family |
| 9 | Attribute detail panel | `Not Started` | Type, required level, max length, description |
| 10 | Local option set values | `Not Started` | Expand picklist attributes to see options |
| 11 | Sort attributes | `Not Started` | By display name, logical name, or schema name |
| 12 | Show/hide system attributes | `Idea` | Filter out created by, modified on, etc. |

## Relationships

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 13 | Browse entity relationships | `Not Started` | 1:N, N:1, N:N sub-folders |
| 14 | Relationship detail panel | `Not Started` | Schema name, type, related entity, cascade config |
| 15 | Navigate to related entity | `Idea` | Click relationship → jump to target entity |

## SDK Messages

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 16 | Browse entity SDK messages | `Not Started` | Create, Update, Delete, Retrieve, etc. |
| 17 | Message detail panel | `Not Started` | Message name, deployment type |

## Global OptionSets

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 18 | Global OptionSets provider | `Not Started` | Separate tree group for global option sets |
| 19 | Browse option values | `Not Started` | Label + numeric value per option |

## Entity Keys

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 20 | Browse alternate keys | `Not Started` | Key name + attributes |

## Cross-Extension Integration

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 21 | Query This Entity | `Not Started` | Right-click → open in Query Analyzer |
| 22 | Open in FetchXML Builder | `Not Started` | Right-click → open in FetchXML Builder |
| 23 | Register Step on Message | `Idea` | Right-click message → open step wizard |
| 24 | View Audit History | `Idea` | Right-click → open Audit Viewer |
| 25 | Copy Logical Name | `Not Started` | Copy to clipboard |
| 26 | Copy Schema Name | `Not Started` | Copy to clipboard |

## Metadata Editing

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 27 | Create custom entity | `Idea` | Wizard with display name, ownership, etc. |
| 28 | Create custom attribute | `Idea` | Type-specific property forms |
| 29 | Edit attribute properties | `Idea` | Display name, required level, etc. |
| 30 | Delete custom attribute | `Idea` | With dependency check |
| 31 | Create / edit global option set | `Idea` | |
| 32 | Create relationship | `Idea` | 1:N, N:1, N:N wizard |

## Visualization

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 33 | Entity Relationship Diagram | `Idea` | Visual graph of relationships |
| 34 | Attribute comparison | `Idea` | Compare two entities side-by-side |
| 35 | Dependency viewer | `Idea` | What depends on this component |
| 36 | Metadata diff between environments | `Idea` | Compare schema across envs |

## Code Generation

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 37 | Generate TypeScript interface | `Idea` | From entity attributes |
| 38 | Generate C# early-bound class | `Idea` | From entity attributes |
| 39 | Generate FetchXML template | `Idea` | Pre-filled query for entity |
| 40 | Copy OData URL | `Idea` | Full URL with selected attributes |

## Performance & Config

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 41 | Metadata caching | `Not Started` | Cache per env, configurable TTL |
| 42 | Lazy loading / pagination | `Not Started` | For large environments |
| 43 | Show/hide system entities setting | `Idea` | |
| 44 | Default sort order setting | `Idea` | |
