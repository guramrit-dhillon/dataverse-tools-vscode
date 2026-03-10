# Dataverse Tools: Metadata

Browse the schema of your Dataverse environment directly from the VS Code sidebar. See every entity, its attributes, relationships, and available SDK messages — without opening a browser or memorising logical names.

When you're writing a plugin, building a query, or configuring a step, you need to know what entities and fields exist. This extension puts that reference right next to your code.

No more switching to the maker portal just to look up a field name.

## What You Can Do

- **Browse all entities** in your environment — display names alongside logical names
- **Expand any entity** to see its attributes, relationships, and the SDK messages it supports
- **Filter by solution** — scope the view to only what's inside your active solution
- **Toggle managed / unmanaged** — hide managed-only components to focus on your customisations
- **Query any entity instantly** — right-click and choose **Query This Entity** to open it in the Query Analyzer with a pre-filled SELECT query
- **Add or remove components from a solution** — directly from the tree, without opening the browser

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
      ► Attributes
            name  (Single Line of Text)
            revenue  (Currency)
            ownerid  (Owner)
      ► Relationships
            account_contacts  (1:N → Contact)
      ► Messages
            Create, Update, Delete, Retrieve, RetrieveMultiple
  ► Contact  (contact)
  ► Opportunity  (opportunity)
```

- The **display name** is shown prominently; the **logical name** appears in parentheses — these are the names you use in code and FetchXML
- Expand **Attributes** to see field types and logical names
- Expand **Relationships** to understand how entities connect to each other
- Expand **Messages** to see which Dataverse operations are supported — useful when deciding which message to register a plugin step against

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
- **Dataverse Tools: Query Analyzer** — query this entity instantly with SQL
- **Dataverse Tools: FetchXML Builder** — build FetchXML queries using the fields you browse here
