# shared-views

Reusable React component library for Dataverse Tools webviews. Pure browser components with no `vscode` dependency.

## Components

| Component | Description |
|---|---|
| `Autocomplete` | Searchable dropdown with async loading |
| `Badge` | Small status/count indicator |
| `Codicon` | VS Code codicon icon wrapper |
| `DataTable` | Sortable, paginated data table |
| `DateInput` | Date/time input field |
| `EnvironmentBar` | Environment selector header bar |
| `ErrorBanner` | Dismissible error message banner |
| `ErrorBoundary` | React error boundary wrapper |
| `Field` | Labeled form field |
| `FilterField` | Text input with filter/clear behavior |
| `IconButton` | Button with codicon icon |
| `Modal` | Dialog overlay |
| `RadioGroup` | Radio button group |
| `SplitView` | Resizable split pane layout |
| `StatusBar` | Bottom status bar |
| `TabBar` | Tab navigation bar |
| `Toolbar` | Action toolbar with icon buttons |

## Utilities

- `useReducer` — typed reducer hook for webview state management
- `vscode` — VS Code webview API wrapper (`postMessage`, `getState`, `setState`)

## Styles

Each component includes a matching CSS file. Import `panel.css` for base webview styles.

## Usage

Imported directly in extension webview `.tsx` files:

```tsx
import { DataTable, Modal, Toolbar } from "shared-views";
```

## Build

This package has no standalone build step. Components are bundled into each extension's webview output by esbuild.

## Part of Dataverse Tools

This library is part of the [Dataverse Tools](../../README.md) suite for Dynamics 365 / Power Platform plugin developers.
