"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Loader2, Pencil, Plus, Table2, Trash2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/data-table/DataTable";
import { CustomFieldInputs } from "@/components/people/CustomFields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, del, patch, post } from "@/lib/api";
import { CUSTOM_FIELD_TYPE, type CustomField, type CustomFieldType } from "@/lib/types/people";
import { formatDay } from "@/lib/utils";

interface Column {
  key: string;
  label: string;
  field_type: CustomFieldType;
  options: string[] | null;
  is_required: boolean;
}

interface TableDefinition {
  id: string;
  key: string;
  label: string;
  columns: Column[];
  is_sensitive: boolean;
  employee_editable: boolean;
  display_order: number;
  active: boolean;
  /** The profile tab it sits on; null for the Employment tab. */
  tab: string | null;
}

interface TableWithRows extends TableDefinition {
  rows: TableRowValues[];
  can_edit: boolean;
}

type TableRowValues = { id: string; values: Record<string, unknown> };

function failure(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.detail : fallback;
}

function asField(column: Column): CustomField {
  return { id: column.key, key: column.key, label: column.label, field_type: column.field_type, options: column.options, is_required: column.is_required, is_sensitive: false, display_order: 0, is_active: true, tab: null };
}

function show(column: Column, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (column.field_type === "boolean") return value ? "Yes" : "No";
  if (column.field_type === "date") return formatDay(String(value), true);
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

/** What a column sorts by: a date by its ISO value, anything else by what it shows. */
function sortKey(column: Column, value: unknown): string {
  return column.field_type === "date" && typeof value === "string" && value !== "" ? value : show(column, value);
}

/**
 * The admin-named tabs a viewer's profile shows, from the custom fields and
 * tables placed on them, in the order of their first item.
 */
export function useCustomTabs(enabled: boolean): string[] {
  const fields = useApiQuery<CustomField[]>(enabled ? "/org/custom-fields" : null);
  const tables = useApiQuery<TableDefinition[]>(enabled ? "/org/custom-tables" : null);
  const placed = [
    ...(fields.data ?? []).filter((f) => f.is_active).map((f) => ({ tab: f.tab, order: f.display_order })),
    ...(tables.data ?? []).filter((t) => t.active).map((t) => ({ tab: t.tab, order: t.display_order })),
  ]
    .filter((item): item is { tab: string; order: number } => Boolean(item.tab))
    .sort((a, b) => a.order - b.order);
  return [...new Set(placed.map((item) => item.tab))];
}

/** The custom tables on one person's record, with their rows: one tab's, or the untabbed. */
export function CustomTablesSection({ employeeId, tab = null }: { employeeId: string; tab?: string | null }) {
  const { data, reload } = useApiQuery<TableWithRows[]>(`/employees/${employeeId}/custom-tables`);
  const [editing, setEditing] = useState<{ table: TableWithRows; rowId: string | null; values: Record<string, unknown> } | null>(null);
  const tables = (data ?? []).filter((table) => (table.tab ?? null) === tab);
  if (tables.length === 0) return null;

  const remove = async (rowId: string) => {
    try {
      await del(`/employees/custom-table-rows/${rowId}`);
      reload();
    } catch (caught) {
      toast.error(failure(caught, "The row could not be removed."));
    }
  };

  const actionsColumn = (table: TableWithRows): ColumnDef<TableRowValues> => ({
    id: "actions",
    header: "",
    enableHiding: false,
    meta: { className: "w-20 text-right", text: false },
    cell: ({ row }) => (
      <div className="flex justify-end gap-1">
        <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setEditing({ table, rowId: row.original.id, values: row.original.values })}>
          <Pencil />
        </Button>
        <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => void remove(row.original.id)}>
          <Trash2 />
        </Button>
      </div>
    ),
  });

  // Column ids carry a prefix: an admin may name a column "actions".
  const columnsFor = (table: TableWithRows): ColumnDef<TableRowValues>[] => [
    ...table.columns.map(
      (c): ColumnDef<TableRowValues> => ({
        id: `field_${c.key}`,
        header: c.label,
        accessorFn: (row) => sortKey(c, row.values[c.key]),
        meta: { text: (row) => show(c, row.values[c.key]) },
        cell: ({ row }) => show(c, row.original.values[c.key]),
      }),
    ),
    ...(table.can_edit ? [actionsColumn(table)] : []),
  ];

  return (
    <div className="grid gap-6">
      {tables.map((table) => (
        <DataTable
          key={table.id}
          tier="tier2"
          title={
            <span className="flex items-center gap-2">
              <Table2 className="size-4 text-primary" /> {table.label}
            </span>
          }
          actions={
            table.can_edit && (
              <Button size="sm" variant="outline" onClick={() => setEditing({ table, rowId: null, values: {} })}>
                <Plus /> Add
              </Button>
            )
          }
          columns={columnsFor(table)}
          data={table.rows}
          noun="entries"
          exportName={table.key.replace(/_/g, "-")}
          searchPlaceholder="Search entries"
          empty={{ icon: Table2, title: "Nothing recorded yet." }}
        />
      ))}
      {editing && (
        <RowDialog
          employeeId={employeeId}
          {...editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function RowDialog({
  employeeId,
  table,
  rowId,
  values: initial,
  onClose,
  onSaved,
}: {
  employeeId: string;
  table: TableWithRows;
  rowId: string | null;
  values: Record<string, unknown>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Record<string, unknown>>(initial);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const body = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== null && v !== "" && !(Array.isArray(v) && v.length === 0)));
    try {
      if (rowId) await patch(`/employees/custom-table-rows/${rowId}`, body);
      else await post(`/employees/${employeeId}/custom-tables/${table.id}/rows`, body);
      onSaved();
    } catch (caught) {
      toast.error(failure(caught, "The row could not be saved."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{rowId ? "Edit" : "Add to"} {table.label}</DialogTitle>
          <DialogDescription>Saved on the record and in the audit trail.</DialogDescription>
        </DialogHeader>
        <CustomFieldInputs fields={table.columns.map(asField)} values={values} onChange={(key, value) => setValues((c) => ({ ...c, [key]: value }))} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={() => void save()}>
            {busy && <Loader2 className="animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Admin: design the tables. */
export function CustomTablesPanel() {
  const { data, error, isLoading, reload } = useApiQuery<TableDefinition[]>("/org/custom-tables?include_inactive=true");
  const [editing, setEditing] = useState<TableDefinition | "new" | null>(null);
  const columns: ColumnDef<TableDefinition>[] = [
    {
      accessorKey: "label",
      header: "Table",
      meta: { text: (t) => `${t.label} ${t.key}` },
      cell: ({ row }) => (
        <>
          <p className="font-medium">{row.original.label}</p>
          <p className="font-mono text-xs text-muted-foreground">{row.original.key}</p>
        </>
      ),
    },
    {
      id: "columns",
      header: "Columns",
      accessorFn: (t) => t.columns.map((c) => c.label).join(", "),
      meta: { cellClassName: "text-sm" },
    },
    {
      id: "rules",
      header: "Rules",
      accessorFn: (t) =>
        [!t.active && "Off", t.is_sensitive && "Sensitive", t.employee_editable && "Person edits"]
          .filter(Boolean)
          .join(", "),
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {!row.original.active && <Badge variant="muted">Off</Badge>}
          {row.original.is_sensitive && <Badge variant="warning">Sensitive</Badge>}
          {row.original.employee_editable && <Badge variant="secondary">Person edits</Badge>}
        </div>
      ),
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      meta: { className: "w-12 text-right", text: false },
      cell: ({ row }) => (
        <Button size="icon" variant="ghost" aria-label={`Edit ${row.original.label}`} onClick={() => setEditing(row.original)}>
          <Pencil />
        </Button>
      ),
    },
  ];
  return (
    <>
      <DataTable
        tier="tier1"
        title="Custom tables"
        description="Lists on every record — certifications, languages, licences. Each has typed columns."
        actions={
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus /> Add a table
          </Button>
        }
        columns={columns}
        data={data ?? []}
        noun="tables"
        exportName="custom-tables"
        searchPlaceholder="Search tables"
        rowClassName={(t) => (t.active ? undefined : "opacity-60")}
        isLoading={isLoading && !data}
        error={error?.detail ?? null}
        onRetry={reload}
        empty={{ icon: Table2, title: "No custom tables" }}
      />
      {editing && (
        <TableDialog
          table={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </>
  );
}

function TableDialog({ table, onClose, onSaved }: { table: TableDefinition | null; onClose: () => void; onSaved: () => void }) {
  const [key, setKey] = useState(table?.key ?? "");
  const [label, setLabel] = useState(table?.label ?? "");
  const [columns, setColumns] = useState<Column[]>(table?.columns ?? [{ key: "name", label: "Name", field_type: "text", options: null, is_required: true }]);
  const [sensitive, setSensitive] = useState(table?.is_sensitive ?? false);
  const [editable, setEditable] = useState(table?.employee_editable ?? false);
  const [active, setActive] = useState(table?.active ?? true);
  const [tab, setTab] = useState(table?.tab ?? "");
  const [busy, setBusy] = useState(false);

  const setColumn = (index: number, patchValue: Partial<Column>) => setColumns((c) => c.map((col, i) => (i === index ? { ...col, ...patchValue } : col)));

  const save = async () => {
    setBusy(true);
    const cols = columns.map((c) => ({ ...c, options: c.field_type === "select" || c.field_type === "multiselect" ? c.options ?? [] : null }));
    try {
      if (table)
        await patch(`/org/custom-tables/${table.id}`, {
          label: label.trim(),
          columns: cols,
          is_sensitive: sensitive,
          employee_editable: editable,
          active,
          tab: tab.trim(),
        });
      else
        await post("/org/custom-tables", {
          key: key.trim(),
          label: label.trim(),
          columns: cols,
          is_sensitive: sensitive,
          employee_editable: editable,
          tab: tab.trim() || null,
        });
      toast.success("Table saved.");
      onSaved();
    } catch (caught) {
      toast.error(failure(caught, "The table could not be saved."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{table ? `Edit ${table.label}` : "Add a custom table"}</DialogTitle>
          <DialogDescription>Once a table holds rows, its columns keep their keys and types.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="ct-key">Key</Label>
              <Input id="ct-key" className="font-mono" value={key} disabled={table !== null} onChange={(e) => setKey(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ct-label">Label</Label>
              <Input id="ct-label" value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="ct-tab">Profile tab (optional)</Label>
              <Input
                id="ct-tab"
                maxLength={40}
                placeholder="A tab of your own, like Safety. Empty: the Employment tab."
                value={tab}
                onChange={(e) => setTab(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Columns</Label>
            {columns.map((column, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[8rem_1fr_9rem_1fr_auto] sm:items-center">
                <Input aria-label="Column key" className="font-mono" value={column.key} onChange={(e) => setColumn(index, { key: e.target.value })} />
                <Input aria-label="Column label" value={column.label} onChange={(e) => setColumn(index, { label: e.target.value })} />
                <Select value={column.field_type} onValueChange={(v) => setColumn(index, { field_type: v as CustomFieldType })}>
                  <SelectTrigger aria-label="Column type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CUSTOM_FIELD_TYPE).map(([value, text]) => (
                      <SelectItem key={value} value={value}>
                        {text}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  aria-label="Options, comma separated"
                  placeholder={column.field_type === "select" || column.field_type === "multiselect" ? "Options, comma separated" : "—"}
                  disabled={!(column.field_type === "select" || column.field_type === "multiselect")}
                  value={(column.options ?? []).join(", ")}
                  onChange={(e) => setColumn(index, { options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean) })}
                />
                <Button size="icon" variant="ghost" aria-label="Remove column" disabled={columns.length === 1} onClick={() => setColumns((c) => c.filter((_, i) => i !== index))}>
                  <Trash2 />
                </Button>
              </div>
            ))}
            <Button
              size="sm"
              variant="outline"
              className="justify-self-start"
              onClick={() => setColumns((c) => [...c, { key: "", label: "", field_type: "text", options: null, is_required: false }])}
            >
              <Plus /> Add a column
            </Button>
          </div>
          <div className="grid gap-2">
            <div className="flex items-center gap-2">
              <Switch id="ct-sensitive" checked={sensitive} onCheckedChange={setSensitive} />
              <Label htmlFor="ct-sensitive" className="font-normal">
                Sensitive — hidden from the person it is about
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="ct-editable" checked={editable} onCheckedChange={setEditable} />
              <Label htmlFor="ct-editable" className="font-normal">
                The person adds and edits their own rows
              </Label>
            </div>
            {table && (
              <div className="flex items-center gap-2">
                <Switch id="ct-active" checked={active} onCheckedChange={setActive} />
                <Label htmlFor="ct-active" className="font-normal">
                  In use
                </Label>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || !/^[a-z][a-z0-9_]{1,63}$/.test(key) || label.trim().length < 2 || columns.some((c) => !/^[a-z][a-z0-9_]{1,63}$/.test(c.key) || !c.label.trim())} onClick={() => void save()}>
            {busy && <Loader2 className="animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
