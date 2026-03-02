# Dataverse Tools: Workflows

Browse and manage Dataverse workflow processes directly from VS Code. Supports classic workflows, actions, business process flows, business rules, dialogs, and modern flows.

## Features

- Browse all process types grouped by category in the Dataverse Explorer tree
- Activate and deactivate workflows
- Delete draft workflows (with confirmation)
- Trigger on-demand classic workflows against a specific record
- View workflow details (name, category, entity, status, managed state, dates)
- Solution-aware filtering — see which workflows belong to a selected solution

## Commands

| Command | Description |
|---|---|
| `Dataverse Tools: Workflows: Activate` | Activate a draft workflow |
| `Dataverse Tools: Workflows: Deactivate` | Deactivate an activated workflow |
| `Dataverse Tools: Workflows: Delete` | Delete a draft workflow |
| `Dataverse Tools: Workflows: Trigger On-Demand…` | Execute a classic workflow against a record |

## Dependencies

- **Dataverse Tools: Environments** — required for auth and environment access

## Requirements

- VS Code 1.96+

## Part of Dataverse Tools

This extension is part of the [Dataverse Tools](https://github.com/guramrit-dhillon/dataverse-tools-vscode) suite for Dynamics 365 / Power Platform plugin developers.
