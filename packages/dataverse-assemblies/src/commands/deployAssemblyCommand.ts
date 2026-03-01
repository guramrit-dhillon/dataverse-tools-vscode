import * as path from "node:path";
import {
  type DataverseAccountApi,
  type DataverseEnvironment,
  type PluginType,
  type SdkMessageProcessingStep,
  type AssemblyAnalysisResult,
  type DeploymentResult,
  Logger,
} from "core-dataverse";
import * as vscode from "vscode";
import { type IAssemblyAnalyzer } from "../interfaces/IAssemblyAnalyzer";
import { type IRegistrationService } from "../interfaces/IRegistrationService";
import { showDeploymentSummary } from "./utils";

const LAST_PICKED_DIR_KEY = "deployAssembly.lastPickedDir";

/**
 * Core deployment command.
 *
 * Flow:
 *  1. Resolve active environment (prompt via dataverse-environments if not set)
 *  2. Locate assembly (workspace scan → file picker fallback)
 *  3. Analyze assembly with .NET CLI tool
 *  4. Show type picker (plugins, activities, removed types)
 *  5. Run differential deployment
 *  6. Refresh tree and show summary
 */

export async function deployAssemblyCommand(
  api: DataverseAccountApi,
  analyzer: IAssemblyAnalyzer,
  registrationSvc: IRegistrationService,
  onRefresh: () => void,
  env: DataverseEnvironment | undefined,
  assemblyPathOverride?: string,
  state?: vscode.Memento,
): Promise<void> {
  // ── Resolve environment ────────────────────────────────────────────────────
  if (!env) {
    const result = await api.pickEnvironment();
    if (!result) { return; }
    env = result.environment;
  }

  // ── Resolve assembly path ──────────────────────────────────────────────────
  let assemblyPath = assemblyPathOverride;

  if (!assemblyPath) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      assemblyPath = await analyzer.findAssembly(workspaceFolders[0].uri.fsPath);
    }
  }

  if (!assemblyPath) {
    const savedDir = state?.get<string>(LAST_PICKED_DIR_KEY);
    const defaultDir = savedDir
      ? vscode.Uri.file(savedDir)
      : vscode.workspace.workspaceFolders?.[0]?.uri;
    const picked = await vscode.window.showOpenDialog({
      canSelectMany: false,
      defaultUri: defaultDir,
      filters: { "Plugin Assembly": ["dll"] },
      title: "Select Plugin Assembly",
    });
    if (!picked || picked.length === 0) { return; }
    assemblyPath = picked[0].fsPath;
  }

  state?.update(LAST_PICKED_DIR_KEY, path.dirname(assemblyPath));
  Logger.info("Starting deployment", { assembly: path.basename(assemblyPath), env: env.name });

  // ── Check analyzer availability ────────────────────────────────────────────
  if (!(await analyzer.isAvailable())) {
    vscode.window.showErrorMessage(
      "Plugin analyzer not found. Build the analyzer tool or configure dataverse-tools.analyzerPath in settings."
    );
    return;
  }

  // ── Analyze + fetch server state ──────────────────────────────────────────
  let analysis: AssemblyAnalysisResult;
  let serverTypes: PluginType[] = [];

  try {
    const result = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "Preparing deployment…" },
      async (progress) => {
        progress.report({ message: "Analyzing assembly…" });
        const analysisResult = await analyzer.analyze(assemblyPath!);

        progress.report({ message: "Fetching registrations…" });
        let types: PluginType[] = [];
        try {
          const existingAssemblies = await registrationSvc.listAssemblies(env!);
          const existing = existingAssemblies.find((a) => a.name === analysisResult.assemblyName);
          if (existing?.pluginassemblyid) {
            types = await registrationSvc.listPluginTypes(env!, existing.pluginassemblyid);
          }
        } catch {
          // First deploy or network issue — proceed with empty server types
        }

        return { analysis: analysisResult, serverTypes: types };
      },
    );
    analysis = result.analysis;
    serverTypes = result.serverTypes;
  } catch (err) {
    Logger.error("Assembly analysis failed", err);
    vscode.window.showErrorMessage(
      `Assembly analysis failed: ${err instanceof Error ? err.message : String(err)}`
    );
    return;
  }

  // ── Show type picker ───────────────────────────────────────────────────────
  const pickerResult = await showTypePicker(analysis, serverTypes);
  if (!pickerResult) { return; } // cancelled

  // ── Pick activity group name if activities are selected ─────────────────────
  const hasActivities = pickerResult.selectedTypes.some((fullName) =>
    analysis.plugins.some((p) => p.fullName === fullName && p.kind === "activity")
  );
  let activityGroupName: string | undefined;

  if (hasActivities) {
    activityGroupName = await pickActivityGroup(
      analysis.assemblyName,
      serverTypes,
    );
    if (activityGroupName === undefined) { return; } // cancelled
  }

  // ── Auto-detect conflict types ────────────────────────────────────────────
  // Types on server but not in new assembly MUST be deleted before upload,
  // even if the user didn't explicitly select them in the picker.
  const analyzerNames = new Set(analysis.plugins.map((p) => p.fullName));
  const userDeleteIds = new Set(pickerResult.typesToDelete.map((t) => t.plugintypeid));
  const conflictTypes = serverTypes.filter(
    (st) => !analyzerNames.has(st.typename) && !userDeleteIds.has(st.plugintypeid)
  );

  const allTypesToDelete = [...pickerResult.typesToDelete, ...conflictTypes];

  // ── Fetch steps for types being deleted and warn user ─────────────────────
  if (allTypesToDelete.length > 0) {
    const typeStepMap = new Map<string, SdkMessageProcessingStep[]>();

    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "Checking registered steps…" },
      async () => {
        for (const t of allTypesToDelete) {
          if (!t.plugintypeid) { continue; }
          try {
            const steps = await registrationSvc.listSteps(env!, t.plugintypeid);
            if (steps.length > 0) { typeStepMap.set(t.typename, steps); }
          } catch { /* ignore — proceed without step info */ }
        }
      }
    );

    const confirm = await showDeletionWarning(allTypesToDelete, typeStepMap, conflictTypes);
    if (!confirm) { return; }
  }

  // ── Deploy ─────────────────────────────────────────────────────────────────
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Deploying to ${env.name}`,
      cancellable: false,
    },
    async (progress) => {
      let result: DeploymentResult;
      try {
        result = await registrationSvc.deployAssembly(
          env!, analysis, assemblyPath!,
          {
            selectedTypes: pickerResult.selectedTypes,
            typesToDelete: allTypesToDelete,
            activityGroupName,
          },
          (message) => progress.report({ message }),
        );
      } catch (err) {
        Logger.error("Deployment failed", err);
        vscode.window.showErrorMessage(
          `Deployment failed: ${err instanceof Error ? err.message : String(err)}`
        );
        return;
      }

      progress.report({ increment: 100, message: "Refreshing registrations…" });
      onRefresh();

      showDeploymentSummary(result);
    }
  );
}

// ── Deletion warning ──────────────────────────────────────────────────────────

async function showDeletionWarning(
  typesToDelete: PluginType[],
  typeStepMap: Map<string, SdkMessageProcessingStep[]>,
  conflictTypes: PluginType[],
): Promise<boolean> {
  const lines: string[] = [];

  if (conflictTypes.length > 0) {
    lines.push(
      `${conflictTypes.length} type(s) no longer exist in the assembly and must be removed ` +
      `before the assembly can be updated:\n`
    );
  }

  for (const t of typesToDelete) {
    const displayName = t.friendlyname || t.typename.split(".").pop() || t.typename;
    const steps = typeStepMap.get(t.typename);
    const isConflict = conflictTypes.some((c) => c.plugintypeid === t.plugintypeid);

    if (steps && steps.length > 0) {
      lines.push(`\u2716 ${displayName}${isConflict ? " (required)" : ""}`);
      for (const s of steps) {
        lines.push(`    \u21B3 ${s.name}`);
      }
    } else {
      lines.push(`\u2716 ${displayName} (no steps)${isConflict ? " (required)" : ""}`);
    }
  }

  const totalSteps = [...typeStepMap.values()].reduce((sum, s) => sum + s.length, 0);

  let message: string;
  if (totalSteps > 0) {
    message = `${typesToDelete.length} type(s) and ${totalSteps} step(s) will be permanently deleted. This cannot be undone.`;
  } else {
    message = `${typesToDelete.length} type(s) will be permanently deleted. This cannot be undone.`;
  }

  const detail = lines.join("\n");

  const choice = await vscode.window.showWarningMessage(
    message,
    { modal: true, detail },
    "Delete and Continue"
  );

  return choice === "Delete and Continue";
}

// ── Activity group picker ─────────────────────────────────────────────────────

interface GroupPickItem extends vscode.QuickPickItem {
  groupName: string;
}

async function pickActivityGroup(
  assemblyName: string,
  serverTypes: PluginType[],
): Promise<string | undefined> {
  // Collect existing group names from server types
  const existingGroups = new Set<string>();
  for (const t of serverTypes) {
    if (t.workflowactivitygroupname) {
      existingGroups.add(t.workflowactivitygroupname);
    }
  }

  const items: GroupPickItem[] = [];

  // Default: assembly name
  items.push({
    label: `$(package) ${assemblyName}`,
    description: "assembly name (default)",
    groupName: assemblyName,
  });

  // Existing groups (excluding assembly name if it's already added)
  for (const g of existingGroups) {
    if (g === assemblyName) { continue; }
    items.push({
      label: `$(folder) ${g}`,
      description: "existing group",
      groupName: g,
    });
  }

  // Custom option
  items.push({
    label: "$(edit) Enter custom name…",
    description: "type a new group name",
    groupName: "__custom__",
  });

  const picked = await vscode.window.showQuickPick(items, {
    title: "Activity Group Name",
    placeHolder: "Select workflow activity group",
  });

  if (!picked) { return undefined; }

  if (picked.groupName === "__custom__") {
    return vscode.window.showInputBox({
      title: "Activity Group Name",
      value: assemblyName,
      validateInput: (v) => v.trim() ? undefined : "Name cannot be empty.",
    }).then((v) => v?.trim());
  }

  return picked.groupName;
}

// ── Type picker ────────────────────────────────────────────────────────────────

interface PickerResult {
  selectedTypes: string[];
  typesToDelete: PluginType[];
}

interface TypePickItem extends vscode.QuickPickItem {
  fullName?: string;
  serverType?: PluginType;
  section: "plugin" | "activity" | "removed";
}

async function showTypePicker(
  analysis: AssemblyAnalysisResult,
  serverTypes: PluginType[],
): Promise<PickerResult | undefined> {
  const serverTypeMap = new Map(serverTypes.map((t) => [t.typename, t]));
  const analyzerNames = new Set(analysis.plugins.map((p) => p.fullName));
  const isFirstDeploy = serverTypes.length === 0;

  const items: TypePickItem[] = [];

  // ── Plugins section ──
  const plugins = analysis.plugins.filter((p) => p.kind === "plugin");
  if (plugins.length > 0) {
    items.push({ label: "Plugins", kind: vscode.QuickPickItemKind.Separator, section: "plugin" });
    for (const p of plugins) {
      const onServer = serverTypeMap.has(p.fullName);
      items.push({
        label: `$(symbol-class) ${p.className}`,
        description: p.fullName,
        detail: onServer ? "registered" : "new",
        picked: isFirstDeploy || onServer,
        fullName: p.fullName,
        section: "plugin",
      });
    }
  }

  // ── Activities section ──
  const activities = analysis.plugins.filter((p) => p.kind === "activity");
  if (activities.length > 0) {
    items.push({ label: "Workflow Activities", kind: vscode.QuickPickItemKind.Separator, section: "activity" });
    for (const a of activities) {
      const onServer = serverTypeMap.has(a.fullName);
      items.push({
        label: `$(symbol-event) ${a.className}`,
        description: a.fullName,
        detail: onServer ? "registered" : "new",
        picked: isFirstDeploy || onServer,
        fullName: a.fullName,
        section: "activity",
      });
    }
  }

  // ── Removed section (on server but not in assembly) ──
  const removed = serverTypes.filter((st) => !analyzerNames.has(st.typename));
  if (removed.length > 0) {
    items.push({ label: "Removed from Assembly", kind: vscode.QuickPickItemKind.Separator, section: "removed" });
    for (const r of removed) {
      const displayName = r.friendlyname || r.typename.split(".").pop() || r.typename;
      items.push({
        label: `$(trash) ${displayName}`,
        description: `${r.typename} — no longer in assembly`,
        detail: "select to delete from server",
        picked: false,
        serverType: r,
        section: "removed",
      });
    }
  }

  // If only a single type and no removed, skip picker
  if (items.filter((i) => i.kind !== vscode.QuickPickItemKind.Separator).length === 1 && removed.length === 0) {
    const typeItems = items.filter((i) => i.kind !== vscode.QuickPickItemKind.Separator);
    return {
      selectedTypes: typeItems.map((i) => i.fullName!).filter(Boolean),
      typesToDelete: [],
    };
  }

  const selected = await vscode.window.showQuickPick(items, {
    canPickMany: true,
    title: "Select types to deploy",
    placeHolder: "Check to deploy, uncheck registered types to delete",
  });

  if (!selected) { return undefined; }

  const selectedNames = new Set(
    selected
      .filter((i) => i.section !== "removed" && i.fullName)
      .map((i) => i.fullName!),
  );

  // Types explicitly marked for deletion from the "Removed" section
  const explicitDeletes = selected
    .filter((i) => i.section === "removed" && i.serverType)
    .map((i) => i.serverType!);

  // Registered types the user unchecked → also delete
  const uncheckedRegistered = items
    .filter((i) =>
      i.section !== "removed" &&
      i.kind !== vscode.QuickPickItemKind.Separator &&
      i.fullName &&
      serverTypeMap.has(i.fullName) &&
      !selectedNames.has(i.fullName),
    )
    .map((i) => serverTypeMap.get(i.fullName!)!);

  return {
    selectedTypes: [...selectedNames],
    typesToDelete: [...explicitDeletes, ...uncheckedRegistered],
  };
}
