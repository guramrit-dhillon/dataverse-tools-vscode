import * as vscode from "vscode";
import { type IEnvironmentManager, type IAuthenticationService } from "../interfaces";
import {
  type DataverseEnvironment,
  type DataverseSolution,
  type EnvironmentSelection,
  type WizardPage,
  type QuickPickWizardItem,
  Logger,
  runWizard,
} from "core-dataverse";

// ── Pick Environment (shared picker utility) ─────────────────────────────────
// Returns the user's selection. Does NOT mutate global state — each caller owns
// its own per-pane context.

interface PickEnvState {
  selectedEnv?: DataverseEnvironment;
  selectedSolution?: DataverseSolution;
  /** true = user explicitly chose "All" (no filter). */
  allSolutions?: boolean;
}

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

  // Closure caches
  let solutionsCache: DataverseSolution[] | undefined;

  const pages: WizardPage<PickEnvState>[] = [

    // ── 1. Pick environment ──────────────────────────────────────────────
    {
      id: "pick-env",
      title: "Select Environment",
      type: "quickpick",
      render: () => ({
        placeholder: "Choose a Dataverse environment",
        activeAction: options?.activeEnvironmentId
          ? `env-${options.activeEnvironmentId}`
          : undefined,
        items: all.map((env): QuickPickWizardItem => ({
          label: env.name,
          description: new URL(env.url).hostname,
          action: `env-${env.id}`,
          data: env,
        })),
      }),
      onSelect: (_action, item, _state, _ui) => {
        const env = item.data as DataverseEnvironment;
        solutionsCache = undefined;
        return {
          next: options?.showSolutions ? "solution-filter" : undefined,
          update: { selectedEnv: env },
        };
      },
    },

    // ── 2. Solution filter (All / Managed / Unmanaged) ───────────────────
    {
      id: "solution-filter",
      title: "Solution Filter",
      type: "quickpick",
      loading: { placeholder: "Loading solutions…" },
      render: async (state, signal) => {
        if (solutionsCache === undefined) {
          try {
            solutionsCache = await fetchSolutions(state.selectedEnv!, authSvc);
          } catch (err) {
            if (signal.aborted) { return { placeholder: "", items: [] }; }
            Logger.warn("Failed to load solutions", { error: String(err) });
            solutionsCache = [];
          }
        }

        if (signal.aborted) { return { placeholder: "", items: [] }; }

        const managed = solutionsCache.filter((s) => s.ismanaged);
        const unmanaged = solutionsCache.filter((s) => !s.ismanaged);

        return {
          placeholder: "Select a category or skip with All",
          items: [
            { label: "$(globe) All", description: "No solution filter", action: "all" },
            {
              label: "$(lock) Managed",
              description: `${managed.length} solution${managed.length !== 1 ? "s" : ""}`,
              action: "managed",
              data: managed,
            },
            {
              label: "$(unlock) Unmanaged",
              description: `${unmanaged.length} solution${unmanaged.length !== 1 ? "s" : ""}`,
              action: "unmanaged",
              data: unmanaged,
            },
          ],
        };
      },
      onSelect: (action, _item, _state, _ui) => {
        if (action === "all") {
          return { next: undefined, update: { allSolutions: true } };
        }
        return { next: action, update: { allSolutions: false } };
      },
    },

    // ── 3a. Managed solutions ────────────────────────────────────────────
    {
      id: "managed",
      title: "Managed Solutions",
      type: "quickpick",
      render: () => {
        const managed = (solutionsCache ?? []).filter((s) => s.ismanaged);
        return {
          placeholder: managed.length > 0 ? "Pick a managed solution" : "No managed solutions found",
          items: managed.map((s): QuickPickWizardItem => ({
            label: s.friendlyname || s.uniquename,
            description: s.uniquename,
            action: "pick",
            data: s,
          })),
        };
      },
      onSelect: (_action, item, _state, _ui) => ({
        next: undefined,
        update: { selectedSolution: item.data as DataverseSolution },
      }),
    },

    // ── 3b. Unmanaged solutions ──────────────────────────────────────────
    {
      id: "unmanaged",
      title: "Unmanaged Solutions",
      type: "quickpick",
      render: () => {
        const unmanaged = (solutionsCache ?? []).filter((s) => !s.ismanaged);
        return {
          placeholder: unmanaged.length > 0 ? "Pick an unmanaged solution" : "No unmanaged solutions found",
          items: unmanaged.map((s): QuickPickWizardItem => ({
            label: s.friendlyname || s.uniquename,
            description: s.uniquename,
            action: "pick",
            data: s,
          })),
        };
      },
      onSelect: (_action, item, _state, _ui) => ({
        next: undefined,
        update: { selectedSolution: item.data as DataverseSolution },
      }),
    },
  ];

  const result = await runWizard<PickEnvState>({
    title: options?.showSolutions ? "Select Environment & Solution" : "Select Environment",
    pages,
    initialState: {},
    startPage: "pick-env",
  });

  if (!result?.selectedEnv) { return undefined; }

  return {
    environment: result.selectedEnv,
    solution: result.selectedSolution,
  };
}

// ── Solution fetcher ─────────────────────────────────────────────────────────

async function fetchSolutions(
  env: DataverseEnvironment,
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
