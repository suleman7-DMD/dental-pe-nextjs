"use client";

import React, { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
} from "lucide-react";
import { exportToCSV } from "@/lib/utils/csv-export";

/* ── Simple column descriptor used by some page agents ──────────────── */
interface SimpleColumn<T> {
  key: string;
  header: string;
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  render?: (rowOrValue: any) => any;
  align?: "left" | "right" | "center";
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function isSimpleColumns(cols: any[]): cols is SimpleColumn<any>[] {
  return cols.length > 0 && "key" in cols[0] && "header" in cols[0];
}

/** Convert simple column descriptors into @tanstack/react-table ColumnDefs */
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function toColumnDefs<T extends Record<string, any>>(
  simples: SimpleColumn<T>[]
): ColumnDef<T, unknown>[] {
  return simples.map((col) => ({
    id: col.key,
    accessorKey: col.key,
    header: col.header,
    cell: col.render
      ? ({ row, getValue }) => {
          const val = getValue();

          // Helper: sanitize render output — prevents objects from reaching React
          const sanitize = (result: unknown): React.ReactNode => {
            if (result === null || result === undefined) {
              return val == null ? "\u2014" : String(val);
            }
            // Catch plain objects that would crash React (error #31)
            if (typeof result === "object" && !React.isValidElement(result)) {
              if ("label" in (result as Record<string, unknown>))
                return String((result as Record<string, unknown>).label);
              return JSON.stringify(result);
            }
            return result as React.ReactNode;
          };

          // Strategy: try cell value first (safe for render functions that
          // wrap value in JSX like <span>{val}</span>). If the render function
          // expects the full row object and throws, fall back to row.original.
          try {
            const cellResult = col.render!(val);
            const sanitized = sanitize(cellResult);
            // If render returned fallback "—" but the cell value is non-null,
            // the render function likely expected the full row — retry with row.original
            if (sanitized === "\u2014" && val != null) {
              try {
                const rowResult = col.render!(row.original);
                return sanitize(rowResult);
              } catch {
                return sanitized;
              }
            }
            return sanitized;
          } catch {
            // Render threw with cell value — try with full row object
            try {
              const rowResult = col.render!(row.original);
              return sanitize(rowResult);
            } catch {
              return val == null ? "\u2014" : String(val);
            }
          }
        }
      : ({ getValue }) => {
          const v = getValue();
          return v == null ? "\u2014" : String(v);
        },
    meta: { align: col.align },
  }));
}

export interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[] | SimpleColumn<T>[];
  data: T[];
  pagination?: boolean;
  pageSize?: number;
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Original prop — file name for CSV download via toolbar button */
  csvFileName?: string;
  /** Alias — boolean flag to enable CSV download */
  csvDownload?: boolean;
  /** Alias — file name when csvDownload is true */
  csvFilename?: string;
  /** Default sort column key */
  defaultSort?: string;
  /** Default sort direction */
  defaultSortDir?: "asc" | "desc";
  /** Custom row key generator or field name to use as key */
  rowKey?: string | ((row: T, index: number) => string);
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export function DataTable<T extends Record<string, any>>({
  columns: rawColumns,
  data,
  pagination = true,
  pageSize = 20,
  searchable = false,
  searchPlaceholder = "Search...",
  csvFileName,
  csvDownload,
  csvFilename,
  defaultSort,
  defaultSortDir,
  rowKey,
  onRowClick,
  emptyMessage = "No data available.",
}: DataTableProps<T>) {
  // Resolve CSV file name from either prop pattern
  const resolvedCsvName = csvFileName ?? (csvDownload ? (csvFilename ?? "export") : undefined);

  // Convert simple columns to ColumnDef if needed
  const columns: ColumnDef<T, unknown>[] = useMemo(
    () =>
      isSimpleColumns(rawColumns)
        ? toColumnDefs(rawColumns as SimpleColumn<T>[])
        : (rawColumns as ColumnDef<T, unknown>[]),
    [rawColumns]
  );

  const [sorting, setSorting] = useState<SortingState>(
    defaultSort
      ? [{ id: defaultSort, desc: (defaultSortDir ?? "asc") === "desc" }]
      : []
  );
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(pagination && {
      getPaginationRowModel: getPaginationRowModel(),
      initialState: { pagination: { pageSize } },
    }),
  });

  const filteredRowCount = table.getFilteredRowModel().rows.length;
  const pageCount = table.getPageCount();
  const currentPage = table.getState().pagination.pageIndex + 1;

  const handleCSVDownload = useMemo(
    () =>
      resolvedCsvName
        ? () => {
            const simpleMode = isSimpleColumns(rawColumns);
            const simpleCols = simpleMode ? (rawColumns as SimpleColumn<T>[]) : null;
            const filteredRows = table.getFilteredRowModel().rows;

            const formattedRows = filteredRows.map((r) => {
              const out: Record<string, unknown> = {};
              if (simpleCols) {
                for (const col of simpleCols) {
                  const raw = r.original[col.key as keyof T];
                  if (col.render) {
                    try {
                      const rendered = col.render(raw);
                      // If render returned an object with a label, use that
                      if (rendered != null && typeof rendered === "object" && !React.isValidElement(rendered)) {
                        out[col.header] = "label" in rendered ? String(rendered.label) : String(raw ?? "");
                      } else if (React.isValidElement(rendered)) {
                        // React element — fall back to raw value
                        out[col.header] = raw ?? "";
                      } else {
                        out[col.header] = rendered ?? raw ?? "";
                      }
                    } catch {
                      out[col.header] = raw ?? "";
                    }
                  } else {
                    out[col.header] = raw ?? "";
                  }
                }
              } else {
                // Tanstack ColumnDef — use raw values with column headers
                for (const col of columns) {
                  const key = (col as { accessorKey?: string }).accessorKey ?? col.id ?? "";
                  const header = typeof col.header === "string" ? col.header : key;
                  out[header] = r.original[key as keyof T] ?? "";
                }
              }
              return out;
            });

            exportToCSV(formattedRows, resolvedCsvName);
          }
        : undefined,
    [resolvedCsvName, table, rawColumns, columns]
  );

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      {(searchable || resolvedCsvName) && (
        <div className="flex items-center gap-3">
          {searchable && (
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9C9C90]" />
              <Input
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder={searchPlaceholder}
                className="pl-9 bg-[#FFFFFF] border-[#E8E5DE] text-[#1A1A1A] placeholder:text-[#B5B5A8] focus:border-[#B8860B] focus:ring-0"
              />
            </div>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-[#9C9C90]">
              {filteredRowCount} rows
            </span>
            {handleCSVDownload && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCSVDownload}
                className="gap-1.5 text-xs bg-[#FFFFFF] border-[#E8E5DE] text-[#6B6B60] hover:bg-[#F7F7F4]"
              >
                <Download className="h-3.5 w-3.5" />
                CSV
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-[#E8E5DE] overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="border-[#E8E5DE] bg-[#F5F5F0] hover:bg-[#F5F5F0]"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="sticky top-0 z-10 bg-[#F5F5F0] text-[11px] font-semibold uppercase tracking-wider text-[#9C9C90] border-b-2 border-[#E8E5DE]"
                  >
                    {header.isPlaceholder ? null : (
                      <div
                        className={cn(
                          "flex items-center gap-1",
                          header.column.getCanSort() &&
                            "cursor-pointer select-none hover:text-[#1A1A1A]"
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {header.column.getCanSort() &&
                          (header.column.getIsSorted() === "asc" ? (
                            <ArrowUp className="h-3 w-3 text-[#B8860B]" />
                          ) : header.column.getIsSorted() === "desc" ? (
                            <ArrowDown className="h-3 w-3 text-[#B8860B]" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 text-[#9C9C90] opacity-40" />
                          ))}
                      </div>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-[13px] text-[#9C9C90]"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row, idx) => (
                <TableRow
                  key={
                    rowKey
                      ? typeof rowKey === "string"
                        ? String(row.original[rowKey] ?? idx)
                        : rowKey(row.original, idx)
                      : row.id
                  }
                  onClick={() => onRowClick?.(row.original)}
                  className={cn(
                    "border-b border-[#E8E5DE] hover:bg-[#F7F7F4] transition-colors",
                    onRowClick && "cursor-pointer"
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className="text-[13px] text-[#3D3D35]"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination && pageCount > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[#9C9C90]">
            Page {currentPage} of {pageCount}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="h-8 w-8 p-0 bg-[#FFFFFF] border-[#E8E5DE] text-[#9C9C90] hover:bg-[#F7F7F4] hover:text-[#3D3D35] disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="h-8 w-8 p-0 bg-[#FFFFFF] border-[#E8E5DE] text-[#9C9C90] hover:bg-[#F7F7F4] hover:text-[#3D3D35] disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
