# Dataverse Tools: Audit Viewer

See who changed what and when — for any record in your Dataverse environment, right inside VS Code.

When something changes unexpectedly in Dataverse, you need to trace it back. Pick an entity, enter a record ID, and instantly see the full audit trail — every field change, old value, new value, who did it, and when.

No more navigating to the maker portal or writing FetchXML against the audit table.

## What You Can Do

- **View audit history** for any record by entity and record ID
- **See field-level diffs** — old and new values side by side for every change
- **Search auditable entities** — a live autocomplete shows only entities with auditing enabled
- **Open from the explorer** — right-click any entity in the Metadata tree and choose **View Audit History** to open pre-filtered to that entity
- **Open from an environment** — right-click an environment to browse audit logs across all entities
- **Copy change details** to clipboard for sharing or documentation
- **Switch environments** on an open panel without closing and re-opening it
- **Run multiple panels** — open separate audit viewers for different environments side by side

---

## Getting Started

1. Install this extension and [Dataverse Tools: Environments](https://marketplace.visualstudio.com/items?itemName=gdhillon.dataverse-environments)
2. Make sure auditing is enabled on your Dataverse environment and on the entities you want to audit *(Settings → Administration → System Settings → Auditing)*
3. Right-click an entity in the explorer tree and choose **View Audit History**
   — or right-click an environment and choose **View Audit History…**
   — or open the command palette and run **Dataverse Tools: Audit Viewer: View Audit History…**

---

## Reading Audit History

The audit viewer opens as an editor panel with filters at the top and results below.

**Filters:**

| Filter | What it narrows |
|---|---|
| **Entity** | The entity type to audit — searchable dropdown showing only entities with auditing enabled |
| **Record ID** | The specific record GUID to view history for |
| **Max Count** | Limit the number of audit records returned |

**Each row in the results shows:**
- Operation (Create, Update, Delete)
- User who made the change
- Timestamp

**Select any row** to see the full change details in a side panel — every field that changed, with old and new values displayed side by side.

---

## Requirements

- **VS Code** 1.96 or later
- **[Dataverse Tools: Environments](https://marketplace.visualstudio.com/items?itemName=gdhillon.dataverse-environments)** — required for authentication and environment access
- Auditing must be enabled on the target Dataverse environment and entities

---

## Part of Dataverse Tools

This extension is part of the [Dataverse Tools](https://github.com/guramrit-dhillon/dataverse-tools-vscode) suite — a collection of VS Code extensions for Dynamics 365 / Power Platform developers.

Other extensions in the suite:
- **Dataverse Tools: Environments** — connect and manage environments
- **Dataverse Tools: Assemblies** — deploy and register plugin assemblies and steps
- **Dataverse Tools: Trace Viewer** — view and filter plugin trace logs
- **Dataverse Tools: FetchXML Builder** — build and run FetchXML queries
- **Dataverse Tools: Query Analyzer** — query Dataverse with SQL
- **Dataverse Tools: Workflows** — browse and manage process automation
- **Dataverse Tools: Web Resources** — edit and publish web resources
- **Dataverse Tools: Metadata** — browse entity schema in the explorer
- **Dataverse Tools: Decompiler** — read decompiled plugin code from Dataverse

---

## Feedback & Community

Found a bug, have a feature request, or want to suggest a new extension?

- **Bug reports & feature requests** — [GitHub Issues](https://github.com/guramrit-dhillon/dataverse-tools-vscode/issues)
- **Questions & discussion** — [GitHub Discussions](https://github.com/guramrit-dhillon/dataverse-tools-vscode/discussions)
