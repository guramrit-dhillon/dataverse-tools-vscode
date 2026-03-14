# Dataverse Tools: Assemblies

Deploy and manage Dynamics 365 / Power Platform plugins without leaving VS Code. Build your code, deploy it, configure your steps and images — all from the sidebar.

No more switching to XrmToolBox or the legacy Plugin Registration Tool.

## What You Can Do

- **Deploy plugin assemblies** to Dataverse directly after a build — with a single click
- **Smart re-deployment** — only uploads when your code has actually changed
- **Register and configure plugin steps** — choose the message, entity, stage, mode, execution order, and filtering rules through a guided wizard
- **Attach entity images** to steps (pre- and post-operation snapshots of record data)
- **Enable or disable steps** on the fly without losing your configuration
- **Download assemblies** back from Dataverse to your local machine
- **Rename or delete** assemblies, plugin types, and steps
- **View trace logs** for any assembly or plugin type (requires Dataverse Tools: Trace Viewer)
- **Manage workflow activities** alongside plugins in the same tree

---

## Getting Started

1. Install this extension and [Dataverse Tools: Environments](https://marketplace.visualstudio.com/items?itemName=gdhillon.dataverse-environments)
2. Open your plugin project folder in VS Code (must contain a `.csproj` file)
3. Sign in to your environment using the Environments extension
4. Build your project — you'll be prompted to deploy automatically

---

## The Assemblies Tree

The **Dataverse Explorer** sidebar shows all your registered assemblies in a tree:

```
Assemblies
  MyPlugin  (v1.2.0)
    Plugins  (2)
      MyPlugin.AccountHandler
        ⚡ Create: account
        ⏸ Update: contact  (disabled)
           PreImage
    Workflow Activities  (1)
      MyPlugin.SendNotificationActivity
```

- **⚡** — Step is active and will execute
- **⏸** — Step is registered but disabled (won't execute)
- Expand any node to see its children
- Right-click any node to see available actions

Use the **eye** icon in the Assemblies header to show or hide managed assemblies (those that came in via a solution).

---

## Deploying a Plugin Assembly

Right-click the **Assemblies** group (or any existing assembly) and choose **Deploy Assembly**.

The wizard walks you through:

1. **Pick an environment** — if you have more than one connected
2. **Pick the DLL** — the extension finds `.dll` files in your workspace automatically
3. **Select types to deploy** — a list of all plugin classes and workflow activities found in the DLL:
   - Items marked **new** will be created fresh
   - Items marked **registered** are already on the server and will be updated if your code changed
   - Items in the **Removed from Assembly** section exist on the server but are no longer in your DLL — you can choose to delete them
4. **Pick an activity group** — only shown if you're deploying workflow activities; groups help organise them in Dataverse
5. **Deployment runs** with a live progress message

> **Smart upload:** The extension compares a hash of your DLL to what's on the server. If nothing changed, the upload is skipped — saving time on large assemblies.
>
> **Your steps are safe:** Re-deploying never removes existing step registrations. Only the assembly and type records are updated.

After deployment, the tree refreshes and your new types appear automatically.

---

## Registering a Plugin Step

Right-click a **plugin type** in the tree and choose **Add Step**.

The step wizard guides you through each setting on its own screen. You see a summary at all times and can jump to any field to change it:

| Setting | What It Means |
|---|---|
| **Message** | The Dataverse operation that triggers your plugin (e.g. Create, Update, Delete) |
| **Entity** | The record type the plugin fires on (e.g. Account, Contact) — or "any entity" |
| **Stage** | *When* in the operation your plugin runs: Pre-Validation, Pre-Operation, or Post-Operation |
| **Mode** | *How* it runs: Synchronous (inside the transaction) or Asynchronous (background job) |
| **Rank** | Execution order when multiple plugins fire on the same event (lower = earlier) |
| **Filtering Attributes** | For Update steps only — which field changes should trigger the plugin (leave empty for any change) |
| **Name** | A label for this step; auto-generated if you leave it blank |
| **Unsecure Config** | Plain-text configuration your plugin can read at runtime |
| **Secure Config** | Encrypted configuration (stored securely in Dataverse) |

> **Constraint:** Asynchronous steps must run at Post-Operation. The wizard automatically adjusts if you set a conflicting combination.

Once you confirm, the step is created and appears in the tree under your plugin type.

---

## Editing a Step

Right-click any step and choose **Edit Step** to open the same wizard pre-filled with the current values. Change any field and save.

You can also edit individual fields directly without opening the full wizard:

| Right-click option | What it edits |
|---|---|
| **Edit Unsecure Config…** | Opens the config in a VS Code editor tab — save with Ctrl+S to push to Dataverse |
| **Edit Secure Config…** | Same, for the encrypted config |
| **Edit Description…** | Same, for the step description |

---

## Enable and Disable Steps

Right-click a step to **Enable** or **Disable** it. The icon changes in the tree:
- **⚡** = active
- **⏸** = disabled

Disabling a step suspends it without losing any settings. Useful for turning off a step during testing without deleting it.

---

## Entity Images

Entity images let your plugin access a *snapshot* of a record's data — either what it looked like **before** the operation (Pre-Image) or **after** (Post-Image).

Right-click a **step** and choose **Register Image**. The image wizard asks for:

| Setting | What It Means |
|---|---|
| **Image Type** | Pre-Image, Post-Image, or Both |
| **Name** | A label for this image (e.g. "PreImage") |
| **Entity Alias** | The key your plugin code uses to look up this image (e.g. `"preEntity"`) |
| **Message Property** | Which part of the operation message to snapshot (defaults to "Target") |
| **Attributes** | Specific fields to include — leave empty to include all fields |

> **Note:** Available image types depend on the step's message and stage. For example, Create steps can only have a Post-Image (there is no "before" for a new record).

Right-click an existing image to **Edit Image** or **Unregister Image**.

---

## Workflow Activities

Workflow activities appear in their own **Workflow Activities** group under each assembly, separate from plugins.

They can't have steps registered against them (they're triggered by workflows, not Dataverse events). You can:

- **Change Activity Group** — organises activities into named groups in the Dataverse UI
- **Rename** or **Delete** them like any other node

---

## Downloading an Assembly

Right-click any assembly and choose **Download Assembly**. Pick a save location — the `.dll` is downloaded from Dataverse to your local disk.

> Only works for assemblies stored in the database (the default for most plugin projects). Disk-based assemblies have no downloadable content.

---

## Viewing Trace Logs

Right-click an assembly or plugin type and choose **View Trace Logs…** to open the trace viewer filtered to that plugin.

Requires the **Dataverse Tools: Trace Viewer** extension. If it's not installed, you'll be offered a link to the marketplace.

---

## Auto-Deploy After Build

When you run a build task in VS Code and it succeeds, the extension will ask:

> "Build succeeded. Deploy plugin assembly to Dataverse?"

Click **Deploy** to go straight to the deploy flow. Click **Not now** to skip.

Turn this off in Settings: **`dataverse-tools.deployOnBuild`** → `false`.

---

## Settings

| Setting | Default | What It Does |
|---|---|---|
| `dataverse-tools.analyzerPath` | *(empty)* | Path to a custom .NET analyzer tool. Leave empty to use the bundled one. |
| `dataverse-tools.deployOnBuild` | `true` | Show a deploy prompt after a successful build task |

---

## Requirements

- **VS Code** 1.96 or later
- **[Dataverse Tools: Environments](https://marketplace.visualstudio.com/items?itemName=gdhillon.dataverse-environments)** — required for authentication and environment selection
- **.NET 8 runtime** — used by the bundled assembly analyzer to inspect your DLL

---

## Part of Dataverse Tools

This extension is part of the [Dataverse Tools](https://github.com/guramrit-dhillon/dataverse-tools-vscode) suite — a collection of VS Code extensions for Dynamics 365 / Power Platform plugin developers.

Other extensions in the suite:
- **Dataverse Tools: Environments** — connect and manage environments
- **Dataverse Tools: Trace Viewer** — view and filter plugin trace logs
- **Dataverse Tools: FetchXML Builder** — build and run FetchXML queries
- **Dataverse Tools: Query Analyzer** — query Dataverse with SQL
- **Dataverse Tools: Workflows** — browse and manage process automation
- **Dataverse Tools: Web Resources** — edit and publish web resources
- **Dataverse Tools: Metadata** — browse entity schema in the explorer
- **Dataverse Tools: Decompiler** — read decompiled plugin code from Dataverse
- **Dataverse Tools: Audit Viewer** — view audit history for Dataverse records

---

## Acknowledgements

Inspired by the [Plugin Registration Tool](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/download-tools-nuget) from the Dynamics 365 SDK and the [XrmToolBox](https://www.xrmtoolbox.com/) community.

---

## Feedback & Community

Found a bug, have a feature request, or want to suggest a new extension?

- **Bug reports & feature requests** — [GitHub Issues](https://github.com/guramrit-dhillon/dataverse-tools-vscode/issues)
- **Questions & discussion** — [GitHub Discussions](https://github.com/guramrit-dhillon/dataverse-tools-vscode/discussions)
