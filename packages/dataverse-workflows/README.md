# Dataverse Tools: Workflows

Browse and manage your Dataverse process automation from the VS Code sidebar — classic workflows, actions, business rules, business process flows, and modern flows, all in one place.

No more navigating deep into the maker portal just to activate a workflow or trigger it on a specific record.

## What You Can Do

- **Browse all process types** in a single tree, grouped by category
- **Activate and deactivate** workflows without opening the browser
- **Delete draft workflows** with a confirmation prompt — no accidental deletions
- **Trigger on-demand workflows** against a specific Dataverse record by entering the record ID
- **View workflow details** — name, category, entity, status, managed state, and dates
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
- **Dataverse Tools: Assemblies** — manage the plugins that your workflows might call as custom steps
