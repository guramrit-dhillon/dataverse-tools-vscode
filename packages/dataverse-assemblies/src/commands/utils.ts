import * as vscode from "vscode";
import {
  type SdkMessageProcessingStep,
  type ExplorerNode,
  type PluginAssembly,
  type PluginType,
  StepMode,
  StepStage,
  StepStateCode,
  StepStatusCode,
  StepSupportedDeployment,
  StepInvocationSource,
  Logger,
  type DeploymentResult,
} from "core-dataverse";

// ── Helpers ──────────────────────────────────────────────────────────────────

export function showDeploymentSummary(result: DeploymentResult): void {
  const { assemblyAction, typesCreated, typesDeleted, stepsDeleted, errors } = result;

  if (errors.length > 0) {
    // Log full details to output channel
    for (const e of errors) {
      Logger.error(`[${e.phase}] ${e.entityName ?? "unknown"}: ${e.message}`);
    }

    const parts = [`Assembly: ${assemblyAction}`];
    if (typesCreated.length > 0) {
      parts.push(`${typesCreated.length} types created`);
    }
    if (typesDeleted.length > 0) { parts.push(`${typesDeleted.length} types deleted`); }
    if (stepsDeleted.length > 0) { parts.push(`${stepsDeleted.length} steps deleted`); }

    vscode.window.showErrorMessage(
      `Deployment completed with ${errors.length} error(s). ${parts.join(". ")}.`,
      "Show Details",
      "Show Output",
    ).then((choice) => {
      if (choice === "Show Details") {
        const detail = errors.map((e) => {
          const name = e.entityName ?? "unknown";
          return `[${e.phase}] ${name}: ${e.message}`;
        }).join("\n\n");
        vscode.window.showErrorMessage(
          `${errors.length} deployment error(s)`,
          { modal: true, detail },
        );
      } else if (choice === "Show Output") {
        Logger.show();
      }
    });
  } else {
    const parts: string[] = [];
    if (typesCreated.length > 0) { parts.push(`+${typesCreated.length} new`); }
    if (typesDeleted.length > 0) { parts.push(`-${typesDeleted.length} deleted`); }
    if (stepsDeleted.length > 0) { parts.push(`-${stepsDeleted.length} steps deleted`); }

    const suffix = parts.length > 0 ? ` ${parts.join(", ")}.` : "";
    vscode.window.showInformationMessage(
      `\u2714 ${result.assemblyName} \u2013 ${assemblyAction}.${suffix}`
    );
  }

  Logger.info("Deployment summary", {
    assembly: result.assemblyName,
    action: result.assemblyAction,
    typesCreated: result.typesCreated,
    typesUnchanged: result.typesUnchanged,
    typesDeleted: result.typesDeleted,
    stepsDeleted: result.stepsDeleted,
    errors: result.errors,
  });
}

export function resolveItem(node: ExplorerNode): { currentName: string; prompt: string } {
  const assembly = node.data?.assembly as PluginAssembly | undefined;
  const pluginType = node.data?.pluginType as PluginType | undefined;
  const step = node.data?.step as SdkMessageProcessingStep | undefined;

  if (node.contextValue === "assembly" && assembly) {
    return { currentName: assembly.name, prompt: "Rename Assembly" };
  }
  if ((node.contextValue === "pluginType" || node.contextValue === "activityType") && pluginType) {
    const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const current = !GUID_RE.test(pluginType.friendlyname)
      ? pluginType.friendlyname
      : pluginType.typename.split(".").pop() ?? pluginType.typename;
    const label = node.contextValue === "activityType" ? "Rename Activity (friendly name)" : "Rename Plugin Type (friendly name)";
    return { currentName: current, prompt: label };
  }
  if (node.contextValue.startsWith("step.") && step) {
    return { currentName: step.name, prompt: "Rename Step" };
  }
  return { currentName: "", prompt: "" };
}

export function defaultStep(_pluginTypeId: string): Partial<SdkMessageProcessingStep> {
  return {
    rank: 1,
    mode: StepMode.Synchronous,
    stage: StepStage.PostOperation,
    invocationsource: StepInvocationSource.Parent,
    supporteddeployment: StepSupportedDeployment.ServerOnly,
    asyncautodelete: false,
    statecode: StepStateCode.Enabled,
    statuscode: StepStatusCode.Enabled,
  };
}

export function withProgress<T>(title: string, task: () => Promise<T>): Promise<T> {
  return Promise.resolve(
    vscode.window.withProgress(
      { location: vscode.ProgressLocation.Window, title },
      () => task()
    )
  );
}
