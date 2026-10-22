"use client";

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
  type FilterFn,
  type PaginationState,
  type Row,
  type RowData,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown, Download, Search, Settings2, X } from "lucide-react";
import React, { useMemo, useState } from "react";

import { IconInput } from "@/components/common/IconInput";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { downloadCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";

import { DataTablePagination } from "./DataTablePagination";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** The column's name in the column picker and the CSV header, when its header is not plain text. */
    label?: string;
    /** Classes for its header and its cells, e.g. "text-right" or "w-14". */
    className?: string;
    /**
     * What the CSV and the search read for this column. Defaults to the
     * accessor's value; a column with only a `cell` needs it to be exported or
     * searched. `false` leaves the column out of the export.
     */
    text?: ((row: TData) => string | number | null | undefined) | false;
  }
}

/** Server paging: the API returns one page, the table shows it and asks for others. */
export type ServerPaging = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  /** The search box, when the API does the searching. */
  search?: string;
  onSearchChange?: (value: string) => void;
};

export type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /** Keeps a selection across sorting and reloads. Defaults to the row's `id`. */
  getRowId?: (row: TData, index: number) => string;
  /** "employees", in "Showing 1–10 of 42 employees". */
  noun?: string;
  /** The search box. `false` hides it. */
  searchPlaceholder?: string | false;
  /** The screen's own filters, shown in the toolbar beside the search. */
  toolbar?: React.ReactNode;
  /** Row checkboxes. On by default. */
  selectable?: boolean;
  /** Actions on the ticked rows, shown in the bar that appears once any are ticked. */
  bulkActions?: (selected: TData[], clearSelection: () => void) => React.ReactNode;
  /** The CSV's file name, without ".csv". `false` hides Export. Defaults to the noun. */
  exportName?: string | false;
  pageSize?: number;
  server?: ServerPaging;
  onRowClick?: (row: TData) => void;
  rowClassName?: (row: TData) => string | undefined;
  /** Shown when the search or filters leave nothing. */
  emptyMessage?: string;
  className?: string;
};

function defaultRowId<TData>(row: TData, index: number): string {
  const id = (row as { id?: unknown }).id;
  return typeof id === "string" || typeof id === "number" ? String(id) : String(index);
}

function columnLabel<TData>(column: Column<TData, unknown>): string | null {
  const header = column.columnDef.header;
  return column.columnDef.meta?.label ?? (typeof header === "string" ? header : null);
}

/** The text a column holds for one row: for search and for the CSV. */
function columnText<TData>(row: Row<TData>, column: Column<TData, unknown>): string | number | null | undefined {
  const text = column.columnDef.meta?.text;
  if (text === false) return undefined;
  if (text) return text(row.original);
  if (!column.accessorFn) return undefined;
  const value = row.getValue(column.id);
  if (value === null || value === undefined) return value;
  return typeof value === "object" ? undefined : (value as string | number);
}

const SELECT_COLUMN = "__select";

/**
 * Every list in the portal: search, sortable headers, a column picker, row
 * checkboxes with export and bulk actions, and paging.
 *
 *   <DataPanel title="Employees" isLoading={…} isEmpty={rows.length === 0} empty={…}>
 *     <DataTable columns={columns} data={rows} noun="employees"
 *                bulkActions={(selected, clear) => <Button …>Deactivate</Button>} />
 *   </DataPanel>
 *
 * The DataPanel around it keeps loading, error and "nothing yet" states; this
 * handles "nothing matches the search". Paging is in memory unless `server` is
 * given, for lists the API pages itself.
 */
