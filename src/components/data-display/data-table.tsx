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
          // Try with cell value first (what render functions expect)
          try {
            const cellResult = col.render!(val);
            // If result is a plain object (not React element), extract .label or stringify
            if (
              cellResult !== null &&
              cellResult !== undefined &&
              typeof cellResult === "object" &&
              !React.isValidElement(cellResult)
            ) {
              if ("label" in cellResult) return String(cellResult.label);
              return JSON.stringify(cellResult);
            }
            return cellResult ?? (val == null ? "\u2014" : String(val));
          } catch {
            // Fallback: try with full row (some render functions may expect it)
            try {
              const rowResult = col.render!(row.original);
              if (
                rowResult !== null &&
                rowResult !== undefined &&
                typeof rowResult === "object" &&
                !React.isValidElement(rowResult)
              ) {
                if ("label" in rowResult) return String(rowResult.label);
                return JSON.stringify(rowResult);
              }
              return rowResult ?? (val == null ? "\u2014" : String(val));
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
            const rows = table.getFilteredRowModel().rows.map((r) => r.original);
            exportToCSV(rows, resolvedCsvName);
          }
        : undefined,
    [resolvedCsvName, table]
  );

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      {(searchable || resolvedCsvName) && (
        <div className="flex items-center gap-3">
          {searchable && (
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
              <Input
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder={searchPlaceholder}
                className="pl-9 bg-[#0D1220] border-[#1E293B] text-[#F8FAFC] placeholder:text-[#475569] focus:border-[#3B82F6] focus:ring-0"
              />
            </div>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-[var(--text-muted)]">
              {filteredRowCount} rows
            </span>
            {handleCSVDownload && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCSVDownload}
                className="gap-1.5 text-xs bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]"
              >
                <Download className="h-3.5 w-3.5" />
                CSV
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-[#1E293B] overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="border-[var(--border)] bg-[#0D1424] hover:bg-[#0D1424]"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="sticky top-0 z-10 bg-[#0D1424] text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] border-b-2 border-[#1E293B]"
                  >
                    {header.isPlaceholder ? null : (
                      <div
                        className={cn(
                          "flex items-center gap-1",
                          header.column.getCanSort() &&
                            "cursor-pointer select-none hover:text-[var(--text-primary)]"
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {header.column.getCanSort() &&
                          (header.column.getIsSorted() === "asc" ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : header.column.getIsSorted() === "desc" ? (
                            <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-40" />
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
                  className="h-24 text-center text-[13px] text-[#475569]"
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
                    "border-[var(--border)] hover:bg-[#1A2035] transition-colors",
                    idx % 2 === 0 ? "bg-[#0A0F1E]" : "bg-[#0F1629]",
                    onRowClick && "cursor-pointer"
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className="text-[13px] text-[#CBD5E1]"
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
          <span className="text-[11px] text-[#64748B]">
            Page {currentPage} of {pageCount}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="h-8 w-8 p-0 bg-[#0D1220] border-[#1E293B] text-[#64748B] hover:bg-[#1A2035] hover:text-[#CBD5E1] disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="h-8 w-8 p-0 bg-[#0D1220] border-[#1E293B] text-[#64748B] hover:bg-[#1A2035] hover:text-[#CBD5E1] disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
