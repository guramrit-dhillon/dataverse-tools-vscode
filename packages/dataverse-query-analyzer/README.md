# Dataverse Tools: Query Analyzer

SQL query editor for Dataverse via the TDS (Tabular Data Stream) endpoint. Write SQL queries with autocomplete, execute them, and view results in a tabular format.

## Features

- **SQL editor** powered by CodeMirror with syntax highlighting
- **Intellisense** — table and column autocomplete driven by live Dataverse metadata (cached with 5-min TTL)
- **Execute queries** against the Dataverse TDS endpoint using Azure AD authentication
- **Tabular results** displayed in a data table
- **Export results** to CSV or JSON
- **Query history** — automatically records the last 50 executed queries with duration and row count
- **Saved queries** — save, load, and delete named queries (persisted per workspace)
- **Multi-instance panels** — open separate panels per environment, each with its own connection
- **Launch from Explorer** — right-click an entity in the Explorer tree to open a pre-filled `SELECT TOP 50 * FROM <entity>` query
- **Connection pooling** — reuses TDS connections per environment for faster repeat queries
- **Change environment** — switch the target environment from the editor tab context menu

## Commands

| Command | Description |
|---|---|
| `Dataverse Tools: Query Analyzer: Open Query Analyzer` | Open the SQL query editor |
| `Dataverse Tools: Query Analyzer: Select Environment` | Choose the target environment |
| `Dataverse Tools: Query Analyzer: Query This Entity` | Open with a query for a selected entity (Explorer tree context menu) |
| `Dataverse Tools: Query Analyzer: Change Environment` | Switch environment on the active panel (editor tab context menu) |

## Settings

| Setting | Default | Description |
|---|---|---|
| `dataverse-tools.queryAnalyzer.queryTimeout` | `30` | Query timeout in seconds (applies to both connection and request) |

## Dependencies

- **Dataverse Tools: Environments** — required for authentication and environment access

## Requirements

- VS Code 1.96+
- TDS endpoint must be enabled on the target Dataverse environment

## Acknowledgements

Inspired by Microsoft's original SQL Server Query Analyzer (pre-SSMS) and [SQL 4 CDS](https://github.com/MarkMpn/Sql4Cds) by Mark Carrington (MarkMpn) for [XrmToolBox](https://www.xrmtoolbox.com/).

## Part of Dataverse Tools

This extension is part of the [Dataverse Tools](https://github.com/guramrit-dhillon/dataverse-tools-vscode) suite for Dynamics 365 / Power Platform plugin developers.
