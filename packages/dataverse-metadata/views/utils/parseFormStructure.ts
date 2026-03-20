/**
 * Parses a Dataverse `formjson` string (from the `systemforms` entity) into a
 * typed structure tree.
 *
 * WEBVIEW-SIDE ONLY — uses JSON.parse (safe in browser and Node/Vitest).
 *
 * The real formjson uses .NET JSON serialization with `$values` wrappers on all
 * arrays: `{ "$type": "...", "$values": [...] }`. Plain arrays are also accepted
 * for test fixtures.
 */

const PCF_CLASS_IDS = new Set([
  '{F9A8A302-114E-466A-B582-6771B2AE0D92}',
  // lowercase variant
  '{f9a8a302-114e-466a-b582-6771b2ae0d92}',
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

function emptyStructure(): FormStructure {
  return { tabs: [], libraries: [], events: [] };
}

/**
 * Extracts an array from either a plain JS array or a .NET-serialized
 * `{ "$values": [...] }` wrapper object.
 */
function getValues<T>(obj: unknown): T[] {
  if (Array.isArray(obj)) { return obj as T[]; }
  const wrapped = obj as Record<string, unknown> | null | undefined;
  if (wrapped && Array.isArray(wrapped['$values'])) { return wrapped['$values'] as T[]; }
  return [];
}

function isPcfControl(control: Record<string, unknown>): boolean {
  const classId = (control['ClassId'] as string | undefined) ?? '';
  if (PCF_CLASS_IDS.has(classId)) { return true; }
  return control['ComponentType'] !== undefined;
}

function parseEventHandler(ev: Record<string, unknown>, fieldOverride?: string): FormEvent {
  return {
    event: (ev['EventName'] as string | undefined) ?? '',
    field: (ev['ControlId'] as string | undefined) ?? fieldOverride ?? null,
    functionName: (ev['FunctionName'] as string | undefined) ?? '',
    libraryName: (ev['LibraryName'] as string | undefined) ?? '',
  };
}

export function parseFormStructure(formjson: string | null | undefined): FormStructure {
  if (!formjson) { return emptyStructure(); }

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(formjson) as Record<string, unknown>;
  } catch {
    return emptyStructure();
  }

  const events: FormEvent[] = [];

  // ── Form-level event handlers (OnLoad, OnSave) ───────────────────────────
  for (const ev of getValues<Record<string, unknown>>(raw['EventHandlers'])) {
    events.push(parseEventHandler(ev));
  }

  // ── Tabs ─────────────────────────────────────────────────────────────────
  const tabs: FormTab[] = getValues<Record<string, unknown>>(raw['Tabs']).map((tab) => {
    const tabLabel = (tab['Label'] as string | undefined) ?? (tab['Name'] as string | undefined) ?? '';

    // Tab-level event handlers
    for (const ev of getValues<Record<string, unknown>>(tab['EventHandlers'])) {
      events.push(parseEventHandler(ev));
    }

    const sections: FormSection[] = [];
    for (const col of getValues<Record<string, unknown>>(tab['Columns'])) {
      for (const sec of getValues<Record<string, unknown>>(col['Sections'])) {
        const secLabel = (sec['Label'] as string | undefined) ?? (sec['Name'] as string | undefined) ?? '';
        const fields: FormField[] = [];

        for (const row of getValues<Record<string, unknown>>(sec['Rows'])) {
          for (const cell of getValues<Record<string, unknown>>(row['Cells'])) {
            const control = cell['Control'] as Record<string, unknown> | undefined;
            if (!control) { continue; }

            const logicalName = (control['DataFieldName'] as string | undefined)
              ?? (control['Id'] as string | undefined);
            if (!logicalName) { continue; }

            // Labels are often null in formjson — fall back through the chain
            const label = (cell['Label'] as string | undefined)
              ?? (control['Label'] as string | undefined)
              ?? logicalName;

            // Control-level event handlers (OnChange etc.)
            for (const ev of getValues<Record<string, unknown>>(control['EventHandlers'])) {
              events.push(parseEventHandler(ev, logicalName));
            }

            fields.push({ logicalName, label, isPcf: isPcfControl(control) });
          }
        }
        sections.push({ label: secLabel, fields });
      }
    }
    return { label: tabLabel, sections };
  });

  // ── Libraries ─────────────────────────────────────────────────────────────
  // Real formjson: FormLibraries.$values is string[] (web resource names)
  // Test fixtures: FormLibraries.Libraries is { Name, DisplayName }[]
  const libraries: FormLibrary[] = [];
  const rawLibsContainer = raw['FormLibraries'] as Record<string, unknown> | undefined;
  if (rawLibsContainer) {
    // Real format: { "$values": ["new_/js/contact.js", ...] }
    const valuesList = getValues<unknown>(rawLibsContainer);
    if (valuesList.length > 0) {
      for (const item of valuesList) {
        if (typeof item === 'string') {
          libraries.push({ webResourceName: item, displayName: item });
        } else if (item && typeof item === 'object') {
          const lib = item as Record<string, unknown>;
          libraries.push({
            webResourceName: (lib['Name'] as string | undefined) ?? '',
            displayName: (lib['DisplayName'] as string | undefined) ?? (lib['Name'] as string | undefined) ?? '',
          });
        }
      }
    } else {
      // Test fixture format: { Libraries: [...] }
      for (const item of getValues<Record<string, unknown>>(rawLibsContainer['Libraries'])) {
        if (typeof item === 'string') {
          libraries.push({ webResourceName: item, displayName: item });
        } else {
          libraries.push({
            webResourceName: (item['Name'] as string | undefined) ?? '',
            displayName: (item['DisplayName'] as string | undefined) ?? (item['Name'] as string | undefined) ?? '',
          });
        }
      }
    }
  }

  return { tabs, libraries, events };
}
