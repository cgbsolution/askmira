"use client";

import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type CellContext,
  type Column,
  type ColumnDef,
  type FilterFn,
  type HeaderContext,
  type PaginationState,
  type Row,
  type RowData,
  type RowSelectionState,
  type SortingState,
  type Updater,
  type VisibilityState,
} from "@tanstack/react-table";
import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Download, Loader2, Search, Settings2, X } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { IconInput } from "@/components/common/IconInput";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { downloadCsv } from "@/lib/csv";
import { Tr } from "@/lib/i18n/Tr";
import { cn } from "@/lib/utils";

import { DataTablePagination } from "./DataTablePagination";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** The column's name in the column picker and the CSV header, when its header is not plain text. */
    label?: string;
    /** Classes for its header and its cells, e.g. "text-right" or "w-14". */
    className?: string;
    /** Classes for its header only. */
    headClassName?: string;
    /** Classes for its cells only. */
    cellClassName?: string;
    /**
     * What the search and the CSV read for this column. Defaults to the
     * accessor's value; a column with only a `cell` needs it to be searched or
     * exported. `false` leaves the column out of both.
     */
    text?: ((row: TData) => string | number | null | undefined) | false;
  }
}

/** Server paging: the API returns one page, the table shows it and asks for others. */
export type ServerPaging = {
  /** 1-based. */
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  /**
   * Every row the list holds, across all pages. With it, "Select all N" can
   * tick the whole list, not only the page on screen.
   */
  fetchAll?: () => Promise<unknown[]>;
};

export type DataTableEmpty = {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /** Keeps a selection across sorting and reloads. Defaults to the row's `id`. */
  getRowId?: (row: TData, index: number) => string;
  /** "employees", in "Showing 1–10 of 42 employees". */
  noun?: string;

  /**
   * "list" (the default) has the toolbar, checkboxes and paging. "plain" is a
   * short fixed table inside a form or a document: the same look, none of the
   * list tools.
   */
  variant?: "list" | "plain";
  /** With a title the table is its own card, header and all. */
  title?: React.ReactNode;
  description?: React.ReactNode;
  tier?: "tier1" | "tier2";
  /** Buttons at the right of the header: "Add employee", refresh… */
  actions?: React.ReactNode;
  /** The screen's own filters (Selects, date pickers), beside the search. */
  filters?: React.ReactNode;
  /** Tabs or a switch under the header: Queue / My tasks. */
  tabs?: React.ReactNode;
  /** Without a title: a border round the table. Off when it sits in a bordered box already. */
  bordered?: boolean;

  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** "Nothing yet", shown only when there is no data at all and nothing narrows it. */
  empty?: DataTableEmpty;
  /** The screen's own filters are narrowing the list, so an empty list means "nothing matches". */
  filtered?: boolean;
  /** Shown in the table when a search or filter leaves nothing. */
  emptyMessage?: string;
  loadingRows?: number;

  /** The search box. `false` hides it. */
  searchPlaceholder?: string | false;
  /**
   * A search the screen runs itself (usually by asking the API). With
   * `onSearchChange` the box shows `search` and the table does not filter
   * its rows; without it the table searches the rows it has.
   */
  search?: string;
  onSearchChange?: (value: string) => void;
  /** Row checkboxes. On for lists. */
  selectable?: boolean;
  /** Actions on the ticked rows, in the bar that appears once any are ticked. */
  bulkActions?: (selected: TData[], clearSelection: () => void) => React.ReactNode;
  /** The CSV's file name, without ".csv". `false` hides Export. Defaults to the noun. */
  exportName?: string | false;
  /**
   * The screen's own export, in place of the CSV of the visible columns: it gets
   * the ticked rows (across every page), or null when nothing is ticked.
   */
  onExport?: (selected: TData[] | null) => Promise<void> | void;
  /** The Columns menu. On for lists. */
  columnPicker?: boolean;
  /** `false` shows every row with no paging footer. */
  paginate?: boolean;
  pageSize?: number;
  server?: ServerPaging;

  onRowClick?: (row: TData) => void;
  rowClassName?: (row: TData) => string | undefined;
  /** Content under a row, across the whole table: details the screen has opened. */
  renderExpanded?: (row: TData) => React.ReactNode;
  className?: string;
};

const SELECT_COLUMN = "__select";
const INTERACTIVE = "button, a, input, select, textarea, label, [role=checkbox], [role=menuitem], [role=switch], [role=combobox]";

function defaultRowId<TData>(row: TData, index: number): string {
  const id = (row as { id?: unknown }).id;
  return typeof id === "string" || typeof id === "number" ? String(id) : String(index);
}

