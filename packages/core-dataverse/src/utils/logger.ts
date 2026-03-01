import * as vscode from "vscode";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Structured logger that writes to a dedicated VS Code Output Channel.
 * Log level is read from workspace configuration on every call so live
 * changes take effect without restarting the extension.
 *
 * Usage:
 *   Logger.info("Deploying assembly", { name: "MyPlugin", version: "1.0.0.0" });
 */
export class Logger {
  private static channel: vscode.OutputChannel | undefined;

  static init(channel: vscode.OutputChannel): void {
    Logger.channel = channel;
  }

  static debug(message: string, context?: object): void {
    Logger.write("debug", message, context);
  }

  static info(message: string, context?: object): void {
    Logger.write("info", message, context);
  }

  static warn(message: string, context?: object): void {
    Logger.write("warn", message, context);
  }

  static error(message: string, err?: unknown): void {
    const detail = err instanceof Error
      ? { message: err.message, stack: err.stack }
      : err !== undefined
        ? { raw: String(err) }
        : undefined;
    Logger.write("error", message, detail);
  }

  private static write(level: LogLevel, message: string, context?: object): void {
    const configured = vscode.workspace
      .getConfiguration("dataverse-tools")
      .get<LogLevel>("logLevel", "info");

    if (LEVEL_RANK[level] < LEVEL_RANK[configured]) {
      return;
    }

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase().padEnd(5)}] `;
    const line = context
      ? `${prefix}${message} ${JSON.stringify(context)}`
      : `${prefix}${message}`;

    Logger.channel?.appendLine(line);

    if (level === "error") {
      console.error(line);
    }
  }

  /** Show the output panel to the user. */
  static show(): void {
    Logger.channel?.show(true);
  }
}
