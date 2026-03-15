# Dataverse Tools: Metadata

Browse the entities in your Dataverse environment directly from the VS Code sidebar — display names alongside logical names, without opening a browser or memorising schema.

When you're writing a plugin, building a query, or configuring a step, you need to know what entities exist. This extension puts that reference right next to your code.

> **Status:** Work in progress — entity listing is available; attribute, relationship, and message browsing is coming soon.

## What You Can Do

- **Browse all entities** in your environment — display names alongside logical names
- **Filter by solution** — scope the view to only what's inside your active solution
- **Toggle managed / unmanaged** — hide managed-only components to focus on your customisations
- **Add or remove components from a solution** — directly from the tree, without opening the browser

## Coming Soon

- **Expand any entity** to see its attributes, relationships, and SDK messages
- **Query any entity instantly** — right-click to open in the Query Analyzer
- **Copy logical name** — copy entity or attribute names to clipboard
- **Global option sets** — browse global option sets and their values

See [docs/feature-status.md](https://github.com/guramrit-dhillon/dataverse-tools-vscode/blob/main/packages/dataverse-metadata/docs/feature-status.md) for the full roadmap.

---

## Getting Started

1. Install this extension and [Dataverse Tools: Environments](https://marketplace.visualstudio.com/items?itemName=gdhillon.dataverse-environments)
2. Connect to an environment using the Environments extension
3. The **Dataverse Explorer** tree shows an **Entities** section — expand it to start browsing

---

## Browsing the Tree

```
Entities
  ► Account  (account)
  ► Contact  (contact)
  ► Opportunity  (opportunity)
```

- The **display name** is shown prominently; the **logical name** appears in parentheses
- These are the names you use in code, FetchXML, and SQL queries
- Select an entity to see its details (display name, logical name, ID) in the Details panel

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
- **Dataverse Tools: FetchXML Builder** — build and run FetchXML queries
- **Dataverse Tools: Query Analyzer** — query Dataverse with SQL
- **Dataverse Tools: Workflows** — browse and manage process automation
- **Dataverse Tools: Web Resources** — edit and publish web resources
- **Dataverse Tools: Decompiler** — read decompiled plugin code from Dataverse
- **Dataverse Tools: Audit Viewer** — view audit history for Dataverse records

---

## Feedback & Community

Found a bug, have a feature request, or want to suggest a new extension?

- **Bug reports & feature requests** — [GitHub Issues](https://github.com/guramrit-dhillon/dataverse-tools-vscode/issues)
- **Questions & discussion** — [GitHub Discussions](https://github.com/guramrit-dhillon/dataverse-tools-vscode/discussions)