function columnLabel<TData>(column: Column<TData, unknown>): string | null {
  const header = column.columnDef.header;
  return column.columnDef.meta?.label ?? (typeof header === "string" && header.trim() ? header : null);
}

/** The text a column holds for one row: for the search and the CSV. */
function columnText<TData>(row: Row<TData>, column: Column<TData, unknown>): string | number | null | undefined {
  return originalText(row.original, row.index, column);
}

/** The same, from the row's data alone: a ticked row on another page has no `Row`. */
function originalText<TData>(
  original: TData,
  index: number,
  column: Column<TData, unknown>,
): string | number | null | undefined {
  const text = column.columnDef.meta?.text;
  if (text === false) return undefined;
  if (text) return text(original);
  if (!column.accessorFn) return undefined;
  const value = column.accessorFn(original, index);
  if (value === null || value === undefined) return value;
  if (typeof value === "string" || typeof value === "number") return value;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return undefined;
}

/**
 * A header, cell or footer from its column definition. Called, not mounted as
 * a component: a column list rebuilt on every render then keeps its inputs
 * (and their focus) instead of remounting them. A cell therefore must not call
 * hooks itself; it can render a component that does.
 */
function render<TContext>(content: unknown, context: TContext): React.ReactNode {
  return typeof content === "function"
    ? (content as (context: TContext) => React.ReactNode)(context)
    : (content as React.ReactNode);
}

function translated(value: React.ReactNode): React.ReactNode {
  return typeof value === "string" ? <Tr text={value} /> : value;
}

/**
 * A "No." column: the row's place in the list as shown, across pages.
 *
 *   columns={[serialColumn(), …]}
 */
export function serialColumn<TData>(): ColumnDef<TData> {
  return {
    id: "__serial",
    header: "No.",
    enableSorting: false,
    enableHiding: false,
    meta: { className: "w-14 tabular-nums text-muted-foreground", text: false },
    cell: ({ row, table }) => {
      const { pageIndex, pageSize } = table.getState().pagination;
      const at = table.getRowModel().rows.findIndex((shown) => shown.id === row.id);
      return pageIndex * pageSize + at + 1;
    },
  };
}

/**
 * Every table in the portal.
 *
 * A list (the default) has search, sortable headers, a Columns menu, Export,
 * row checkboxes with bulk actions, and "Showing 1–10 of 42 · Rows per page ·
 * Previous 1 / 5 Next". With a `title` it is its own card — title and
 * description at the left, filters, search and actions at the right, as in the
 * Helpdesk queue — and it shows loading, error and "nothing yet" itself:
 *
 *   <DataTable title="Employees" description="Everyone in the company."
 *              columns={columns} data={rows} noun="employees"
 *              filters={<StatusSelect …/>} actions={<Button>Add employee</Button>}
 *              isLoading={isLoading} error={error?.detail} onRetry={reload}
 *              empty={{ icon: Users, title: "No employees yet" }}
 *              bulkActions={(selected, clear) => <Button …>Deactivate</Button>} />
 *
 * Without a title it is the same table in a bordered box, for a dialog, a tab
 * or a card that has its own header. `variant="plain"` is a short fixed table
 * (a breakdown, a form grid) with the same look and none of the list tools.
 *
 * Paging is in memory unless `server` is given, for lists the API pages.
 */
