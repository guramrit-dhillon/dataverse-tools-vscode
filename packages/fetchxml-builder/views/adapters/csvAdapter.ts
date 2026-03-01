import { useMemo } from "react";
import { parseCsv } from "shared-views";
import type { TableColumnDefinition } from "shared-views";

export interface CsvAdapterResult {
  columns: TableColumnDefinition<Record<string, string>>[];
  rows: Record<string, string>[];
}

export function useCsvAdapter(csvText: string): CsvAdapterResult {
  return useMemo(() => {
    const { headers, rows } = parseCsv(csvText);
    const columns: TableColumnDefinition<Record<string, string>>[] = headers.map((h) => ({
      key: h,
      label: h,
      type: "text" as const,
    }));
    return { columns, rows };
  }, [csvText]);
}
