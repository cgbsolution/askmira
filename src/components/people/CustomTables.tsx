"use client";

import { Loader2, Pencil, Plus, Table2, Trash2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { CustomFieldInputs } from "@/components/people/CustomFields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  rows: { id: string; values: Record<string, unknown> }[];
  can_edit: boolean;
}

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

  return (
    <div className="grid gap-6">
      {tables.map((table) => (
        <Card key={table.id} tier="tier2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Table2 className="size-4 text-primary" /> {table.label}
            </CardTitle>
            {table.can_edit && (
              <CardAction>
                <Button size="sm" variant="outline" onClick={() => setEditing({ table, rowId: null, values: {} })}>
                  <Plus /> Add
                </Button>
              </CardAction>
            )}
          </CardHeader>
          <CardContent>
            {table.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {table.columns.map((c) => (
                      <TableHead key={c.key}>{c.label}</TableHead>
                    ))}
                    {table.can_edit && <TableHead className="w-20" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {table.rows.map((row) => (
                    <TableRow key={row.id}>
                      {table.columns.map((c) => (
                        <TableCell key={c.key}>{show(c, row.values[c.key])}</TableCell>
                      ))}
                      {table.can_edit && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setEditing({ table, rowId: row.id, values: row.values })}>
                              <Pencil />
                            </Button>
                            <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => void remove(row.id)}>
                              <Trash2 />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
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
  const rows = data ?? [];
  return (
    <>
      <DataPanel
        tier="tier1"
        title="Custom tables"
        description="Lists on every record — certifications, languages, licences. Each has typed columns."
        actions={
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus /> Add a table
          </Button>
        }
        isLoading={isLoading && !data}
        error={error?.detail ?? null}
        onRetry={reload}
        isEmpty={rows.length === 0}
        empty={{ icon: Table2, title: "No custom tables" }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Table</TableHead>
              <TableHead>Columns</TableHead>
              <TableHead>Rules</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((t) => (
              <TableRow key={t.id} className={t.active ? undefined : "opacity-60"}>
                <TableCell>
                  <p className="font-medium">{t.label}</p>
                  <p className="font-mono text-xs text-muted-foreground">{t.key}</p>
                </TableCell>
                <TableCell className="text-sm">{t.columns.map((c) => c.label).join(", ")}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {!t.active && <Badge variant="muted">Off</Badge>}
                    {t.is_sensitive && <Badge variant="warning">Sensitive</Badge>}
                    {t.employee_editable && <Badge variant="secondary">Person edits</Badge>}
                  </div>
                </TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" aria-label={`Edit ${t.label}`} onClick={() => setEditing(t)}>
                    <Pencil />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>
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
