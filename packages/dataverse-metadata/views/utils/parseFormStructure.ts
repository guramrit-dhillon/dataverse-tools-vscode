/**
 * Parses a Dataverse `formxml` string (from the `systemforms` entity) into a
 * typed structure tree.
 *
 * WEBVIEW-SIDE ONLY — uses DOMParser (available in browser and happy-dom/Vitest).
 *
 * formxml is a standard XML document; it is more complete than formjson and is
 * the canonical representation used by the platform.
 */

const PCF_CLASS_IDS = new Set([
  '{F9A8A302-114E-466A-B582-6771B2AE0D92}',
  '{f9a8a302-114e-466a-b582-6771b2ae0d92}',
]);

const EVENT_NAME_MAP: Record<string, string> = {
  onload:  'OnLoad',
  onsave:  'OnSave',
  onchange: 'OnChange',
};

export interface FormField {
  logicalName: string;
  label: string;
  isPcf: boolean;
}

export interface FormSection {
  /** Raw technical name from formxml (e.g. "header", "footer", "section_info"). */
  name: string;
  label: string;
  fields: FormField[];
}

export interface FormTab {
  /** Raw technical name from formxml (e.g. "tab_general"). */
  name: string;
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

// ── DOM helpers ─────────────────────────────────────────────────────────────

/** Direct children of `el` whose tag matches `tagName` (case-insensitive). */
function children(el: Element, tagName: string): Element[] {
  const tag = tagName.toLowerCase();
  return Array.from(el.children).filter((c) => c.tagName.toLowerCase() === tag);
}

/** First direct child of `el` whose tag matches `tagName`. */
function child(el: Element, tagName: string): Element | null {
  return children(el, tagName)[0] ?? null;
}

/**
 * Reads the display label from a `<labels>` direct child of `el`.
 * Prefers languagecode 1033 (English), falls back to the first label.
 * Returns null if no labels element or no label children.
 */
function getLabel(el: Element): string | null {
  const labelsEl = child(el, 'labels');
  if (!labelsEl) { return null; }
  const all = children(labelsEl, 'label');
  const en = all.find((l) => l.getAttribute('languagecode') === '1033');
  const chosen = en ?? all[0];
  return chosen?.getAttribute('description') ?? null;
}

function isPcfControl(control: Element): boolean {
  const classId = control.getAttribute('classid') ?? '';
  return PCF_CLASS_IDS.has(classId);
}

// ── Main parser ──────────────────────────────────────────────────────────────

export function parseFormStructure(formxml: string | null | undefined): FormStructure {
  if (!formxml) { return emptyStructure(); }

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(formxml, 'text/xml');
  } catch {
    return emptyStructure();
  }

  // DOMParser returns a document with a <parsererror> root on invalid XML.
  if (doc.querySelector('parsererror')) { return emptyStructure(); }

  const root = doc.documentElement; // <form>

  // ── Events ───────────────────────────────────────────────────────────────
  const events: FormEvent[] = [];
  const eventsEl = child(root, 'events');
  if (eventsEl) {
    for (const eventEl of children(eventsEl, 'event')) {
      const rawName = eventEl.getAttribute('name') ?? '';
      const eventName = EVENT_NAME_MAP[rawName.toLowerCase()] ?? rawName;
      const field = eventEl.getAttribute('attribute') ?? null;
      const handlersEl = child(eventEl, 'Handlers') ?? child(eventEl, 'handlers');
      if (handlersEl) {
        for (const handler of children(handlersEl, 'Handler')) {
          events.push({
            event: eventName,
            field,
            functionName: handler.getAttribute('functionName') ?? '',
            libraryName:  handler.getAttribute('libraryName')  ?? '',
          });
        }
      }
    }
  }

  // ── Tabs ─────────────────────────────────────────────────────────────────
  const tabsEl = child(root, 'tabs');
  const tabs: FormTab[] = (tabsEl ? children(tabsEl, 'tab') : []).map((tabEl) => {
    const tabName  = tabEl.getAttribute('name') ?? '';
    const tabLabel = getLabel(tabEl) ?? tabName;

    const sections: FormSection[] = [];
    const columnsEl = child(tabEl, 'columns');
    if (columnsEl) {
      for (const colEl of children(columnsEl, 'column')) {
        const sectionsEl = child(colEl, 'sections');
        if (!sectionsEl) { continue; }
        for (const secEl of children(sectionsEl, 'section')) {
          const secName  = secEl.getAttribute('name') ?? '';
          const secLabel = getLabel(secEl) ?? secName;
          const fields: FormField[] = [];

          const rowsEl = child(secEl, 'rows');
          if (rowsEl) {
            for (const rowEl of children(rowsEl, 'row')) {
              for (const cellEl of children(rowEl, 'cell')) {
                const control = child(cellEl, 'control');
                if (!control) { continue; }

                const logicalName = control.getAttribute('datafieldname') || control.getAttribute('id');
                if (!logicalName) { continue; }

                const label = getLabel(cellEl) ?? logicalName;
                fields.push({ logicalName, label, isPcf: isPcfControl(control) });
              }
            }
          }

          sections.push({ name: secName, label: secLabel, fields });
        }
      }
    }

    return { name: tabName, label: tabLabel, sections };
  });

  // ── Libraries ─────────────────────────────────────────────────────────────
  const formLibrariesEl = child(root, 'formLibraries');
  const libraries: FormLibrary[] = (formLibrariesEl ? children(formLibrariesEl, 'Library') : []).map((lib) => {
    const name        = lib.getAttribute('name') ?? '';
    const displayName = lib.getAttribute('displayName') ?? name;
    return { webResourceName: name, displayName };
  });

  return { tabs, libraries, events };
}
