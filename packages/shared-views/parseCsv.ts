/**
 * RFC 4180 CSV parser — handles quoted fields, escaped double-quotes,
 * embedded commas/newlines, and CRLF/LF line endings.
 */

export interface CsvParseResult {
  headers: string[];
  rows: Record<string, string>[];
}

export function parseCsv(text: string): CsvParseResult {
  if (!text.trim()) {
    return { headers: [], rows: [] };
  }

  const records = parseRecords(text);
  if (records.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = records[0];
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < records.length; i++) {
    const record = records[i];
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = j < record.length ? record[j] : "";
    }
    rows.push(row);
  }

  return { headers, rows };
}

function parseRecords(text: string): string[][] {
  const records: string[][] = [];
  let fields: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          // Escaped double-quote
          field += '"';
          i += 2;
        } else {
          // End of quoted field
          inQuotes = false;
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === '"' && field === "") {
        // Start of quoted field
        inQuotes = true;
        i++;
      } else if (ch === ",") {
        fields.push(field);
        field = "";
        i++;
      } else if (ch === "\r" && i + 1 < text.length && text[i + 1] === "\n") {
        // CRLF
        fields.push(field);
        records.push(fields);
        fields = [];
        field = "";
        i += 2;
      } else if (ch === "\n") {
        fields.push(field);
        records.push(fields);
        fields = [];
        field = "";
        i++;
      } else {
        field += ch;
        i++;
      }
    }
  }

  // Last field/record (if file doesn't end with newline)
  if (field !== "" || fields.length > 0) {
    fields.push(field);
    records.push(fields);
  }

  return records;
}
