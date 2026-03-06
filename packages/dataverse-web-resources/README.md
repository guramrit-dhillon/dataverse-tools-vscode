# Dataverse Tools: Web Resources

Browse, open, edit, and publish Dataverse web resources directly from VS Code — with full syntax highlighting, Ctrl+S save-to-Dataverse, and one-click publish.

## Features

- **Categorized tree view** — web resources grouped by type (Scripts, Styles, HTML, Images, Data, Other) with virtual folder navigation derived from the Dataverse name path
- **Lazy loading** — category contents are only fetched when you expand them; zero API calls on tree open
- **Open as linked document** — clicking a web resource opens it as a proper editor tab with a stable URI, syntax highlighting, and the correct filename in the tab title
- **Save to Dataverse** — Ctrl+S writes the updated content back to Dataverse automatically
- **Publish prompt on save** — after every Ctrl+S save a notification asks whether to publish; dismiss it with "Not now" to save without publishing
- **Save and Publish button** — the `$(cloud-upload)` button in the editor title bar saves and publishes in a single action, skipping the prompt
- **Solution filtering** — respects the active solution and managed/unmanaged filter set in the explorer

## Tree structure

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

## Commands

| Command | Description |
|---|---|
| `Dataverse Tools: Web Resources: Refresh` | Refresh the web resources tree |
| `Dataverse Tools: Web Resources: Open Web Resource` | Open the selected web resource in the editor |
| `Dataverse Tools: Web Resources: Save and Publish` | Save the current document and publish it to Dataverse |

## Supported types

| Category | Types |
|---|---|
| Scripts | JScript (.js) |
| Styles | Stylesheet (.css) |
| HTML | Webpage (.html) |
| Images | PNG, JPG, GIF, ICO, SVG |
| Data | XML, XSL, RESX |
| Other | XAP (Silverlight) |

> **Note:** Binary types (Images, XAP) are displayed in the tree but cannot be opened as text.

## Dependencies

- **Dataverse Tools: Environments** — required for auth and environment access

## Requirements

- VS Code 1.96+

## Part of Dataverse Tools

This extension is part of the [Dataverse Tools](https://github.com/guramrit-dhillon/dataverse-tools-vscode) suite for Dynamics 365 / Power Platform plugin developers.
