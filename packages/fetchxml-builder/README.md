# Dataverse Tools: FetchXML Builder

Build Dataverse queries visually — without writing XML. Click to add conditions, pick entities from a dropdown, execute against your environment, and see the results in a table.

FetchXML is the native query language for Dataverse. It's powerful, but writing it by hand is slow and error-prone. This builder generates it for you, and still lets you drop into the raw XML when you need to.

## What You Can Do

- **Build queries visually** by clicking to add nodes — entity, attribute, filter, condition, join, and sort
- **Pick entities and fields from live metadata** — dropdowns are populated from your connected environment, no memorising logical names required
- **Set filter conditions** with type-aware operators — date, number, text, lookup, and option set fields each get the right options
- **Join related entities** — browse relationships and let the builder fill in the join fields automatically
- **Aggregate data** — count, sum, average, min, max with group-by and date grouping support
- **Execute your query** and see formatted results — option set labels instead of codes, currency symbols, lookup display names
- **Edit the raw XML at any time** — a live editor tab syncs bidirectionally with the tree; change one and the other updates
- **Export results** to CSV or copy the full set to clipboard
- **Save and open queries** from `.fetchxml` files
- **Ask GitHub Copilot** to run a FetchXML query against your environment and return results as JSON

---

## Getting Started

1. Install this extension and [Dataverse Tools: Environments](https://marketplace.visualstudio.com/items?itemName=gdhillon.dataverse-environments)
2. Connect to an environment using the Environments extension
3. Open the command palette and run **FetchXML Builder: New Query**
   — or right-click any entity in the Metadata explorer and choose **Open in FetchXML Builder**

---

## Building a Query

The builder opens with a tree panel on the left and a properties panel on the right.

**The tree** shows the structure of your query:

```
fetch
  └── entity: account
        ├── attribute: name
        ├── attribute: revenue
        ├── filter (AND)
        │     └── condition: statecode = 0
        └── order: createdon (desc)
```

- Click any node to edit its properties in the right panel
- Click **+** on a node to add a valid child — only the nodes that make sense in that position are offered
- Use the arrow buttons to reorder sibling nodes
- Right-click a node to **duplicate** or **delete** it

**The properties panel** adapts to the selected node:

| Node type | What you can set |
|---|---|
| **entity** | Pick the entity to query from a searchable list |
| **link-entity** | Browse relationships to auto-fill the join — or set the fields manually |
| **attribute** | Pick a field from the entity's attributes; set aggregate function for aggregate queries |
| **filter** | AND or OR grouping |
| **condition** | Pick a field, then choose from operators that match its type |
| **order** | Pick a field and choose ascending or descending |

---

## Executing and Viewing Results

Click **Execute** in the toolbar to run the query against your connected environment.

Results appear in a dedicated panel with:

- **Formatted values** — option set labels shown instead of numeric codes, lookup names instead of GUIDs, currencies with symbols
- **Column headers** toggle between display names and logical names
- **Sort** by clicking any column header; **filter** across all columns at once
- **Export** to CSV or **copy** the full result to clipboard
- **Result tabs** — switch between the data table, raw FetchXML, and the JSON response

The status bar shows the row count and how long the query took.

---

## Working with the XML

Click **Edit XML** to open the raw FetchXML in a VS Code editor tab. Edit it directly — changes sync back to the visual tree automatically. You can switch between both views freely.

`.fetchxml` files get syntax highlighting. If the Red Hat XML extension is installed, schema validation is applied automatically.

---

## CSV Viewer

The extension registers as a custom editor for `.csv` files. Open any CSV with **Open With...** to view it in the same data table used for query results — with filtering, sorting, export, and clipboard copy.

---

## Requirements

- **VS Code** 1.96 or later
- **[Dataverse Tools: Environments](https://marketplace.visualstudio.com/items?itemName=gdhillon.dataverse-environments)** — required for authentication and environment access

---

## Part of Dataverse Tools

This extension is part of the [Dataverse Tools](https://github.com/guramrit-dhillon/dataverse-tools-vscode) suite — a collection of VS Code extensions for Dynamics 365 / Power Platform developers.

Other extensions in the suite:
- **Dataverse Tools: Environments** — connect and manage environments
- **Dataverse Tools: Assemblies** — deploy and register plugin assemblies and steps
- **Dataverse Tools: Trace Viewer** — view and filter plugin trace logs
- **Dataverse Tools: Query Analyzer** — prefer SQL over FetchXML? Use this instead
- **Dataverse Tools: Workflows** — browse and manage process automation
- **Dataverse Tools: Web Resources** — edit and publish web resources
- **Dataverse Tools: Metadata** — browse entity and attribute names to use in your queries
- **Dataverse Tools: Decompiler** — read decompiled plugin code from Dataverse
- **Dataverse Tools: Audit Viewer** — view audit history for Dataverse records

---

## Acknowledgements

Inspired by [FetchXML Builder](https://fetchxmlbuilder.com/) by Jonas Rapp — the original and most popular FetchXML tool for [XrmToolBox](https://www.xrmtoolbox.com/).

---

## Feedback & Community

Found a bug, have a feature request, or want to suggest a new extension?

- **Bug reports & feature requests** — [GitHub Issues](https://github.com/guramrit-dhillon/dataverse-tools-vscode/issues)
- **Questions & discussion** — [GitHub Discussions](https://github.com/guramrit-dhillon/dataverse-tools-vscode/discussions)
