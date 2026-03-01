# Dataverse Tools: Trace Viewer

View and analyze plugin execution trace logs from Dataverse, directly in VS Code.

## Features

- **Search and filter** trace logs by plugin type, message name, entity name, correlation ID, and date range
- **Exceptions-only mode** — quickly isolate failed executions
- **Autocomplete suggestions** — filter dropdowns are populated with distinct plugin types, messages, and entities from your environment
- **Detailed execution logs** — view exception details, execution context, and timing information
- **Multi-instance panels** — open separate trace log panels per environment
- **Launch from Explorer** — right-click an assembly or plugin type in the tree to open trace logs pre-filtered to that item
- **Launch from Environments** — right-click an environment to open its trace logs
- **Change environment** — switch the target environment from the editor tab context menu
- **Configurable result limit** — retrieve up to 5,000 trace log records per query

## Commands

| Command | Description |
|---|---|
| `Dataverse Tools: Trace Viewer: View Trace Logs…` | Open the trace log viewer |
| `Dataverse Tools: Trace Viewer: Change Environment` | Switch environment on the active panel (editor tab context menu) |

## Dependencies

- **Dataverse Tools: Environments** — required for authentication and environment access

## Requirements

- VS Code 1.96+

## Acknowledgements

Inspired by the [Plugin Trace Viewer](https://www.xrmtoolbox.com/) for XrmToolBox.

## Part of Dataverse Tools

This extension is part of the [Dataverse Tools](../../README.md) suite for Dynamics 365 / Power Platform plugin developers.
