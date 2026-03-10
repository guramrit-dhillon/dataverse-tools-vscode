# Dataverse Tools: Web Resources

Edit Dataverse web resources like regular files in VS Code — with proper syntax highlighting, Ctrl+S saves directly to Dataverse, and a one-click publish button.

No more downloading a file, editing it locally, uploading it back, then clicking publish in the browser. Open it, edit it, save it. Done.

## What You Can Do

- **Browse all web resources** in a categorized tree — Scripts, Styles, HTML, Images, Data — organized by their Dataverse name path
- **Open any web resource** as a proper editor tab with the correct file extension and syntax highlighting
- **Save to Dataverse with Ctrl+S** — your changes are written back immediately when you save
- **Publish on save** — after each Ctrl+S save, a prompt asks whether to publish now; choose "Not now" to save without publishing
- **Save and Publish in one action** — click the upload button in the editor title bar to skip the prompt and do both at once
- **Filter by solution** — respect your active solution and managed/unmanaged filter set in the explorer

---

## Getting Started

1. Install this extension and [Dataverse Tools: Environments](https://marketplace.visualstudio.com/items?itemName=gdhillon.dataverse-environments)
2. Connect to an environment using the Environments extension
3. In the **Dataverse Explorer**, expand **Web Resources**
4. Expand a category (e.g. Scripts) and click any file to open it

---

## The Web Resources Tree

Web resources are grouped by type, and organized using virtual folders derived from the resource's Dataverse name path:

```
► Web Resources
  ► Scripts
    ► prefix_
      ► utils
        ● helper.js
      ● main.js
  ► Styles
    ● theme.css
  ► HTML
    ● dialog.html
  ► Images
    ► icons
      ● logo.svg
  ► Data
    ● strings.resx
  ► Other
```

Categories are loaded lazily — the tree makes no API calls until you expand a section, so opening it is instant.

---

## Editing and Publishing

Click any text file to open it in a full VS Code editor tab. Edit it as you normally would.

**Ctrl+S** saves your changes to Dataverse. A notification then appears:

- **Publish** — publishes the resource immediately, making it live
- **Not now** — saves without publishing (useful when you're making multiple changes before going live)

The **upload button** (cloud icon) in the editor title bar saves and publishes in a single step with no confirmation prompt — the quickest way to push a change live.

> **Note:** Images and binary files (XAP) appear in the tree but cannot be opened or edited as text.

---

## Supported File Types

| Category | Formats |
|---|---|
| Scripts | JavaScript (.js) |
| Styles | CSS (.css) |
| HTML | Webpage (.html) |
| Images | PNG, JPG, GIF, ICO, SVG |
| Data | XML, XSL, RESX |
| Other | XAP (Silverlight) |

---

## Requirements

- **VS Code** 1.96 or later
- **[Dataverse Tools: Environments](https://marketplace.visualstudio.com/items?itemName=gdhillon.dataverse-environments)** — required for authentication and environment access

---

## Part of Dataverse Tools

This extension is part of the [Dataverse Tools](https://github.com/guramrit-dhillon/dataverse-tools-vscode) suite — a collection of VS Code extensions for Dynamics 365 / Power Platform developers.

Other extensions in the suite:
- **Dataverse Tools: Environments** — connect and manage environments
- **Dataverse Tools: FetchXML Builder** — query the data your web resources work with
- **Dataverse Tools: Query Analyzer** — inspect record data while developing form scripts
