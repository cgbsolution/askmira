"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ListPlus, Loader2, Pencil, Plus } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/data-table/DataTable";
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

  const columns: ColumnDef<CustomField>[] = [
    {
      accessorKey: "label",
      header: "Field",
      meta: { text: (row) => `${row.label} ${row.key}` },
      cell: ({ row }) => (
        <>
          <p className="font-medium">{row.original.label}</p>
          <p className="font-mono text-xs text-muted-foreground">{row.original.key}</p>
        </>
      ),
    },
    {
      id: "type",
      header: "Type",
      accessorFn: (row) => CUSTOM_FIELD_TYPE[row.field_type],
      meta: {
        text: (row) =>
          `${CUSTOM_FIELD_TYPE[row.field_type]}${row.options && row.options.length > 0 ? ` · ${row.options.join(", ")}` : ""}`,
      },
      cell: ({ row }) => (
        <>
          {CUSTOM_FIELD_TYPE[row.original.field_type]}
          {row.original.options && row.original.options.length > 0 && (
            <p className="text-xs text-muted-foreground">{row.original.options.join(", ")}</p>
          )}
        </>
      ),
    },
    {
      id: "rules",
      header: "Rules",
      accessorFn: (row) =>
        [!row.is_active && "Off", row.is_required && "Required", row.is_sensitive && "Sensitive"]
          .filter(Boolean)
          .join(", "),
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {!row.original.is_active && <Badge variant="muted">Off</Badge>}
          {row.original.is_required && <Badge variant="secondary">Required</Badge>}
          {row.original.is_sensitive && <Badge variant="warning">Sensitive</Badge>}
        </div>
      ),
    },
    {
      accessorKey: "display_order",
      header: "Order",
      meta: { className: "text-right", cellClassName: "tabular-nums" },
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      meta: { className: "w-12 text-right", text: false },
      cell: ({ row }) => (
        <Button
          size="icon"
          variant="ghost"
          aria-label={`Edit ${row.original.label}`}
          onClick={() => setEditing(row.original)}
        >
          <Pencil />
        </Button>
      ),
    },
  ];

  return (
    <>
      <DataTable
        tier="tier1"
        title="Custom fields"
        description="Extra fields shown on every employee's profile and edited by HR. A sensitive field is hidden from the person it is about."
        columns={columns}
        data={data ?? []}
        noun="fields"
        exportName="custom-fields"
        searchPlaceholder="Search fields"
        rowClassName={(row) => (row.is_active ? undefined : "opacity-60")}
        actions={
          <Button size="sm" className="h-9" onClick={() => setEditing("new")}>
            <Plus /> Add a field
          </Button>
        }
        isLoading={isLoading}
        error={error?.detail}
        onRetry={reload}
        empty={{
          icon: ListPlus,
          title: "No custom fields",
          description: "Add one for anything your records need that the standard profile does not hold.",
        }}
      />
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
