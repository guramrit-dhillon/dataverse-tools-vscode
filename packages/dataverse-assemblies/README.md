# Dataverse Tools: Assemblies

Code-centric Dataverse assembly deployment and step management. Deploy plugin assemblies, register steps, manage images, and control step state — all from VS Code.

## Features

- **Deploy assemblies** directly from VS Code after a successful build
- **Differential deployment** — only uploads when the assembly hash has changed
- **Register and manage plugin steps** with full configuration (message, entity, stage, mode, filtering attributes)
- **Manage step images** (pre/post entity image snapshots)
- **Enable/disable steps** without deleting registrations
- **Download assemblies** from Dataverse back to local disk
- **Rename and delete** assemblies, plugin types, and steps
- **Auto-deploy prompt** after successful build tasks

## Commands

| Command | Description |
|---|---|
| `Dataverse Tools: Assemblies: Deploy Assembly` | Deploy a plugin assembly to Dataverse |
| `Dataverse Tools: Assemblies: Download Assembly` | Download an assembly from Dataverse |
| `Dataverse Tools: Assemblies: Add Step` | Register a new plugin step |
| `Dataverse Tools: Assemblies: Edit Step` | Edit an existing step's configuration |
| `Dataverse Tools: Assemblies: Enable Step` | Enable a disabled step |
| `Dataverse Tools: Assemblies: Disable Step` | Disable a step without deleting it |
| `Dataverse Tools: Assemblies: Manage Images` | Configure pre/post entity images on a step |
| `Dataverse Tools: Assemblies: Rename...` | Rename an assembly, plugin type, or step |
| `Dataverse Tools: Assemblies: Delete` | Delete an assembly, plugin type, or step |

## Settings

| Setting | Default | Description |
|---|---|---|
| `dataverse-tools.analyzerPath` | `""` | Path to the .NET analyzer tool. Empty uses the bundled analyzer |
| `dataverse-tools.deployOnBuild` | `true` | Prompt to deploy after a successful build task |

## Dependencies

- **Dataverse Tools: Environments** — required for auth and environment access
- **Dataverse Tools: Explorer** — required for the unified tree view

## Requirements

- VS Code 1.96+
- .NET 8 runtime (for the bundled assembly analyzer)

## Acknowledgements

Inspired by the [Plugin Registration Tool](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/download-tools-nuget) from the Dynamics 365 SDK and its [XrmToolBox](https://www.xrmtoolbox.com/) counterpart.

## Part of Dataverse Tools

This extension is part of the [Dataverse Tools](https://github.com/guramrit-dhillon/dataverse-tools-vscode) suite for Dynamics 365 / Power Platform plugin developers.
