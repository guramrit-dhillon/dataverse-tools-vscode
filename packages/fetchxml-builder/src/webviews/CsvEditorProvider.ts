import * as vscode from "vscode";

export class CsvEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = "dataverse-tools.csvViewer";

  constructor(private readonly extensionUri: vscode.Uri) {}

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    const webview = webviewPanel.webview;
    webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "out", "views")],
    };

    webview.html = this.buildHtml(webview);

    const onReady = webview.onDidReceiveMessage((msg) => {
      if (msg.type === "ready") {
        webview.postMessage({
          type: "init",
          payload: { content: document.getText() },
        });
      }
    });

    const onDocChange = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() === document.uri.toString()) {
        webview.postMessage({
          type: "documentChanged",
          payload: { content: document.getText() },
        });
      }
    });

    webviewPanel.onDidDispose(() => {
      onReady.dispose();
      onDocChange.dispose();
    });
  }

  private resolvePath(webview: vscode.Webview, file: string): vscode.Uri {
    return webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "out", "views", file)
    );
  }

  private buildHtml(webview: vscode.Webview): string {
    const scriptUri = this.resolvePath(webview, "csvViewer.js");
    const cssUri = this.resolvePath(webview, "csvViewer.css");
    const codiconCssUri = this.resolvePath(webview, "codicon.css");

    const csp = [
      `default-src 'none'`,
      `style-src ${webview.cspSource}`,
      `font-src ${webview.cspSource}`,
      `script-src ${webview.cspSource}`,
    ].join("; ");

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CSV Viewer</title>
  <link rel="stylesheet" href="${codiconCssUri}">
  <link rel="stylesheet" href="${cssUri}">
</head>
<body>
  <div id="root"></div>
  <script src="${scriptUri}"></script>
</body>
</html>`;
  }
}
