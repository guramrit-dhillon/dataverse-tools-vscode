// acquireVsCodeApi is a global function injected by the VS Code webview runtime.
// We declare the type locally instead of importing 'vscode-webview' to prevent
// esbuild from generating a require() call that fails in the browser/webview context.
declare const acquireVsCodeApi: () => {
  postMessage(msg: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

const vscode = acquireVsCodeApi();
export default vscode;