"use client";

import { ListPlus, Loader2, Pencil, Plus } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { FormField } from "@/components/common/FormField";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, patch, post } from "@/lib/api";
import { CUSTOM_FIELD_TYPE, type CustomField, type CustomFieldType } from "@/lib/types/people";

function failure(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.detail : fallback;
}

function keyFrom(label: string): string {
  const key = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
  return /^[a-z]/.test(key) ? key : `f_${key}`.slice(0, 64);
}

/**
 * Extra fields on every employee record — a T-shirt size, a locker number, a
 * blood group. The key and type are fixed once created, because records hold
 * values under them; a field no longer wanted is switched off, and the values
 * already saved stay on the records.
 */
export function CustomFieldsPanel() {
  const { data, error, isLoading, reload } = useApiQuery<CustomField[]>("/org/custom-fields?include_inactive=true");
  const [editing, setEditing] = useState<CustomField | "new" | null>(null);
  const rows = data ?? [];

  return (
    <>
      <DataPanel
        tier="tier1"
        title="Custom fields"
        description="Extra fields shown on every employee's profile and edited by HR. A sensitive field is hidden from the person it is about."
        actions={
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus /> Add a field
          </Button>
        }
        isLoading={isLoading}
        error={error?.detail ?? null}
        onRetry={reload}
        isEmpty={rows.length === 0}
        empty={{
          icon: ListPlus,
          title: "No custom fields",
          description: "Add one for anything your records need that the standard profile does not hold.",
        }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Field</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Rules</TableHead>
              <TableHead className="text-right">Order</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} className={row.is_active ? undefined : "opacity-60"}>
                <TableCell>
                  <p className="font-medium">{row.label}</p>
                  <p className="font-mono text-xs text-muted-foreground">{row.key}</p>
                </TableCell>
                <TableCell>
                  {CUSTOM_FIELD_TYPE[row.field_type]}
                  {row.options && row.options.length > 0 && (
                    <p className="text-xs text-muted-foreground">{row.options.join(", ")}</p>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {!row.is_active && <Badge variant="muted">Off</Badge>}
                    {row.is_required && <Badge variant="secondary">Required</Badge>}
                    {row.is_sensitive && <Badge variant="warning">Sensitive</Badge>}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.display_order}</TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" aria-label={`Edit ${row.label}`} onClick={() => setEditing(row)}>
                    <Pencil />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>
      {editing && (
        <FieldDialog
          field={editing === "new" ? null : editing}
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

function FieldDialog({
  field,
  onClose,
  onSaved,
}: {
  field: CustomField | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState(field?.label ?? "");
  const [key, setKey] = useState(field?.key ?? "");
  const [keyTouched, setKeyTouched] = useState(false);
  const [type, setType] = useState<CustomFieldType>(field?.field_type ?? "text");
  const [options, setOptions] = useState((field?.options ?? []).join("\n"));
  const [required, setRequired] = useState(field?.is_required ?? false);
  const [sensitive, setSensitive] = useState(field?.is_sensitive ?? false);
  const [order, setOrder] = useState(String(field?.display_order ?? 0));
  const [tab, setTab] = useState(field?.tab ?? "");
  const [active, setActive] = useState(field?.is_active ?? true);
  const [busy, setBusy] = useState(false);

  const hasOptions = type === "select" || type === "multiselect";
  const optionList = options
    .split("\n")
    .map((o) => o.trim())
    .filter(Boolean);

  const save = async () => {
    setBusy(true);
    const common = {
      label: label.trim(),
      options: hasOptions ? optionList : null,
      is_required: required,
      is_sensitive: sensitive,
      display_order: Number(order) || 0,
      tab: tab.trim() || (field ? "" : null),
    };
    try {
      if (field) {
        await patch(`/org/custom-fields/${field.id}`, { ...common, is_active: active });
      } else {
        await post("/org/custom-fields", { ...common, key, field_type: type });
      }
      toast.success(field ? "Field saved." : "Field added.");
      onSaved();
    } catch (caught) {
      toast.error(failure(caught, "The field could not be saved."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{field ? `Edit ${field.label}` : "Add a custom field"}</DialogTitle>
          <DialogDescription>
            {field
              ? "The key and type stay as they are: records already hold values under them."
              : "Choose the key and type with care — they cannot change once records hold values."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField htmlFor="cf-label" label="Label">
            <Input
              id="cf-label"
              maxLength={255}
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
                if (!field && !keyTouched) setKey(keyFrom(e.target.value));
              }}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField htmlFor="cf-key" label="Key" hint="Lower case, digits and underscores.">
              <Input
                id="cf-key"
                className="font-mono"
                maxLength={64}
                value={key}
                disabled={field !== null}
                onChange={(e) => {
                  setKeyTouched(true);
                  setKey(e.target.value);
                }}
              />
            </FormField>
            <FormField htmlFor="cf-type" label="Type">
              <Select value={type} onValueChange={(v) => setType(v as CustomFieldType)} disabled={field !== null}>
                <SelectTrigger id="cf-type" className="w-full">
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
            </FormField>
          </div>
          {hasOptions && (
            <FormField htmlFor="cf-options" label="Options" hint="One per line.">
              <Textarea id="cf-options" rows={4} value={options} onChange={(e) => setOptions(e.target.value)} />
            </FormField>
          )}
          <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
            <FormField htmlFor="cf-order" label="Order on the profile">
              <Input id="cf-order" type="number" min={0} max={10000} value={order} onChange={(e) => setOrder(e.target.value)} />
            </FormField>
            <FormField
              htmlFor="cf-tab"
              label="Profile tab"
              optional
              hint="A tab of your own, like Safety or Uniform. Empty: More details, on the Employment tab."
            >
              <Input id="cf-tab" maxLength={40} value={tab} onChange={(e) => setTab(e.target.value)} />
            </FormField>
          </div>
          <div className="grid gap-3">
            <div className="flex items-center gap-2">
              <Switch id="cf-required" checked={required} onCheckedChange={setRequired} />
              <Label htmlFor="cf-required" className="font-normal">
                Required — a record cannot be saved without it
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="cf-sensitive" checked={sensitive} onCheckedChange={setSensitive} />
              <Label htmlFor="cf-sensitive" className="font-normal">
                Sensitive — hidden from the person it is about
              </Label>
            </div>
            {field && (
              <div className="flex items-center gap-2">
                <Switch id="cf-active" checked={active} onCheckedChange={setActive} />
                <Label htmlFor="cf-active" className="font-normal">
                  In use — switched off, it leaves the profile and saved values are kept
                </Label>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy || !label.trim() || !/^[a-z][a-z0-9_]{1,63}$/.test(key) || (hasOptions && optionList.length === 0)}
            onClick={() => void save()}
          >
            {busy && <Loader2 className="animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