export function DataTable<TData, TValue>({
  columns,
  data,
  getRowId = defaultRowId,
  noun = "rows",
  variant = "list",
  title,
  description,
  tier = "tier1",
  actions,
  filters,
  tabs,
  bordered,
  isLoading = false,
  error,
  onRetry,
  empty,
  filtered = false,
  emptyMessage = "Nothing matches your search or filters.",
  loadingRows = 5,
  searchPlaceholder = "Search…",
  search: externalSearch,
  onSearchChange,
  selectable: selectableProp = true,
  bulkActions,
  exportName,
  onExport,
  columnPicker = true,
  paginate: paginateProp = true,
  pageSize: initialPageSize = 10,
  server,
  onRowClick,
  rowClassName,
  renderExpanded,
  className,
}: DataTableProps<TData, TValue>) {
  const plain = variant === "plain";
  const selectable = !plain && selectableProp;
  const paginate = !plain && paginateProp;
  const card = title !== undefined || description !== undefined;

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
      meta: { className: "w-10", text: false },
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
      return value !== null && value !== undefined && String(value).toLowerCase().includes(query.trim().toLowerCase());
    },
    [],
  );

  // A new search starts at page one.
  const changeGlobalFilter = (updater: Updater<string>) => {
    setGlobalFilter((previous) => (typeof updater === "function" ? updater(previous) : updater));
    setPagination((previous) => ({ ...previous, pageIndex: 0 }));
  };

  const table = useReactTable({
    data,
    columns: allColumns,
    getRowId,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      globalFilter: server || onSearchChange ? undefined : globalFilter,
      pagination: server
        ? { pageIndex: Math.max(0, server.page - 1), pageSize: server.pageSize }
        : paginate
          ? pagination
          : { pageIndex: 0, pageSize: Math.max(data.length, 1) },
    },
    enableRowSelection: selectable,
    // Sorting one page of a server-paged list would pretend to sort all of it.
    enableSorting: !plain && !server,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: changeGlobalFilter,
    onPaginationChange: setPagination,
    globalFilterFn,
    getColumnCanGlobalFilter: (column) =>
      column.id !== SELECT_COLUMN &&
      column.columnDef.meta?.text !== false &&
      (Boolean(column.accessorFn) || Boolean(column.columnDef.meta?.text)),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: server || onSearchChange ? undefined : getFilteredRowModel(),
    getPaginationRowModel: server || !paginate ? undefined : getPaginationRowModel(),
    manualPagination: Boolean(server) || !paginate,
    // Editing a row changes `data`; that must not throw the reader back to page one.
    autoResetPageIndex: false,
  });

  const filteredRows = table.getPrePaginationRowModel().rows;
  const pageCount = paginate && !server ? Math.max(1, Math.ceil(filteredRows.length / pagination.pageSize)) : 1;

  // A list that shrank (a delete, a filter) never leaves the reader on an empty page 4 of 2.
  useEffect(() => {
    if (!server && pagination.pageIndex > pageCount - 1) {
      setPagination((previous) => ({ ...previous, pageIndex: pageCount - 1 }));
    }
  }, [server, pagination.pageIndex, pageCount]);

  // A server-paged list shows one page at a time, so the rows ticked on other
  // pages are kept here: ticking survives Next, Previous and a new search.
  const picked = useRef(new Map<string, TData>());
  const [selectingAll, setSelectingAll] = useState(false);
  const [exporting, setExporting] = useState(false);
  if (server) {
    for (const row of table.getCoreRowModel().rows) {
      if (rowSelection[row.id]) picked.current.set(row.id, row.original);
    }
    for (const id of [...picked.current.keys()]) {
      if (!rowSelection[id]) picked.current.delete(id);
    }
  }
  const clearSelection = () => {
    picked.current.clear();
    setRowSelection({});
  };
  const pageSelected = table.getSelectedRowModel().rows;
  const selectedOriginals: TData[] = server
    ? Object.keys(rowSelection)
        .filter((id) => rowSelection[id] && picked.current.has(id))
        .map((id) => picked.current.get(id) as TData)
    : pageSelected.map((row) => row.original);
  const selectedCount = selectedOriginals.length;
  const total = server ? server.total : filteredRows.length;
  const page = server ? server.page : Math.min(pagination.pageIndex, pageCount - 1) + 1;
  const pageSize = server ? server.pageSize : pagination.pageSize;
  const visibleRows = table.getRowModel().rows;
  const leafCount = table.getVisibleLeafColumns().length;
  const searching = onSearchChange ? Boolean(externalSearch?.trim()) : Boolean(globalFilter.trim());
  const hideable = table
    .getAllLeafColumns()
    .filter((column) => column.getCanHide() && columnLabel(column as Column<TData, unknown>));
  const hasFooter = table.getAllLeafColumns().some((column) => column.columnDef.footer !== undefined);
  const fileName = plain || exportName === false ? null : (exportName ?? noun);

  const exportRows = async () => {
    if (onExport) {
      setExporting(true);
      try {
        await onExport(selectedCount > 0 ? selectedOriginals : null);
      } finally {
        setExporting(false);
      }
      return;
    }
    const exported = table
      .getVisibleLeafColumns()
      .filter((column) => column.id !== SELECT_COLUMN && column.columnDef.meta?.text !== false)
      .filter((column) => column.accessorFn || column.columnDef.meta?.text) as Column<TData, unknown>[];
    const originals =
      selectedCount > 0
        ? selectedOriginals
        : server?.fetchAll
          ? ((await server.fetchAll()) as TData[])
          : filteredRows.map((row) => row.original);
    downloadCsv(
      fileName ?? "export",
      exported.map((column) => columnLabel(column) ?? column.id),
      originals.map((original, index) => exported.map((column) => originalText(original, index, column))),
    );
  };

  const selectEverything = async () => {
    if (!server?.fetchAll) {
      table.toggleAllRowsSelected(true);
      return;
    }
    setSelectingAll(true);
    try {
      const everything = (await server.fetchAll()) as TData[];
      const next: RowSelectionState = {};
      everything.forEach((original, index) => {
        const id = getRowId(original, index);
        picked.current.set(id, original);
        next[id] = true;
      });
      setRowSelection(next);
    } finally {
      setSelectingAll(false);
    }
  };

  // Ticks are kept across pages: moving on never drops what was chosen.
  const changePage = (next: number) => {
    if (server) server.onPageChange(next);
    else table.setPageIndex(next - 1);
  };
  const changePageSize = (size: number) => {
    if (server) server.onPageSizeChange?.(size);
    else setPagination({ pageIndex: 0, pageSize: size });
  };

  const showSearch = !plain && searchPlaceholder !== false && (!server || Boolean(onSearchChange));
  const searchValue = onSearchChange ? (externalSearch ?? "") : globalFilter;
  const searchBox = showSearch ? (
    <div className="w-full sm:w-64">
      <IconInput
        icon={Search}
        value={searchValue}
        onChange={(event) =>
          onSearchChange ? onSearchChange(event.target.value) : changeGlobalFilter(event.target.value)
        }
        placeholder={searchPlaceholder || undefined}
        aria-label={searchPlaceholder || "Search"}
        className="h-9"
      />
    </div>
  ) : null;

  const tools =
    fileName || (!plain && columnPicker && hideable.length > 0) ? (
      <>
        {fileName && (
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => void exportRows()}
            disabled={total === 0 || exporting}
          >
            {exporting ? <Loader2 className="animate-spin" /> : <Download />}
            {selectedCount > 0 ? `Export ${selectedCount} selected` : "Export"}
          </Button>
        )}
        {!plain && columnPicker && hideable.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
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
      </>
    ) : null;

  const edge = card ? "px-6" : "px-4";
  // The first and last columns line up with the header's text.
  const edgeCells = card
    ? "[&_td:first-child]:pl-6 [&_th:first-child]:pl-6 [&_td:last-child]:pr-6 [&_th:last-child]:pr-6"
    : "[&_td:first-child]:pl-4 [&_th:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th:last-child]:pr-4";

  const selectionBar =
    selectedCount > 0 ? (
      <div className={cn("flex flex-wrap items-center gap-3 border-b border-border bg-blush-50 py-2 text-sm", edge)}>
        <span className="font-medium text-foreground">
          {selectedCount} selected
          {server && selectedCount > pageSelected.length ? ` (${selectedCount - pageSelected.length} on other pages)` : ""}
        </span>
        {(server ? Boolean(server.fetchAll) && selectedCount < total : !table.getIsAllRowsSelected()) &&
          table.getIsAllPageRowsSelected() &&
          total > visibleRows.length && (
            <Button
              variant="link"
              size="sm"
              className="h-auto px-0"
              disabled={selectingAll}
              onClick={() => void selectEverything()}
            >
              {selectingAll && <Loader2 className="animate-spin" />}
              Select all {total} {noun}
            </Button>
          )}
        {bulkActions && (
          <div className="flex flex-wrap items-center gap-2">
            {bulkActions(selectedOriginals, clearSelection)}
          </div>
        )}
        <Button variant="ghost" size="sm" className="ml-auto" onClick={clearSelection}>
          <X /> Clear
        </Button>
      </div>
    ) : null;

  const grid = (
    <Table className={edgeCells}>
      <TableHeader>
        {table.getHeaderGroups().map((group) => (
          <TableRow key={group.id} className="bg-muted/50 hover:bg-muted/50">
            {group.headers.map((header) => {
              const meta = header.column.columnDef.meta;
              const sorted = header.column.getIsSorted();
              const content = header.isPlaceholder
                ? null
                : render(header.column.columnDef.header, header.getContext() as HeaderContext<TData, unknown>);
              return (
                <TableHead
                  key={header.id}
                  colSpan={header.colSpan > 1 ? header.colSpan : undefined}
                  className={cn(meta?.className, meta?.headClassName)}
                >
                  {!header.isPlaceholder && header.column.getCanSort() ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-mx-2 h-7 px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase hover:text-foreground"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {content}
                      {sorted === "asc" ? (
                        <ArrowUp />
                      ) : sorted === "desc" ? (
                        <ArrowDown />
                      ) : (
                        <ChevronsUpDown className="opacity-40" />
                      )}
                    </Button>
                  ) : (
                    content
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {visibleRows.length > 0 ? (
          visibleRows.map((row) => {
            const expanded = renderExpanded?.(row.original);
            return (
              <React.Fragment key={row.id}>
                <TableRow
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  className={cn(onRowClick && "cursor-pointer", rowClassName?.(row.original))}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={
                    onRowClick
                      ? (event) => {
                          if ((event.target as HTMLElement).closest(INTERACTIVE)) return;
                          onRowClick(row.original);
                        }
                      : undefined
                  }
                  onKeyDown={
                    onRowClick
                      ? (event) => {
                          if (event.target !== event.currentTarget) return;
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onRowClick(row.original);
                          }
                        }
                      : undefined
                  }
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta;
                    return (
                      <TableCell key={cell.id} className={cn(meta?.className, meta?.cellClassName)}>
                        {render(cell.column.columnDef.cell, cell.getContext() as CellContext<TData, unknown>)}
                      </TableCell>
                    );
                  })}
                </TableRow>
                {expanded ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={leafCount} className="whitespace-normal bg-muted/20">
                      {expanded}
                    </TableCell>
                  </TableRow>
                ) : null}
              </React.Fragment>
            );
          })
        ) : (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={leafCount} className="h-24 text-center whitespace-normal text-muted-foreground">
              <Tr text={emptyMessage} />
            </TableCell>
          </TableRow>
        )}
      </TableBody>
      {hasFooter && (
        <TableFooter>
          {table.getFooterGroups().slice(0, 1).map((group) => (
            <TableRow key={group.id} className="hover:bg-transparent">
              {group.headers.map((header) => {
                const meta = header.column.columnDef.meta;
                return (
                  <TableCell key={header.id} className={cn(meta?.className, meta?.cellClassName)}>
                    {header.isPlaceholder
                      ? null
                      : render(header.column.columnDef.footer, header.getContext() as HeaderContext<TData, unknown>)}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableFooter>
      )}
    </Table>
  );

  let body: React.ReactNode;
  let showFooter = paginate;
  if (isLoading && data.length === 0) {
    showFooter = false;
    body = (
      <div className={cn("space-y-2 py-4", edge)}>
        {Array.from({ length: loadingRows }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    );
  } else if (error) {
    showFooter = false;
    body = <ErrorState message={error} onRetry={onRetry} />;
  } else if (empty && data.length === 0 && !searching && !filtered && (!server || server.total === 0)) {
    showFooter = false;
    body = <EmptyState tier={tier} {...empty} />;
  } else {
    body = (
      <>
        {selectionBar}
        {grid}
      </>
    );
  }

  const footer = showFooter ? (
    <DataTablePagination
      page={page}
      pageSize={pageSize}
      total={total}
      selected={selectedCount}
      noun={noun}
      onPageChange={changePage}
      onPageSizeChange={!server || server.onPageSizeChange ? changePageSize : undefined}
      className={edge}
    />
  ) : null;

  if (card) {
    const hasTools = Boolean(filters || searchBox || tools || actions);
    return (
      <Card data-slot="data-table" tier={tier} className={cn("gap-0 overflow-hidden py-0", className)}>
        {/* Title at the left, tools at the right; tools that do not fit beside the
            title take the next line rather than squeezing it. */}
        <div className={cn("flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-b border-border py-5", edge)}>
          <div className="min-w-[min(100%,18rem)] flex-1 space-y-1">
            {title !== undefined && <CardTitle>{translated(title)}</CardTitle>}
            {description !== undefined && <CardDescription>{translated(description)}</CardDescription>}
          </div>
          {hasTools && (
            <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
              {filters}
              {searchBox}
              {tools}
              {actions}
            </div>
          )}
        </div>
        {tabs && <div className={cn("border-b border-border py-3", edge)}>{tabs}</div>}
        {body}
        {footer}
      </Card>
    );
  }

  const hasToolbar = Boolean(filters || searchBox || tools || actions);
  return (
    <div
      data-slot="data-table"
      className={cn(
        "flex min-w-0 flex-col",
        (bordered ?? true) && "overflow-hidden rounded-xl border border-border bg-card",
        className,
      )}
    >
      {hasToolbar && (
        <div className={cn("flex flex-wrap items-center gap-2 border-b border-border py-3", edge)}>
          {filters}
          {searchBox}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {tools}
            {actions}
          </div>
        </div>
      )}
      {tabs && <div className={cn("border-b border-border py-3", edge)}>{tabs}</div>}
      {body}
      {footer}
    </div>
  );
}