export function DataTable<TData, TValue>({
  columns,
  data,
  getRowId = defaultRowId,
  noun = "rows",
  searchPlaceholder = "Search…",
  toolbar,
  selectable = true,
  bulkActions,
  exportName,
  pageSize: initialPageSize = 10,
  server,
  onRowClick,
  rowClassName,
  emptyMessage = "Nothing matches your search or filters.",
  className,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: initialPageSize });

  const allColumns = useMemo<ColumnDef<TData, TValue>[]>(() => {
    if (!selectable) return columns;
    const select: ColumnDef<TData, TValue> = {
      id: SELECT_COLUMN,
      enableSorting: false,
      enableHiding: false,
      meta: { className: "w-10 pl-6", text: false },
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all on this page"
          checked={
            table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() ? "indeterminate" : false)
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(Boolean(value))}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label="Select row"
          checked={row.getIsSelected()}
          disabled={!row.getCanSelect()}
          onClick={(event) => event.stopPropagation()}
          onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
        />
      ),
    };
    return [select, ...columns];
  }, [columns, selectable]);

  const globalFilterFn = useMemo<FilterFn<TData>>(
    () => (row, columnId, query: string) => {
      const column = row.getAllCells().find((cell) => cell.column.id === columnId)?.column;
      const value = column ? columnText(row, column as Column<TData, unknown>) : undefined;
      return value !== null && value !== undefined && String(value).toLowerCase().includes(query.toLowerCase());
    },
    [],
  );

  const table = useReactTable({
    data,
    columns: allColumns,
    getRowId,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      globalFilter: server ? undefined : globalFilter,
      pagination: server ? { pageIndex: server.page - 1, pageSize: server.pageSize } : pagination,
    },
    enableRowSelection: selectable,
    // Sorting one page of a server-paged list would pretend to sort all of it.
    enableSorting: !server,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    globalFilterFn,
    getColumnCanGlobalFilter: (column) =>
      column.id !== SELECT_COLUMN &&
      column.columnDef.meta?.text !== false &&
      (Boolean(column.accessorFn) || Boolean(column.columnDef.meta?.text)),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: server ? undefined : getFilteredRowModel(),
    getPaginationRowModel: server ? undefined : getPaginationRowModel(),
    manualPagination: Boolean(server),
    autoResetPageIndex: true,
  });

  const clearSelection = () => setRowSelection({});
  const selectedRows = table.getSelectedRowModel().rows;
  const filteredRows = table.getPrePaginationRowModel().rows;
  const total = server ? server.total : filteredRows.length;
  const page = server ? server.page : pagination.pageIndex + 1;
  const pageSize = server ? server.pageSize : pagination.pageSize;
  const visibleRows = table.getRowModel().rows;
  const hideable = table
    .getAllLeafColumns()
    .filter((column) => column.getCanHide() && columnLabel(column as Column<TData, unknown>));
  const fileName = exportName === false ? null : (exportName ?? noun);

  const exportRows = () => {
    const rows = selectedRows.length > 0 ? selectedRows : filteredRows;
    const exported = table
      .getVisibleLeafColumns()
      .filter((column) => column.id !== SELECT_COLUMN && column.columnDef.meta?.text !== false)
      .filter((column) => column.accessorFn || column.columnDef.meta?.text) as Column<TData, unknown>[];
    downloadCsv(
      fileName ?? "export",
      exported.map((column) => columnLabel(column) ?? column.id),
      rows.map((row) => exported.map((column) => columnText(row, column))),
    );
  };

  const changePage = (next: number) => {
    if (server) {
      setRowSelection({});
      server.onPageChange(next);
    } else {
      table.setPageIndex(next - 1);
    }
  };
  const changePageSize = (size: number) => {
    if (server) {
      setRowSelection({});
      server.onPageSizeChange?.(size);
    } else {
      table.setPageSize(size);
    }
  };

  const searchValue = server ? (server.search ?? "") : globalFilter;
  const showSearch = searchPlaceholder !== false && (!server || server.onSearchChange);

  return (
    <div data-slot="data-table" className={cn("flex flex-col", className)}>
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-3">
        {showSearch && (
          <div className="w-full sm:w-64">
            <IconInput
              icon={Search}
              value={searchValue}
              onChange={(event) =>
                server ? server.onSearchChange?.(event.target.value) : setGlobalFilter(event.target.value)
              }
              placeholder={searchPlaceholder || undefined}
              aria-label={searchPlaceholder || "Search"}
              className="h-9"
            />
          </div>
        )}
        {toolbar}
        <div className="ml-auto flex items-center gap-2">
          {fileName && (
            <Button variant="outline" size="sm" onClick={exportRows} disabled={total === 0}>
              <Download />
              {selectedRows.length > 0 ? `Export ${selectedRows.length} selected` : "Export"}
            </Button>
          )}
          {hideable.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings2 /> Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Show columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {hideable.map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(Boolean(value))}
                    onSelect={(event) => event.preventDefault()}
                  >
                    {columnLabel(column as Column<TData, unknown>)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {selectedRows.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-mint-50 px-6 py-2 text-sm">
          <span className="font-medium text-foreground">{selectedRows.length} selected</span>
          {!server && !table.getIsAllRowsSelected() && table.getIsAllPageRowsSelected() && total > visibleRows.length && (
            <Button variant="link" size="sm" className="h-auto px-0" onClick={() => table.toggleAllRowsSelected(true)}>
              Select all {total} {noun}
            </Button>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {bulkActions?.(
              selectedRows.map((row) => row.original),
              clearSelection,
            )}
          </div>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={clearSelection}>
            <X /> Clear
          </Button>
        </div>
      )}

      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id} className="hover:bg-transparent">
              {group.headers.map((header) => {
                const meta = header.column.columnDef.meta;
                const sorted = header.column.getIsSorted();
                return (
                  <TableHead key={header.id} className={meta?.className}>
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-2 h-7 px-2 text-xs font-semibold tracking-wide uppercase"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sorted === "asc" ? <ArrowUp /> : sorted === "desc" ? <ArrowDown /> : <ChevronsUpDown className="opacity-50" />}
                      </Button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {visibleRows.length > 0 ? (
            visibleRows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() ? "selected" : undefined}
                className={cn(onRowClick && "cursor-pointer", rowClassName?.(row.original))}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className={cell.column.columnDef.meta?.className}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={table.getVisibleLeafColumns().length} className="h-24 text-center text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <DataTablePagination
        page={page}
        pageSize={pageSize}
        total={total}
        selected={selectedRows.length}
        noun={noun}
        onPageChange={changePage}
        onPageSizeChange={!server || server.onPageSizeChange ? changePageSize : undefined}
      />
    </div>
  );
}
