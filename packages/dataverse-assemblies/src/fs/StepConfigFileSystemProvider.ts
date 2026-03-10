import * as vscode from "vscode";
import {
  type DataverseEnvironment,
  type SdkMessageProcessingStep,
  Logger,
} from "core-dataverse";
import { type IRegistrationService } from "../interfaces/IRegistrationService";

type ConfigType = "unsecure" | "secure" | "description";

interface ConfigSession {
  env: DataverseEnvironment;
  step: SdkMessageProcessingStep;
  configType: ConfigType;
  registrationSvc: IRegistrationService;
  content: Uint8Array;
}

/**
 * Virtual file system provider for Dataverse step configs.
 *
 * Registers the `dataverse-step-config:` URI scheme so VS Code treats
 * step configuration as a real file: proper tab title, JSON highlighting,
 * and Ctrl+S saves content back to Dataverse.
 *
 * URI format:
 *   dataverse-step-config:/{encodedEnvId}/{stepId}/{configType}.json   (configs)
 *   dataverse-step-config:/{encodedEnvId}/{stepId}/description.txt     (description)
 */
export class StepConfigFileSystemProvider implements vscode.FileSystemProvider {
  static readonly SCHEME = "dataverse-step-config";

  private readonly _onDidChangeFile = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  readonly onDidChangeFile = this._onDidChangeFile.event;

  /** Active sessions keyed by URI string. */
  private readonly sessions = new Map<string, ConfigSession>();

  // ── URI helpers ────────────────────────────────────────────────────────────

  static buildUri(envId: string, stepId: string, configType: ConfigType): vscode.Uri {
    const ext = configType === "description" ? "txt" : "json";
    return vscode.Uri.from({
      scheme: StepConfigFileSystemProvider.SCHEME,
      path: `/${encodeURIComponent(envId)}/${stepId}/${configType}.${ext}`,
    });
  }

  static parseUri(uri: vscode.Uri): { envId: string; stepId: string; configType: ConfigType } | undefined {
    const parts = uri.path.split("/").filter(Boolean);
    if (parts.length < 3) { return undefined; }
    const filename = parts[2]; // e.g. "unsecure.json", "secure.json", "description.txt"
    let configType: ConfigType;
    if (filename.startsWith("secure")) { configType = "secure"; }
    else if (filename.startsWith("description")) { configType = "description"; }
    else { configType = "unsecure"; }
    return {
      envId: decodeURIComponent(parts[0]),
      stepId: parts[1],
      configType,
    };
  }

  // ── Session management ─────────────────────────────────────────────────────

  /**
   * Register a step config session before opening the URI in an editor.
   * Returns the URI that should be passed to showTextDocument.
   */
  open(
    env: DataverseEnvironment,
    step: SdkMessageProcessingStep,
    configType: ConfigType,
    registrationSvc: IRegistrationService,
  ): vscode.Uri {
    const envId = env.id ?? env.orgUrl;
    const stepId = step.sdkmessageprocessingstepid!;
    const uri = StepConfigFileSystemProvider.buildUri(envId, stepId, configType);

    const currentValue =
      configType === "secure" ? (step.secureconfig ?? "") :
      configType === "description" ? (step.description ?? "") :
      (step.configuration ?? "");
    const content = Buffer.from(currentValue, "utf8");

    this.sessions.set(uri.toString(), {
      env,
      step,
      configType,
      registrationSvc,
      content: new Uint8Array(content.buffer, content.byteOffset, content.byteLength),
    });

    return uri;
  }

  // ── FileSystemProvider ─────────────────────────────────────────────────────

  watch(): vscode.Disposable {
    return new vscode.Disposable(() => { /* no-op */ });
  }

  stat(uri: vscode.Uri): vscode.FileStat {
    const session = this.sessions.get(uri.toString());
    const now = Date.now();
    return {
      type: vscode.FileType.File,
      ctime: now,
      mtime: now,
      size: session?.content.byteLength ?? 0,
    };
  }

  readDirectory(): never {
    throw vscode.FileSystemError.NoPermissions("Directories not supported");
  }

  createDirectory(): never {
    throw vscode.FileSystemError.NoPermissions("Directories not supported");
  }

  readFile(uri: vscode.Uri): Uint8Array {
    const session = this.sessions.get(uri.toString());
    if (!session) { throw vscode.FileSystemError.FileNotFound(uri); }
    return session.content;
  }

  async writeFile(
    uri: vscode.Uri,
    content: Uint8Array,
    _options: { readonly create: boolean; readonly overwrite: boolean },
  ): Promise<void> {
    const session = this.sessions.get(uri.toString());
    if (!session) { throw vscode.FileSystemError.FileNotFound(uri); }

    const newValue = Buffer.from(content).toString("utf8").trim();
    const label =
      session.configType === "secure" ? "Secure Config" :
      session.configType === "description" ? "Description" :
      "Unsecure Config";

    const updatedStep: SdkMessageProcessingStep = {
      ...session.step,
      ...(session.configType === "secure"
        ? { secureconfig: newValue || undefined }
        : session.configType === "description"
          ? { description: newValue || undefined }
          : { configuration: newValue || undefined }),
    };

    try {
      await session.registrationSvc.upsertStep(session.env, updatedStep);
      // Update in-memory step so subsequent saves see the latest value
      session.step = updatedStep;
      session.content = content;
      this._onDidChangeFile.fire([{ type: vscode.FileChangeType.Changed, uri }]);
      vscode.window.showInformationMessage(`${label} saved for "${session.step.name}".`);
    } catch (err) {
      Logger.error(`Failed to save ${label}`, err);
      throw vscode.FileSystemError.Unavailable(
        `Failed to save ${label}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  delete(uri: vscode.Uri): void {
    this.sessions.delete(uri.toString());
  }

  rename(): never {
    throw vscode.FileSystemError.NoPermissions("Rename not supported");
  }
}
