import * as vscode from "vscode";
import { type IEnvironmentManager, type IAuthenticationService } from "../interfaces";
import { type DataverseSolution, type EnvironmentSelection, Logger } from "core-dataverse";

// ── Pick Environment (shared picker utility) ─────────────────────────────────
// Returns the user's selection. Does NOT mutate global state — each caller owns
// its own per-pane context.

export async function pickEnvironmentCommand(
  envManager: IEnvironmentManager,
  authSvc: IAuthenticationService,
  options?: { showSolutions?: boolean; activeEnvironmentId?: string }
): Promise<EnvironmentSelection | undefined> {
  const all = envManager.getAll();

  if (all.length === 0) {
    vscode.window.showInformationMessage(
      "No environments configured. Use the + button in the Environments panel."
    );
    return undefined;
  }

  // ── Step 1: pick environment ─────────────────────────────────────────────

  type EnvItem = vscode.QuickPickItem & { _envId: string };

  const envItems: EnvItem[] = all.map((env) => ({
    label: env.name,
    description: new URL(env.url).hostname,
    _envId: env.id,
  }));

  const envPick = await new Promise<EnvItem | undefined>((resolve) => {
    const qp = vscode.window.createQuickPick<EnvItem>();
    qp.title = options?.showSolutions ? "Select Environment (1/2)" : "Select Environment";
    qp.placeholder = "Choose a Dataverse environment";
    qp.matchOnDescription = true;
    qp.items = envItems;
    if (options?.activeEnvironmentId) {
      const active = envItems.find((i) => i._envId === options.activeEnvironmentId);
      if (active) { qp.activeItems = [active]; }
    }
    qp.onDidAccept(() => { resolve(qp.selectedItems[0]); qp.dispose(); });
    qp.onDidHide(() => { resolve(undefined); qp.dispose(); });
    qp.show();
  });
  if (!envPick) { return undefined; }

  const selectedEnv = all.find((e) => e.id === envPick._envId);
  if (!selectedEnv) { return undefined; }

  // ── Step 2: optionally pick solution ─────────────────────────────────────

  if (!options?.showSolutions) {
    return { environment: selectedEnv };
  }

  const solution = await pickSolution(selectedEnv, authSvc);
  // undefined = user cancelled the solution picker → abort entire selection
  if (solution === undefined) { return undefined; }
  // null = "All Entities" (no solution filter)
  return { environment: selectedEnv, solution: solution ?? undefined };
}

// ── Solution picker ──────────────────────────────────────────────────────────

async function fetchSolutions(
  env: import("core-dataverse").DataverseEnvironment,
  authSvc: IAuthenticationService
): Promise<DataverseSolution[]> {
  const token = await authSvc.getAccessToken(env);
  const url = `${env.url.replace(/\/$/, "")}/api/data/v9.2/solutions?$select=solutionid,uniquename,friendlyname,ismanaged&$filter=isvisible eq true&$orderby=friendlyname`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "OData-MaxVersion": "4.0",
      "OData-Version": "4.0",
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) { throw new Error(`Solutions query failed: ${res.status} ${res.statusText}`); }
  const data = await res.json() as { value: DataverseSolution[] };
  return data.value;
}

/**
 * Solution picker with Managed/Unmanaged grouping and Back navigation.
 * Returns the picked solution, null for "All" (no filter), or undefined if cancelled.
 */
async function pickSolution(
  env: import("core-dataverse").DataverseEnvironment,
  authSvc: IAuthenticationService
): Promise<DataverseSolution | null | undefined> {
  type SolItem = vscode.QuickPickItem & {
    _action: "all" | "managed" | "unmanaged" | "back" | "pick";
    _sol?: DataverseSolution;
  };

  const sqp = vscode.window.createQuickPick<SolItem>();
  sqp.title = "Select Solution Filter (2/2)";
  sqp.placeholder = "Loading solutions…";
  sqp.busy = true;
  sqp.ignoreFocusOut = true;
  sqp.show();

  let allSolutions: DataverseSolution[] = [];
  try {
    allSolutions = await fetchSolutions(env, authSvc);
  } catch (err) {
    Logger.warn("Failed to load solutions", { error: String(err) });
  }

  const managed = allSolutions.filter((s) => s.ismanaged);
  const unmanaged = allSolutions.filter((s) => !s.ismanaged);

  const solutionItems = (group: DataverseSolution[]): SolItem[] =>
    group.map((s) => ({
      label: s.friendlyname || s.uniquename,
      description: s.uniquename,
      _action: "pick" as const,
      _sol: s,
    }));

  const showRoot = (): void => {
    sqp.busy = false;
    sqp.placeholder = "Select a category or skip with All";
    sqp.items = [
      { label: "$(globe) All", description: "No solution filter", _action: "all" },
      { label: `$(lock) Managed`, description: `${managed.length} solution${managed.length !== 1 ? "s" : ""}`, _action: "managed" },
      { label: `$(unlock) Unmanaged`, description: `${unmanaged.length} solution${unmanaged.length !== 1 ? "s" : ""}`, _action: "unmanaged" },
    ];
  };

  const showGroup = (group: DataverseSolution[], title: string): void => {
    const backItem: SolItem = { label: "$(arrow-left) Back", description: title, _action: "back" };
    sqp.items = group.length > 0
      ? [backItem, ...solutionItems(group)]
      : [backItem, { label: "No solutions found", _action: "back" }];
  };

  showRoot();

  return new Promise<DataverseSolution | null | undefined>((resolve) => {
    sqp.onDidAccept(() => {
      const item = sqp.selectedItems[0] as SolItem | undefined;
      if (!item) { return; }
      switch (item._action) {
        case "all":       resolve(null); sqp.dispose(); break;
        case "managed":   showGroup(managed, "Managed"); break;
        case "unmanaged": showGroup(unmanaged, "Unmanaged"); break;
        case "back":      showRoot(); break;
        case "pick":
          if (item._sol) { resolve(item._sol); sqp.dispose(); }
          break;
      }
    });
    sqp.onDidHide(() => { resolve(undefined); sqp.dispose(); });
  });
}
