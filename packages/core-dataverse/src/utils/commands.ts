import * as vscode from "vscode";
import { Logger } from "./logger";

/**
 * Register a VS Code command with unified error handling.
 *
 * Catches any thrown error, logs it via Logger, and shows a VS Code error
 * message. Pushes the disposable into `context.subscriptions`.
 */
export function registerCommand(
  context: vscode.ExtensionContext,
  commandId: string,
  handler: (...args: unknown[]) => unknown
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(commandId, async (...args) => {
      try {
        await handler(...args);
      } catch (err) {
        Logger.error(`Command ${commandId} failed`, err);
        vscode.window.showErrorMessage(
          `Command failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    })
  );
}
