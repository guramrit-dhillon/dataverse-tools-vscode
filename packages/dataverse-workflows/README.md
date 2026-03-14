# Dataverse Tools: Workflows

Browse and manage your Dataverse process automation from the VS Code sidebar — classic workflows, actions, business rules, business process flows, and modern flows, all in one place.

No more navigating deep into the maker portal just to activate a workflow or trigger it on a specific record.

## What You Can Do

- **Browse all process types** in a single tree, grouped by category
- **Activate and deactivate** workflows without opening the browser
- **Delete draft workflows** with a confirmation prompt — no accidental deletions
- **Trigger on-demand workflows** against a specific Dataverse record by entering the record ID
- **View workflow properties** — open a Properties wizard showing name, category, entity, status, managed state, and dates
- **Open workflow XAML** — view the raw XAML definition of any workflow as a read-only document
- **Filter by solution** — scope the tree to only show workflows that belong to your active solution

---

## Getting Started

1. Install this extension and [Dataverse Tools: Environments](https://marketplace.visualstudio.com/items?itemName=gdhillon.dataverse-environments)
2. Connect to an environment using the Environments extension
3. The **Dataverse Explorer** shows a **Workflows** section — expand it to browse all process types

---

## The Workflows Tree

Workflows are grouped by type so you can find what you're looking for quickly:

```
Workflows
  ► Workflows (Classic)
        Account Follow-Up  [Draft]
        Contact Welcome Email  [Activated]
  ► Actions
        SendNotification
  ► Business Rules
        Require Phone on Lead
  ► Business Process Flows
        Lead to Opportunity
  ► Modern Flows
        Approval Flow
  ► Dialogs
```

- **[Draft]** — the workflow is inactive. Right-click → **Activate** to turn it on.
- **[Activated]** — the workflow is live. Right-click → **Deactivate** to pause it.
- Right-click any item to see actions available for its current state and type.

---

## Viewing Properties and XAML

Right-click any workflow and choose **Properties…** to open a wizard showing the workflow's details — name, category, entity, status, managed state, and creation/modification dates.

Choose **Open** to view the raw XAML definition of the workflow as a read-only document in VS Code. Useful for inspecting the underlying logic of classic workflows and actions.

---

## Triggering an On-Demand Workflow

Classic workflows set to run on-demand can be triggered from the tree:

1. Right-click the workflow and choose **Trigger On-Demand…**
2. Enter the ID of the record to run it against
3. The workflow executes immediately

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
- **Dataverse Tools: Web Resources** — edit and publish web resources
- **Dataverse Tools: Metadata** — browse entity schema in the explorer
- **Dataverse Tools: Decompiler** — read decompiled plugin code from Dataverse
- **Dataverse Tools: Audit Viewer** — view audit history for Dataverse records

---

## Feedback & Community

Found a bug, have a feature request, or want to suggest a new extension?

- **Bug reports & feature requests** — [GitHub Issues](https://github.com/guramrit-dhillon/dataverse-tools-vscode/issues)
- **Questions & discussion** — [GitHub Discussions](https://github.com/guramrit-dhillon/dataverse-tools-vscode/discussions)
