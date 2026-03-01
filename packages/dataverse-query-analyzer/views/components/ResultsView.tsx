import React from "react";
import { ResultsViewer } from "shared-views";
import "shared-views/results-viewer.css";
import { useQueryResultsAdapter, type ColumnInfo } from "../adapters/queryResultsAdapter";

interface ResultsViewProps {
  columns: ColumnInfo[];
  rows: Record<string, unknown>[];
  totalRows: number;
  messages: string[];
  loading: boolean;
  hasResults: boolean;
  filterText: string;
  copied: boolean;
  onExport: (format: "csv" | "json") => void;
  onFilter: (value: string) => void;
  onCopy: () => void;
}

export default function ResultsView({
  columns,
  rows,
  totalRows,
  messages,
  loading,
  hasResults,
  filterText,
  onFilter,
}: ResultsViewProps): React.ReactElement {
  const { columns: tableColumns, tabs } = useQueryResultsAdapter(columns, rows, messages);

  return (
    <div className="results-view">
      <ResultsViewer
        columns={tableColumns}
        rows={rows}
        totalRows={totalRows}
        loading={loading}
        tabs={tabs}
        enableFilter={true}
        filterText={filterText}
        onFilterChange={onFilter}
        enableExport={true}
        enableCopy={true}
        enableStatusBar={false}
        emptyMessage={hasResults ? "No results" : "Execute a query to see results"}
      />
    </div>
  );
}
