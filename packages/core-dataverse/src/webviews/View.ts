import * as vscode from "vscode";

/**
 * Base class for sidebar WebviewView providers.
 *
 * Mirrors the Panel class API (message routing, init/ready protocol, CSS via esbuild)
 * but adapted for WebviewViewProvider lifecycle — VS Code calls resolveWebviewView()
 * lazily rather than the extension creating the webview directly.
 *
 * Subclasses:
 *  1. Call super(extensionUri, viewType) in constructor
 *  2. Optionally call initListeners() for bidirectional messaging
 *  3. Call setInitPayload() to push data to the webview (replayed on ready)
 *
 * Webview side:
 *  - Send { type: "ready" } on mount → receives { type: "init", payload }
 *  - Send { type: "foo", payload } → handler runs → receives { type: "foo:response" }
 */
export class View implements vscode.WebviewViewProvider {
  readonly #extensionUri: vscode.Uri;
  readonly #name: string;
  #view?: vscode.WebviewView;
  #disposables: vscode.Disposable[] = [];
  #listeners: { [messageType: string]: (payload: any, successCallback: (msg: any) => void, errorCallback: (msg: any) => void) => any } = {};
  #initPayload: any = undefined;

  constructor(
    extensionUri: vscode.Uri,
    viewType: string,
  ) {
    this.#extensionUri = extensionUri;
    this.#name = viewType.split(".").slice(-1)[0] ?? "view";
  }

  protected initListeners(listeners: { [messageType: string]: (payload: any, successCallback: (msg: any) => void, errorCallback: (msg: any) => void) => any }): void {
    this.#listeners = listeners;
  }

  /** Store the payload sent to the webview on `ready`. Also pushes immediately if the view is resolved. */
  protected setInitPayload(payload: any): void {
    this.#initPayload = payload;
    this.#view?.webview.postMessage({ type: "init", payload });
  }

  /** Send an arbitrary message to the webview. */
  protected postMessage(msg: any): void {
    this.#view?.webview.postMessage(msg);
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.#view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.#extensionUri, "out", "views")],
    };
    webviewView.webview.html = this.#buildHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(
      async (msg: { type: string; payload?: any }) => {
        switch (msg.type) {
          case "ready":
            if (this.#initPayload !== undefined) {
              webviewView.webview.postMessage({ type: "init", payload: this.#initPayload });
            }
            break;
          default:
            this.#handleMessage(msg, (response) => {
              webviewView.webview.postMessage({ type: `${msg.type}:response`, payload: response });
            }, (error) => {
              webviewView.webview.postMessage({ type: `${msg.type}:error`, payload: typeof error === "object" && error !== null && "message" in error ? error.message : String(error) });
            });
        }
      },
      undefined,
      this.#disposables
    );
  }

  #handleMessage(msg: { type: string; payload?: any }, successCallback: (msg: any) => void, errorCallback: (msg: any) => void): void {
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

  #buildHtml(webview: vscode.Webview): string {
    const viewsUri = vscode.Uri.joinPath(this.#extensionUri, "out", "views");
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(viewsUri, `${this.#name}.js`));
    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(viewsUri, `${this.#name}.css`));
    const codiconCssUri = webview.asWebviewUri(vscode.Uri.joinPath(viewsUri, "codicon.css"));

    const csp = [
      `default-src 'none'`,
      `style-src ${webview.cspSource}`,
      `font-src ${webview.cspSource}`,
      `script-src ${webview.cspSource}`,
      `connect-src ${webview.cspSource}`,
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
}
