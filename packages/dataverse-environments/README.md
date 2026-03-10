# Dataverse Tools: Environments

Connect to your Dynamics 365 / Power Platform environments and stay signed in — without ever leaving VS Code. This is the foundation of the Dataverse Tools suite. Every other extension depends on it for authentication and environment access.

Install this first. Set it up once. Everything else just works.

No more re-entering credentials or juggling separate connection tools.

## What You Can Do

- **Connect to environments** using your Microsoft account, Azure CLI, device code, or a service principal
- **Auto-discover your orgs** — the extension browses your tenant's Global Discovery Service so you don't have to remember URLs
- **Switch between environments** instantly — dev, test, and prod in the same sidebar
- **Test your connection** — verify it works and see the response time before you start working
- **Scope the explorer to a solution** — browse only what's inside a specific managed or unmanaged solution
- **Add and remove solution components** directly from the tree, without opening the browser
- **Use with GitHub Copilot** — list environments, get details, or test a connection from Copilot Chat

---

## Getting Started

1. Install this extension — it's required by every other Dataverse Tools extension
2. Open any workspace in VS Code (the extension activates automatically when a `.csproj` file is present)
3. Click the **Dataverse Tools** icon in the Activity Bar to open the explorer
4. Click **Add Environment** and follow the wizard
5. Sign in — the extension handles token refresh automatically from here on

---

## Connecting to an Environment

Click **Add Environment** in the explorer header. The wizard offers two ways to connect:

- **Global Discovery** — signs you in first, then shows all the Dataverse orgs in your tenant grouped by region. Pick one.
- **Custom URL** — paste your org URL directly if you already know it.

After connecting, the environment appears in the explorer. Right-click it at any time to **Edit**, **Remove**, or **Test Connection**.

---

## Authentication Methods

Four methods, set per environment:

| Method | Best for |
|---|---|
| **VS Code** | Most users. Browser-based Microsoft login — same as signing into VS Code itself. Silent re-auth when your session is active. |
| **Azure CLI** | Teams already using `az login`. No additional setup if you're already signed in. |
| **Device Code** | SSH or headless environments where a browser isn't available. |
| **Service Principal** | Automated pipelines and app-based access. Client ID + secret stored securely in your OS keychain — never written to disk. |

Your token is refreshed automatically 60 seconds before it expires. You won't be interrupted mid-work.

---

## The Explorer Tree

The **Dataverse Explorer** sidebar is the shared home for all Dataverse Tools extensions. From here you can:

- **Select an environment** — click the environment picker in the tree header
- **Select a solution** — optionally scope everything to a specific solution
- **Filter the view** — toggle between all components and unmanaged-only
- **Browse what's deployed** — assemblies, entities, workflows, web resources, and more

Each installed extension contributes its own section to the tree. What you see depends on which extensions are installed.

---

## Settings

| Setting | Default | What It Does |
|---|---|---|
| `dataverse-tools.authMethod` | `vscode` | Default auth method pre-selected in the Add Environment wizard |
| `dataverse-tools.logLevel` | `info` | Log verbosity for the output channel (`debug`, `info`, `warn`, `error`) |
| `dataverse-tools.requestTimeoutMs` | `30000` | How long to wait for a Dataverse API response before timing out |

---

## Requirements

- **VS Code** 1.96 or later
- For **Azure CLI** auth: the `az` CLI must be installed and signed in
- For **Service Principal** auth: an Azure AD app registration with Dataverse permissions

---

## Part of Dataverse Tools

This extension is part of the [Dataverse Tools](https://github.com/guramrit-dhillon/dataverse-tools-vscode) suite — a collection of VS Code extensions for Dynamics 365 / Power Platform developers.

Other extensions in the suite:
- **Dataverse Tools: Assemblies** — deploy and register plugin assemblies and steps
- **Dataverse Tools: Trace Viewer** — view and filter plugin trace logs
- **Dataverse Tools: FetchXML Builder** — build and run FetchXML queries
- **Dataverse Tools: Query Analyzer** — query Dataverse with SQL
- **Dataverse Tools: Workflows** — browse and manage process automation
- **Dataverse Tools: Web Resources** — edit and publish web resources
- **Dataverse Tools: Metadata** — browse entity schema in the explorer
- **Dataverse Tools: Decompiler** — read decompiled plugin code from Dataverse

---

## Acknowledgements

Inspired by the connection management in the [Plugin Registration Tool](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/download-tools-nuget) from the Dynamics 365 SDK and [XrmToolBox](https://www.xrmtoolbox.com/).
