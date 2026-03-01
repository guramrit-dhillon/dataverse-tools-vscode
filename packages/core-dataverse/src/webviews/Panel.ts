import * as vscode from "vscode";

export class Panel {
  readonly #panel: vscode.WebviewPanel;
  readonly #extensionUri: vscode.Uri;
  readonly #name: string;
  #disposables: vscode.Disposable[] = [];
  #disposed = false;
  #listeners: { [messageType: string]: (payload: any, successCallback: (msg: any) => void, errorCallback: (msg: any) => void) => any } = {};
  // Always reflects the most recent data sent to the webview, so the ready
  // handler can replay it even if the webview reloads after activate() was called.
  #latestOptions: any = undefined;

  #allowInlineStyles: boolean;

  constructor(
    extensionUri: vscode.Uri,
    viewType: string,
    title: string,
    options?: any,
    config?: { allowInlineStyles?: boolean; iconPath?: vscode.Uri | { light: vscode.Uri; dark: vscode.Uri } },
  ) {
    this.#extensionUri = extensionUri;
    this.#name = viewType.split(".").slice(-1)[0] ?? "panel";
    this.#latestOptions = options;
    this.#allowInlineStyles = config?.allowInlineStyles ?? false;
    this.#panel = vscode.window.createWebviewPanel(
      viewType,
      title,
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "out", "views")],
        retainContextWhenHidden: true,
      }
    );
    if (config?.iconPath) {
      this.#panel.iconPath = config.iconPath;
    }
    this.#panel.webview.html = this.buildHtml();

    this.#panel.onDidDispose(() => this.dispose(), undefined, this.#disposables);

    this.#panel.webview.onDidReceiveMessage(
      async (msg: { type: string, payload?: any }) => {
        switch (msg.type) {
          case "ready":
            this.#panel.webview.postMessage({ type: "init", payload: this.#latestOptions });
            break;
          default:
            this.#handleMessage(msg, (response) => {
              this.#panel.webview.postMessage({ type: `${msg.type}:response`, payload: response });
            }, (error) => {
              this.#panel.webview.postMessage({ type: `${msg.type}:error`, payload: typeof error === "object" && error !== null && "message" in error ? error.message : String(error) });
            });
        }
      },
      undefined,
      this.#disposables
    );
  }

  protected initListeners(listeners: { [messageType: string]: (payload: any, successCallback: (msg: any) => void, errorCallback: (msg: any) => void) => any }): void {
    this.#listeners = listeners;
  }

  protected activate(title: string, options?: any): void {
    this.#latestOptions = options;
    this.#panel.title = title;
    this.#panel.reveal();
    this.#panel.webview.postMessage({ type: "init", payload: this.#latestOptions });
  }

  /** Whether the panel is currently visible to the user. */
  get visible(): boolean {
    return this.#panel.visible;
  }

  /** Update the panel's tab title without re-sending init or revealing. */
  protected setTitle(title: string): void {
    this.#panel.title = title;
  }

  /** Send an arbitrary message to the webview (e.g. push notifications). */
  protected postMessage(msg: any): void {
    this.#panel.webview.postMessage(msg);
  }

  #handleMessage(msg: { type: string, payload?: any }, successCallback: (msg: any) => void, errorCallback: (msg: any) => void): void {
    const handler = this.#listeners[msg.type];
    if (handler) {
      try {
        let successCalled = false;
        let errorCalled = false;
        const successCallbackWrapper = (response: any) => {
          if (!successCalled && !errorCalled) {
            successCalled = true;
            successCallback(response);
          }
        };
        const errorCallbackWrapper = (error: any) => {
          if (!successCalled && !errorCalled) {
            errorCalled = true;
            errorCallback(error);
          }
        };
        const result = handler(msg.payload, successCallbackWrapper, errorCallbackWrapper);
        if (result instanceof Promise) {
          result.then(successCallbackWrapper).catch(errorCallbackWrapper);
        } else {
          successCallbackWrapper(result);
        }
      } catch (err) {
        errorCallback(err instanceof Error ? { message: err.message } : err);
      }
    }
  }

  #resolvePath(path: string): vscode.Uri {
    return this.#panel.webview.asWebviewUri(vscode.Uri.joinPath(this.#extensionUri, "out", "views", path));
  }

  private buildHtml(): string {
    const scriptUri = this.#resolvePath(`${this.#name}.js`);
    const cssUri = this.#resolvePath(`${this.#name}.css`);
    const codiconCssUri = this.#resolvePath("codicon.css");

    const csp = [
      `default-src 'none'`,
      `style-src ${this.#panel.webview.cspSource}${this.#allowInlineStyles ? " 'unsafe-inline'" : ""}`,
      `font-src ${this.#panel.webview.cspSource}`,
      `script-src ${this.#panel.webview.cspSource}`,
      `connect-src ${this.#panel.webview.cspSource}`,
    ].join("; ");

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.#name}</title>
  <link rel="stylesheet" href="${codiconCssUri}">
  <link rel="stylesheet" href="${cssUri}">
</head>
<body>
  <div id="root"></div>
  <script src="${scriptUri}"></script>
</body>
</html>`;
  }

  protected dispose(): void {
    if (this.#disposed) { return; }
    this.#disposed = true;
    this.#panel.dispose();
    for (const d of this.#disposables) { d.dispose(); }
    this.#disposables = [];
  }
}
