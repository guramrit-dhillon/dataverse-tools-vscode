# Dataverse Tools: Trace Viewer

See exactly what your plugins did — every execution, every exception, every input and output — without leaving VS Code.

When a plugin behaves unexpectedly, you need answers fast. Right-click an assembly or plugin type in the explorer tree, open the trace viewer, and you're already filtered to that plugin. No forms to fill out, no connections to configure.

No more opening XrmToolBox just to check a trace log.

## What You Can Do

- **Search trace logs** by plugin type, message name, entity, correlation ID, or date range
- **Show only exceptions** — one toggle to hide successful executions and focus on failures
- **Read the full picture** for any execution — exception message, stack trace, execution context, timing, and any messages your plugin logged with `ITracingService`
- **Open from the tree** — right-click any assembly or plugin type and choose **View Trace Logs…** to open pre-filtered to that plugin
- **Open from an environment** — right-click an environment to browse all its trace logs at once
- **Run multiple panels** — open separate trace viewers for different environments or plugins side by side
- **Switch environments** on an open panel without closing and re-opening it
- **Control the result size** — retrieve up to 5,000 trace log records per query

---

## Getting Started

1. Install this extension and [Dataverse Tools: Environments](https://marketplace.visualstudio.com/items?itemName=gdhillon.dataverse-environments)
2. Make sure trace logging is enabled in your Dataverse environment *(Settings → Administration → System Settings → Customisation → Enable Plug-in and custom workflow activity tracing)*
3. Right-click an assembly or plugin type in the explorer tree and choose **View Trace Logs…**
   — or open the command palette and run **Dataverse Tools: Trace Viewer: View Trace Logs…**

---

## Reading Trace Logs

The trace viewer opens as an editor panel with a filter bar at the top and a results table below.

**Filters:**

| Filter | What it narrows |
|---|---|
| **Plugin Type** | The specific plugin class that ran |
| **Message** | The Dataverse operation that triggered it (Create, Update, Delete, etc.) |
| **Entity** | The record type the plugin fired on |
| **Correlation ID** | Group all plugins that ran as part of a single request |
| **Date Range** | Limit results to a specific time window |
| **Exceptions Only** | Show only executions that threw an error |

**Each row in the results shows:**
- Plugin type, message, and entity
- Execution status — Success or Failure
- Duration
- Timestamp

**Expand any row** to see the full details: the exception message and stack trace if it failed, the full serialised plugin execution context, and any trace messages your plugin wrote.

---

## Requirements

- **VS Code** 1.96 or later
- **[Dataverse Tools: Environments](https://marketplace.visualstudio.com/items?itemName=gdhillon.dataverse-environments)** — required for authentication and environment access
- Trace logging must be enabled on your Dataverse environment

---

## Part of Dataverse Tools

This extension is part of the [Dataverse Tools](https://github.com/guramrit-dhillon/dataverse-tools-vscode) suite — a collection of VS Code extensions for Dynamics 365 / Power Platform developers.

Other extensions in the suite:
- **Dataverse Tools: Environments** — connect and manage environments
- **Dataverse Tools: Assemblies** — deploy and register plugin assemblies and steps
- **Dataverse Tools: FetchXML Builder** — build and run FetchXML queries
- **Dataverse Tools: Query Analyzer** — query Dataverse with SQL
- **Dataverse Tools: Workflows** — browse and manage process automation
- **Dataverse Tools: Web Resources** — edit and publish web resources
- **Dataverse Tools: Metadata** — browse entity schema in the explorer
- **Dataverse Tools: Decompiler** — read decompiled plugin code from Dataverse
- **Dataverse Tools: Audit Viewer** — view audit history for Dataverse records

---

## Acknowledgements

Inspired by the [Plugin Trace Viewer](https://www.xrmtoolbox.com/) for XrmToolBox.

---

## Feedback & Community

Found a bug, have a feature request, or want to suggest a new extension?

- **Bug reports & feature requests** — [GitHub Issues](https://github.com/guramrit-dhillon/dataverse-tools-vscode/issues)
- **Questions & discussion** — [GitHub Discussions](https://github.com/guramrit-dhillon/dataverse-tools-vscode/discussions)
