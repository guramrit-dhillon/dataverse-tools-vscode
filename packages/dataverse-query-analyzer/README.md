# Dataverse Tools: Query Analyzer

Write SQL, query Dataverse, see results — all in VS Code. No FetchXML. No API calls. Just SQL.

Most developers know SQL. Dataverse has a SQL endpoint that understands standard queries. This extension gives you a proper editor with autocomplete, executes your query, displays the results in a table, and lets you export to CSV or JSON.

No more hand-writing FetchXML just to check what's in a table.

## What You Can Do

- **Write SQL queries** with syntax highlighting and autocomplete for table and column names
- **Autocomplete from live metadata** — table and column suggestions are pulled from your connected environment and cached locally
- **Run queries and see results** in a clean data table, sortable and filterable
- **Export results** to CSV or JSON with one click
- **Save named queries** that persist per workspace so you can reuse them
- **Browse query history** — the last 50 queries you ran, with duration and row count
- **Open from the Explorer** — right-click any entity in the Metadata tree and choose **Query This Entity** to open a pre-filled SELECT query
- **Run separate panels** per environment, each with its own independent connection

---

## Getting Started

1. Install this extension and [Dataverse Tools: Environments](https://marketplace.visualstudio.com/items?itemName=gdhillon.dataverse-environments)
2. Make sure the TDS endpoint is enabled on your Dataverse environment *(it's on by default for most online environments)*
3. Open the editor: command palette → **Dataverse Tools: Query Analyzer: Open Query Analyzer**
   — or right-click any entity in the Metadata explorer and choose **Query This Entity**

---

## Writing Queries

The editor opens with a standard SQL template. Start typing a table name and autocomplete suggests entity names. Tab to a column position and autocomplete fills in available attributes.

```sql
SELECT TOP 50
    name,
    revenue,
    ownerid
FROM account
WHERE statecode = 0
ORDER BY createdon DESC
```

Press **Run** to execute. Results appear in the table below.

> **Tip:** Dataverse SQL uses logical entity and attribute names (e.g. `account`, `revenue`), not display names. Use the **Metadata** extension to browse logical names while writing queries.

---

## Working with Results

- **Sort** by clicking any column header
- **Filter** using the search box — works across all columns at once
- **Export** to CSV or JSON using the buttons in the results toolbar

Results are paginated automatically for large queries.

---

## Saved Queries and History

- **Save** a query with a name from the toolbar — stored per workspace, persists across sessions
- **History** records every executed query automatically — click any entry to reload it, with the duration and row count shown alongside

---

## Settings

| Setting | Default | What It Does |
|---|---|---|
| `dataverse-tools.queryAnalyzer.queryTimeout` | `30` | How many seconds to wait for a query to complete before timing out |

---

## Requirements

- **VS Code** 1.96 or later
- **[Dataverse Tools: Environments](https://marketplace.visualstudio.com/items?itemName=gdhillon.dataverse-environments)** — required for authentication and environment access
- The TDS endpoint must be enabled on the target Dataverse environment

---

## Part of Dataverse Tools

This extension is part of the [Dataverse Tools](https://github.com/guramrit-dhillon/dataverse-tools-vscode) suite — a collection of VS Code extensions for Dynamics 365 / Power Platform developers.

Other extensions in the suite:
- **Dataverse Tools: Environments** — connect and manage environments
- **Dataverse Tools: Assemblies** — deploy and register plugin assemblies and steps
- **Dataverse Tools: Trace Viewer** — view and filter plugin trace logs
- **Dataverse Tools: FetchXML Builder** — prefer FetchXML over SQL? Use this instead
- **Dataverse Tools: Workflows** — browse and manage process automation
- **Dataverse Tools: Web Resources** — edit and publish web resources
- **Dataverse Tools: Metadata** — browse entity and attribute logical names to use in your queries
- **Dataverse Tools: Decompiler** — read decompiled plugin code from Dataverse
- **Dataverse Tools: Audit Viewer** — view audit history for Dataverse records

---

## Acknowledgements

Inspired by Microsoft's original SQL Server Query Analyzer (pre-SSMS) and [SQL 4 CDS](https://github.com/MarkMpn/Sql4Cds) by Mark Carrington (MarkMpn) for [XrmToolBox](https://www.xrmtoolbox.com/).
