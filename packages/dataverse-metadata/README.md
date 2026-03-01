# Dataverse Tools: Explorer

Unified tree view for browsing Dataverse environments, entities, messages, and plugin registrations. Acts as a framework host — other extensions register NodeProviders to contribute their own subtrees.

## Features

- Browse entities, attributes, and SDK messages for a connected environment
- Extensible tree framework — other extensions plug in their own nodes (assemblies, code, etc.)
- Filter between all components and unmanaged-only
- Select and switch between configured environments

## Commands

| Command | Description |
|---|---|
| `Dataverse Tools: Explorer: Select Environment` | Choose which environment to browse |
| `Dataverse Tools: Explorer: Refresh` | Refresh the tree view |
| `Dataverse Tools: Explorer: Show All Components` | Remove unmanaged filter |
| `Dataverse Tools: Explorer: Show Unmanaged Only` | Filter to unmanaged components |

## Dependencies

- **Dataverse Tools: Environments** — required for auth and environment access

## Requirements

- VS Code 1.96+

## Part of Dataverse Tools

This extension is part of the [Dataverse Tools](https://github.com/guramrit-dhillon/dataverse-tools-vscode) suite for Dynamics 365 / Power Platform plugin developers.
