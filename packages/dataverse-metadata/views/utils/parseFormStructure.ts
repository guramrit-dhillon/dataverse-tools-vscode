/**
 * Parses a Dataverse `formjson` string (from the `systemforms` entity) into a
 * typed structure tree.
 *
 * WEBVIEW-SIDE ONLY — uses JSON.parse (safe in browser and Node/Vitest).
 *
 * NOTE: The exact property names depend on the Dataverse environment.
 * If structure appears empty against a real org, console.log the raw formjson
 * and adjust the property paths below to match.
 */

const PCF_CLASS_IDS = new Set([
  '{F9A8A302-114E-466A-B582-6771B2AE0D92}',
]);

export interface FormField {
  logicalName: string;
  label: string;
  isPcf: boolean;
}

export interface FormSection {
  label: string;
  fields: FormField[];
}

export interface FormTab {
  label: string;
  sections: FormSection[];
}

export interface FormLibrary {
  webResourceName: string;
  displayName: string;
}

export interface FormEvent {
  event: string;
  field: string | null;
  functionName: string;
  libraryName: string;
}

export interface FormStructure {
  tabs: FormTab[];
  libraries: FormLibrary[];
  events: FormEvent[];
}

const EMPTY: FormStructure = { tabs: [], libraries: [], events: [] };

function isPcfControl(control: Record<string, unknown>): boolean {
  const classId = control['ClassId'] as string | undefined;
  if (classId && PCF_CLASS_IDS.has(classId)) { return true; }
  // Some versions use ComponentType or customControl flag
  return control['ComponentType'] !== undefined;
}

export function parseFormStructure(formjson: string | null | undefined): FormStructure {
  if (!formjson) { return EMPTY; }

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(formjson) as Record<string, unknown>;
  } catch {
    return EMPTY;
  }

  // ── Tabs ────────────────────────────────────────────────────────────────
  const rawTabs = Array.isArray(raw['Tabs']) ? (raw['Tabs'] as unknown[]) : [];
  const tabs: FormTab[] = rawTabs.map((rawTab) => {
    const tab = rawTab as Record<string, unknown>;
    const tabLabel = (tab['Label'] as string | undefined) ?? (tab['Name'] as string | undefined) ?? '';
    const columns = Array.isArray(tab['Columns']) ? (tab['Columns'] as unknown[]) : [];

    const sections: FormSection[] = [];
    for (const col of columns) {
      const colSections = Array.isArray((col as Record<string, unknown>)['Sections'])
        ? ((col as Record<string, unknown>)['Sections'] as unknown[])
        : [];
      for (const rawSec of colSections) {
        const sec = rawSec as Record<string, unknown>;
        const secLabel = (sec['Label'] as string | undefined) ?? (sec['Name'] as string | undefined) ?? '';
        const rows = Array.isArray(sec['Rows']) ? (sec['Rows'] as unknown[]) : [];

        const fields: FormField[] = [];
        for (const rawRow of rows) {
          const cells = Array.isArray((rawRow as Record<string, unknown>)['Cells'])
            ? ((rawRow as Record<string, unknown>)['Cells'] as unknown[])
            : [];
          for (const rawCell of cells) {
            const cell = rawCell as Record<string, unknown>;
            const control = cell['Control'] as Record<string, unknown> | undefined;
            if (!control) { continue; }
            const logicalName = (control['DataFieldName'] as string | undefined)
              ?? (control['Id'] as string | undefined);
            if (!logicalName) { continue; }
            const label = (cell['Label'] as string | undefined) ?? logicalName;
            fields.push({ logicalName, label, isPcf: isPcfControl(control) });
          }
        }
        sections.push({ label: secLabel, fields });
      }
    }
    return { label: tabLabel, sections };
  });

  // ── Libraries ────────────────────────────────────────────────────────────
  const formLibraries = raw['FormLibraries'] as Record<string, unknown> | undefined;
  const rawLibs = Array.isArray(formLibraries?.['Libraries'])
    ? (formLibraries!['Libraries'] as unknown[])
    : [];
  const libraries: FormLibrary[] = rawLibs.map((l) => {
    const lib = l as Record<string, unknown>;
    return {
      webResourceName: (lib['Name'] as string | undefined) ?? '',
      displayName: (lib['DisplayName'] as string | undefined) ?? '',
    };
  });

  // ── Events ───────────────────────────────────────────────────────────────
  const rawEvents = Array.isArray(raw['EventHandlers']) ? (raw['EventHandlers'] as unknown[]) : [];
  const events: FormEvent[] = rawEvents.map((e) => {
    const ev = e as Record<string, unknown>;
    return {
      event: (ev['EventName'] as string | undefined) ?? '',
      field: (ev['ControlId'] as string | undefined) ?? null,
      functionName: (ev['FunctionName'] as string | undefined) ?? '',
      libraryName: (ev['LibraryName'] as string | undefined) ?? '',
    };
  });

  return { tabs, libraries, events };
}
