# Dataverse Tools: FetchXML Builder

Visual FetchXML query builder for Dataverse. Build queries with a tree editor, execute them against a live environment, and browse results — all within VS Code.

## Features

### Visual Tree Editor
Build FetchXML queries using a structured tree instead of writing raw XML:
- **7 node types** — `fetch`, `entity`, `attribute`, `link-entity`, `filter`, `condition`, `order`
- **Add, delete, duplicate, and reorder** nodes with inline tree actions
- **Smart child rules** — only valid child nodes are offered based on the parent type

### Node Properties Panel
A sidebar form that adapts to the selected node type:
- **Entity & attribute pickers** — autocomplete powered by live Dataverse metadata
- **Relationship browser** — select 1:N, N:1, or N:N relationships to auto-populate link-entity join fields
- **Type-aware condition operators** — operator list adapts based on the attribute type (text, number, date, boolean, lookup, picklist, etc.)
- **Aggregate support** — aggregate function, group by, and date grouping options on attribute nodes
- **Fetch options** — top, count, page, distinct, no-lock, aggregate mode, return total record count

### Query Execution & Results
- **Execute against any connected environment** — results open in a dedicated panel
- **Column name modes** — toggle between logical names, friendly display names, or both
- **Formatted values** — option set labels, currency formatting, lookup display names via OData annotations
- **Filter, sort, export** — cross-column text filter, column sorting, export to CSV, copy to clipboard
- **Result tabs** — view raw FetchXML and JSON alongside the data table
- **Status bar** — row count and query duration

### XML Editing
- **Live XML preview** — edit the raw FetchXML in a VS Code editor tab, synced bidirectionally with the tree
- **FetchXML language** — syntax highlighting for `.fetchxml` files
- **XSD validation** — automatic schema association when the Red Hat XML extension is installed

### File I/O
- **Open / Save** — load and save `.fetchxml` or `.xml` files
- **Copy to clipboard** — one-click copy of the serialized FetchXML
- **Session persistence** — your last query and environment selection are restored on next activation

### CSV Viewer
- Built-in custom editor for `.csv` files with the same data table used for query results
- Filter, sort, export, and copy — available via right-click → "Open With..." on any CSV file

### Copilot Chat Integration
Language model tool for GitHub Copilot Chat:

| Tool | Description |
|---|---|
| `Execute FetchXML Query` | Run a FetchXML query against a Dataverse environment and return results as JSON. Shows a confirmation prompt before execution. |

## Commands

| Command | Description |
|---|---|
| `FetchXML Builder: New Query` | Start a new empty query |
| `FetchXML Builder: Execute Query` | Execute the current query |
| `FetchXML Builder: Edit XML` | Open the live XML editor |
| `FetchXML Builder: Select Environment` | Choose the target environment |
| `FetchXML Builder: Copy FetchXML` | Copy query XML to clipboard |
| `FetchXML Builder: Open from File...` | Load a query from a file |
| `FetchXML Builder: Save to File...` | Save the query to a file |
| `Add Child Node` | Add a child to the selected tree node |
| `Delete Node` | Remove the selected node |
| `Duplicate Node` | Duplicate the selected node |
| `Move Up / Move Down` | Reorder nodes within their parent |

## Supported Node Types

| Node | Purpose | Allowed Children |
|---|---|---|
| `fetch` | Root query element | `entity` |
| `entity` | Primary entity to query | `attribute`, `link-entity`, `filter`, `order` |
| `link-entity` | Join to a related entity | `attribute`, `link-entity`, `filter`, `order` |
| `filter` | AND/OR condition group | `condition`, `filter` (nested) |
| `condition` | Single filter condition | — |
| `attribute` | Column to return | — |
| `order` | Sort order | — |

## Dependencies

- **Dataverse Tools: Environments** — required for authentication and environment access

## Requirements

- VS Code 1.96+
- A configured Dataverse environment (via the Environments extension)

## Acknowledgements

Inspired by [FetchXML Builder](https://fetchxmlbuilder.com/) by Jonas Rapp — the original and most popular FetchXML tool for [XrmToolBox](https://www.xrmtoolbox.com/).

## Part of Dataverse Tools

This extension is part of the [Dataverse Tools](https://github.com/guramrit-dhillon/dataverse-tools-vscode) suite for Dynamics 365 / Power Platform developers.
