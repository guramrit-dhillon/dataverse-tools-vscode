import React, { useCallback, useState, useRef, useEffect } from "react";
import "./datatable.css";

export type ColumnType = "text" | "number" | "date";

export interface TableColumnDefinition<T = any> {
  key: string;
  label: string;
  type?: ColumnType;
  valueFormatter?: (value: any, row: T) => string;
  sortable?: boolean;
  resizable?: boolean;
  width?: number;
  headerClassName?: string;
  cellClassName?: string | ((value: any, row: T) => string);
}

export interface TableProps<T> {
  columns: TableColumnDefinition<T>[];
  rows: T[] | null | undefined;
  allowMultipleSelection?: boolean;
  selectedKeys?: string[];
  onSelectionChange?: (selectedKeys: string[], selectedRows: T[]) => void;
  keyFormatter: (row: T) => string;
  onRowClick?: (row: T) => void;
  className?: string;
  rowClassName?: string | ((row: T) => string);
  emptyMessage?: string;
  emptyCellClassName?: string;
}

const columnTypeClass: Record<ColumnType, string> = {
  text: "",
  number: "col-number",
  date: "col-date",
};

export default function DataTable<T>(props: TableProps<T>) {
  const {
    columns,
    rows,
    allowMultipleSelection = false,
    selectedKeys = [],
    onSelectionChange,
    keyFormatter,
    onRowClick,
    rowClassName: rowClassNameProp } = props;

  const tableRef = useRef<HTMLTableElement>(null);
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const [hasResized, setHasResized] = useState(false);

  // Measure natural column widths on first render with data
  useEffect(() => {
    if (hasResized || !tableRef.current || !rows?.length) { return; }
    const ths = tableRef.current.querySelectorAll("thead th");
    const widths: Record<string, number> = {};
    ths.forEach((th, i) => {
      if (columns[i]) {
        widths[columns[i].key] = (th as HTMLElement).offsetWidth;
      }
    });
    if (Object.keys(widths).length > 0) {
      setColWidths(widths);
    }
  }, [rows, columns, hasResized]);

  const startResize = useCallback(
    (key: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startWidth = colWidths[key] ?? 80;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const onMouseMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX;
        const newWidth = Math.max(40, startWidth + delta);
        setColWidths((prev) => ({ ...prev, [key]: newWidth }));
        setHasResized(true);
      };

      const onMouseUp = () => {
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [colWidths]
  );

  const handleRowClick = (row: T) => {
    const key = keyFormatter(row);
    let newSelectedKeys: string[];
    if (allowMultipleSelection) {
      if (selectedKeys.includes(key)) {
        newSelectedKeys = selectedKeys.filter(k => k !== key);
      } else {
        newSelectedKeys = [...selectedKeys, key];
      }
    } else {
      newSelectedKeys = selectedKeys.includes(key) ? [] : [key];
    }
    if (!rows) { return; }
    onSelectionChange?.(newSelectedKeys, rows.filter(r => newSelectedKeys.includes(keyFormatter(r))));
    onRowClick?.(row);
  };

  const getRowClassName = useCallback((row: T, isSelected: boolean): string => {
    const cls = rowClassNameProp ? (typeof rowClassNameProp === "function" ? rowClassNameProp(row) : rowClassNameProp) : "";
    const classes = [cls];
    if (isSelected) { classes.push("selected"); }
    return classes.filter(Boolean).join(" ");
  }, [rowClassNameProp]);

  const getCellClassName = useCallback((col: TableColumnDefinition<T>, row: T): string => {
    const typeClass = columnTypeClass[col.type ?? "text"];
    const custom = col.cellClassName
      ? typeof col.cellClassName === "function" ? col.cellClassName((row as any)[col.key], row) : col.cellClassName
      : "";
    return [typeClass, custom].filter(Boolean).join(" ") || "";
  }, []);

  const getCellValue = useCallback((col: TableColumnDefinition<T>, row: T): string => {
    const value = (row as any)[col.key];
    return col.valueFormatter ? col.valueFormatter(value, row) : String(value);
  }, []);

  const useFixed = Object.keys(colWidths).length > 0;

  const handleRowKeyDown = useCallback((e: React.KeyboardEvent<HTMLTableRowElement>, row: T) => {
    const target = e.currentTarget;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      (target.nextElementSibling as HTMLElement)?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      (target.previousElementSibling as HTMLElement)?.focus();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleRowClick(row);
    }
  }, [handleRowClick]);

  return (
    <table
      ref={tableRef}
      className={["data-table", props.className].filter(Boolean).join(" ")}
      style={useFixed ? { tableLayout: "fixed" } : undefined}
      role="grid"
    >
      <thead>
        <tr>
          {columns.map(col => {
            const typeClass = columnTypeClass[col.type ?? "text"];
            return (
              <th
                key={col.key}
                className={[typeClass, col.headerClassName].filter(Boolean).join(" ") || undefined}
                style={colWidths[col.key] ? { width: colWidths[col.key], position: "relative" } : { position: "relative" }}
                scope="col"
              >
                {col.label}
                <div
                  className="col-resize-handle"
                  onMouseDown={(e) => startResize(col.key, e)}
                />
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {rows?.length === 0 ? (
          <tr>
            <td colSpan={columns.length} className={props.emptyCellClassName || "empty"}>{props.emptyMessage || "No data"}</td>
          </tr>
        ) : null}
        {rows?.map(row => {
          const key = keyFormatter(row);
          const isSelected = selectedKeys.includes(key);
          return (
            <tr
              key={key}
              className={getRowClassName(row, isSelected)}
              onClick={() => handleRowClick(row)}
              onKeyDown={(e) => handleRowKeyDown(e, row)}
              tabIndex={0}
              aria-selected={isSelected}
            >
              {columns.map(col => {
                const value = getCellValue(col, row);
                return (
                  <td
                    key={col.key}
                    title={value}
                    className={getCellClassName(col, row) || undefined}
                  >
                    {value}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
