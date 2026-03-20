/**
 * Parses a Dataverse view layoutxml string into an ordered list of column descriptors.
 *
 * WEBVIEW-SIDE ONLY — uses DOMParser (browser global). Do not import from the extension host.
 *
 * Layout XML format:
 *   <grid><row><cell name="attributeName" width="150" /></row></grid>
 */

export interface LayoutColumn {
  name: string;
  width: number;
}

export function parseLayoutColumns(layoutxml: string | null | undefined): LayoutColumn[] {
  if (!layoutxml) { return []; }

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(layoutxml, 'text/xml');
  } catch {
    return [];
  }

  // DOMParser does not throw on invalid XML — it returns a document with a <parsererror> element
  if (doc.querySelector('parsererror')) { return []; }

  const cells = Array.from(doc.querySelectorAll('cell'));
  const columns: LayoutColumn[] = [];

  for (const cell of cells) {
    const name = cell.getAttribute('name');
    if (!name) { continue; }
    const rawWidth = cell.getAttribute('width');
    const width = rawWidth ? (parseInt(rawWidth, 10) || 100) : 100;
    columns.push({ name, width });
  }

  return columns;
}
