"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Building2, Loader2, Lock, Pencil, Plus, ShieldAlert, Ban } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/data-table/DataTable";
import { InlineProblem, QueryBoundary, errorDetail, todayISO } from "@/components/expenses/ReviewCommon";
import { humanizeKey } from "@/components/expenses/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { put } from "@/lib/api";
import type {
  BlockedCategoryDefaults,
  BlockedCategoryInput,
  EntityRegistrationInput,
  GstBlockedCategory,
  GstEntityRegistration,
  OrgLegalEntity,
} from "@/lib/types/expenses";
import { formatDay } from "@/lib/utils";

/** The company's own GST registrations and the Section 17(5) blocked categories. */
export function GstConfigPanel({ canAdmin }: { canAdmin: boolean }) {
  return (
    <div className="grid gap-6">
      <EntityRegistrations canAdmin={canAdmin} />
      <BlockedCategories canAdmin={canAdmin} />
    </div>
  );
}

// ── Entity registrations ────────────────────────────────────────────────────

function EntityRegistrations({ canAdmin }: { canAdmin: boolean }) {
  const query = useApiQuery<GstEntityRegistration[]>("/gst/entity-registrations");
  const entities = useApiQuery<OrgLegalEntity[]>("/org/legal-entities");
  const [entityId, setEntityId] = useState("");
  const [gstin, setGstin] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const entityName = (id: string) => entities.data?.find((entity) => entity.id === id)?.name ?? "Unknown entity";
  const valid = Boolean(entityId) && /^[0-9A-Z]{15}$/.test(gstin);

  const columns: ColumnDef<GstEntityRegistration>[] = [
    {
      id: "legal_entity",
      header: "Legal entity",
      accessorFn: (row) => entityName(row.legal_entity_id),
      meta: { cellClassName: "font-medium text-foreground" },
    },
    { accessorKey: "gstin", header: "GSTIN", meta: { cellClassName: "tabular-nums" } },
    {
      id: "state",
      header: "State",
      accessorFn: (row) => `${row.state_code}${row.state_name ? ` · ${row.state_name}` : ""}`,
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (row) => (row.is_active ? "Active" : "Inactive"),
      cell: ({ row }) => (
        <Badge variant={row.original.is_active ? "success" : "muted"}>
          {row.original.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
  ];

  const save = async () => {
    if (!valid) return;
    setIsSaving(true);
    setProblem(null);
    try {
      const body: EntityRegistrationInput = { legal_entity_id: entityId, gstin };
      await put("/gst/entity-registrations", body);
      toast.success(`GSTIN ${gstin} registered for ${entityName(entityId)}`);
      setGstin("");
      query.reload();
    } catch (error) {
      setProblem(errorDetail(error, "Could not register the GSTIN."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle>Entity registrations</CardTitle>
        <CardDescription>
          The company&apos;s own GSTINs. They decide the place of supply on every invoice, so an invalid one is refused.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 p-0">
        <QueryBoundary query={query}>
          {(rows) => (
            <DataTable
              bordered={false}
              columns={columns}
              data={rows}
              noun="registrations"
              exportName="gst-entity-registrations"
              searchPlaceholder="Search registrations"
              empty={{
                icon: Building2,
                title: "No registrations recorded",
                description: "Without the company's GSTIN, whether tax should be IGST or CGST + SGST cannot be checked.",
              }}
            />
          )}
        </QueryBoundary>

        {canAdmin && (
          <form
            className="grid gap-3 border-t px-5 pt-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="entity-reg-entity">Legal entity</Label>
              {entities.error ? (
                <p className="text-sm text-destructive">{entities.error.detail}</p>
              ) : (
                <Select value={entityId} onValueChange={setEntityId}>
                  <SelectTrigger id="entity-reg-entity" className="w-full">
                    <SelectValue placeholder={entities.data?.length === 0 ? "No legal entities set up" : "Choose"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(entities.data ?? []).map((entity) => (
                      <SelectItem key={entity.id} value={entity.id}>
                        {entity.name} ({entity.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="entity-reg-gstin">GSTIN</Label>
              <Input
                id="entity-reg-gstin"
                value={gstin}
                maxLength={15}
                className="tabular-nums uppercase"
                onChange={(event) => setGstin(event.target.value.toUpperCase().replace(/[^0-9A-Z]/g, ""))}
              />
            </div>
            <Button type="submit" disabled={!valid || isSaving}>
              {isSaving ? <Loader2 className="animate-spin" /> : <Plus />}
              Register
            </Button>
            {problem && (
              <div className="sm:col-span-3">
                <InlineProblem>{problem}</InlineProblem>
              </div>
            )}
          </form>
        )}
      </CardContent>
    </Card>
  );
}

// ── Blocked categories ──────────────────────────────────────────────────────

const BLANK: BlockedCategoryInput = {
  category_key: "",
  reason: "",
  reference: "",
  has_exceptions: false,
  exception_note: null,
  reviewed: false,
  reviewed_by: null,
  reviewed_on: null,
};

type DefaultRule = BlockedCategoryDefaults["rules"][number];

function BlockedCategories({ canAdmin }: { canAdmin: boolean }) {
  const query = useApiQuery<GstBlockedCategory[]>("/gst/blocked-categories");
  const defaults = useApiQuery<BlockedCategoryDefaults>("/gst/blocked-categories/defaults");
  const [editing, setEditing] = useState<{ initial: BlockedCategoryInput; isNew: boolean } | null>(null);

  const configuredKeys = new Set((query.data ?? []).map((row) => row.category_key));
  // A 403 reads as "no access", not as a failed load.
  const forbidden = query.error?.status === 403;

  const editColumn: ColumnDef<GstBlockedCategory> = {
    id: "actions",
    header: "",
    enableHiding: false,
    meta: { className: "text-right", text: false },
    cell: ({ row }) => (
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          setEditing({
            isNew: false,
            initial: {
              category_key: row.original.category_key,
              reason: row.original.reason,
              reference: row.original.reference,
              has_exceptions: row.original.has_exceptions,
              exception_note: row.original.exception_note,
              reviewed: row.original.reviewed,
              reviewed_by: row.original.reviewed_by,
              reviewed_on: row.original.reviewed_on,
            },
          })
        }
      >
        <Pencil /> Edit
      </Button>
    ),
  };

  const columns: ColumnDef<GstBlockedCategory>[] = [
    {
      id: "category",
      header: "Category",
      accessorFn: (row) => humanizeKey(row.category_key),
      meta: { cellClassName: "font-medium text-foreground" },
    },
    {
      accessorKey: "reason",
      header: "Reason",
      meta: { cellClassName: "max-w-80 whitespace-normal", text: (row) => `${row.reason} · ${row.reference}` },
      cell: ({ row }) => (
        <>
          <p>{row.original.reason}</p>
          <p className="text-xs text-muted-foreground">{row.original.reference}</p>
        </>
      ),
    },
    {
      id: "exceptions",
      header: "Exceptions",
      accessorFn: (row) => (row.has_exceptions ? "Has exceptions — goes to review" : "None"),
      meta: {
        cellClassName: "max-w-64 whitespace-normal",
        text: (row) =>
          row.has_exceptions
            ? ["Has exceptions — goes to review", row.exception_note].filter(Boolean).join(" · ")
            : "None",
      },
      cell: ({ row }) =>
        row.original.has_exceptions ? (
          <>
            <Badge variant="warning">Has exceptions — goes to review</Badge>
            {row.original.exception_note && (
              <p className="mt-1 text-xs text-muted-foreground">{row.original.exception_note}</p>
            )}
          </>
        ) : (
          <span className="text-muted-foreground">None</span>
        ),
    },
    {
      id: "review",
      header: "Review",
      accessorFn: (row) => (row.reviewed ? "Reviewed" : "Unreviewed"),
      meta: {
        cellClassName: "whitespace-normal",
        text: (row) =>
          row.reviewed
            ? ["Reviewed", row.reviewed_by, row.reviewed_on && formatDay(row.reviewed_on, true)]
                .filter(Boolean)
                .join(" · ")
            : "Unreviewed",
      },
      cell: ({ row }) =>
        row.original.reviewed ? (
          <>
            <Badge variant="success">Reviewed</Badge>
            <p className="mt-1 text-xs text-muted-foreground">
              {row.original.reviewed_by ?? "—"}
              {row.original.reviewed_on && ` · ${formatDay(row.original.reviewed_on, true)}`}
            </p>
          </>
        ) : (
          <Badge variant="warning">Unreviewed</Badge>
        ),
    },
    ...(canAdmin ? [editColumn] : []),
  ];

  const startColumn: ColumnDef<DefaultRule> = {
    id: "actions",
    header: "",
    enableHiding: false,
    meta: { className: "text-right", text: false },
    cell: ({ row }) => (
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          setEditing({
            isNew: !configuredKeys.has(row.original.category_key),
            initial: {
              category_key: row.original.category_key,
              reason: row.original.reason,
              reference: row.original.reference,
              has_exceptions: row.original.has_exceptions,
              exception_note: row.original.exception_note,
              reviewed: false,
              reviewed_by: null,
              reviewed_on: null,
            },
          })
        }
      >
        Start from this
      </Button>
    ),
  };

  const defaultColumns: ColumnDef<DefaultRule>[] = [
    {
      id: "category",
      header: "Category",
      accessorFn: (rule) => humanizeKey(rule.category_key),
      meta: {
        cellClassName: "font-medium text-foreground",
        text: (rule) =>
          `${humanizeKey(rule.category_key)}${configuredKeys.has(rule.category_key) ? " · Configured" : ""}`,
      },
      cell: ({ row }) => (
        <>
          {humanizeKey(row.original.category_key)}
          {configuredKeys.has(row.original.category_key) && (
            <Badge variant="outline" className="ml-2">
              Configured
            </Badge>
          )}
        </>
      ),
    },
    {
      accessorKey: "reason",
      header: "Reason",
      meta: { cellClassName: "max-w-80 whitespace-normal", text: (rule) => `${rule.reason} · ${rule.reference}` },
      cell: ({ row }) => (
        <>
          <p>{row.original.reason}</p>
          <p className="text-xs text-muted-foreground">{row.original.reference}</p>
        </>
      ),
    },
    {
      id: "exceptions",
      header: "Exceptions",
      accessorFn: (rule) => (rule.has_exceptions ? (rule.exception_note ?? "Has exceptions") : "None"),
      meta: { cellClassName: "max-w-72 whitespace-normal text-muted-foreground" },
    },
    ...(canAdmin ? [startColumn] : []),
  ];

  return (
    <div className="grid gap-4">
      <DataTable
        title="Blocked categories"
        description="Categories whose input tax credit is blocked under Section 17(5), as configured for this workspace."
        actions={
          canAdmin ? (
            <Button size="sm" onClick={() => setEditing({ initial: BLANK, isNew: true })}>
              <Plus /> Add category
            </Button>
          ) : undefined
        }
        columns={columns}
        data={forbidden ? [] : (query.data ?? [])}
        noun="categories"
        exportName="gst-blocked-categories"
        searchPlaceholder="Search categories"
        rowClassName={() => "align-top"}
        isLoading={query.isLoading && query.data === null}
        error={forbidden ? null : (query.error?.detail ?? null)}
        onRetry={query.reload}
        loadingRows={3}
        empty={
          forbidden
            ? { icon: Lock, title: "You don't have access to this", description: query.error?.detail }
            : {
                icon: Ban,
                title: "No categories configured",
                description: "The shipped defaults below apply until a category is configured here.",
              }
        }
      />

      <Card tier="tier1">
        <CardHeader>
          <CardTitle>Shipped defaults</CardTitle>
          <CardDescription>The reading of Section 17(5) this module ships with, with its exceptions written out.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 p-0">
          <QueryBoundary query={defaults}>
            {(data) => (
              <>
                <div className="px-5">
                  <Alert variant="warning">
                    <ShieldAlert />
                    <AlertTitle>Unreviewed</AlertTitle>
                    <AlertDescription>
                      <p>{data.warning}</p>
                    </AlertDescription>
                  </Alert>
                </div>
                <DataTable
                  bordered={false}
                  columns={defaultColumns}
                  data={data.rules}
                  getRowId={(rule) => rule.category_key}
                  noun="rules"
                  exportName="gst-blocked-category-defaults"
                  searchPlaceholder="Search rules"
                  rowClassName={() => "align-top"}
                />
              </>
            )}
          </QueryBoundary>
        </CardContent>
      </Card>

      {canAdmin && (
        <BlockedCategoryDialog
          editing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            query.reload();
          }}
        />
      )}
    </div>
  );
}

function BlockedCategoryDialog({
  editing,
  onClose,
  onSaved,
}: {
  editing: { initial: BlockedCategoryInput; isNew: boolean } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<BlockedCategoryInput>(BLANK);
  const [touched, setTouched] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!editing) return;
    setForm(editing.initial);
    setTouched(false);
    setProblem(null);
  }, [editing]);

  const set = <K extends keyof BlockedCategoryInput>(key: K, value: BlockedCategoryInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const errors = {
    category_key: !/^[a-z0-9_]{1,64}$/.test(form.category_key),
    reason: !form.reason.trim(),
    reference: !form.reference.trim(),
    exception_note: form.has_exceptions && !form.exception_note?.trim(),
    reviewed_by: form.reviewed && !form.reviewed_by?.trim(),
    reviewed_on: form.reviewed && !form.reviewed_on,
  };
  const valid = Object.values(errors).every((bad) => !bad);

  const save = async () => {
    setTouched(true);
    if (!valid) return;
    setIsSaving(true);
    setProblem(null);
    try {
      const body: BlockedCategoryInput = {
        category_key: form.category_key,
        reason: form.reason.trim(),
        reference: form.reference.trim(),
        has_exceptions: form.has_exceptions,
        exception_note: form.has_exceptions ? (form.exception_note?.trim() ?? null) : null,
        reviewed: form.reviewed,
        reviewed_by: form.reviewed ? (form.reviewed_by?.trim() ?? null) : null,
        reviewed_on: form.reviewed ? form.reviewed_on : null,
      };
      await put<GstBlockedCategory>("/gst/blocked-categories", body);
      toast.success(`${humanizeKey(body.category_key)} saved`);
      onSaved();
    } catch (error) {
      setProblem(errorDetail(error, "Could not save the category."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={editing !== null} onOpenChange={(open) => !open && !isSaving && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing?.isNew ? "Add a blocked category" : `Edit ${humanizeKey(form.category_key)}`}</DialogTitle>
          <DialogDescription>
            Mark a rule reviewed only once a tax advisor has read it. Until then a category with exceptions sends its
            lines to the review queue.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="blocked-key">Category key</Label>
            <Input
              id="blocked-key"
              value={form.category_key}
              disabled={editing !== null && !editing.isNew}
              aria-invalid={touched && errors.category_key}
              onChange={(e) => set("category_key", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="blocked-reason">Reason</Label>
            <Textarea
              id="blocked-reason"
              rows={2}
              maxLength={2000}
              value={form.reason}
              aria-invalid={touched && errors.reason}
              onChange={(e) => set("reason", e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="blocked-reference">Reference</Label>
            <Input
              id="blocked-reference"
              value={form.reference}
              maxLength={200}
              placeholder="e.g. CGST Act s.17(5)(b)"
              aria-invalid={touched && errors.reference}
              onChange={(e) => set("reference", e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="blocked-exceptions">Has exceptions</Label>
              <p className="text-xs text-muted-foreground">Lines go to review instead of being decided.</p>
            </div>
            <Switch id="blocked-exceptions" checked={form.has_exceptions} onCheckedChange={(v) => set("has_exceptions", v)} />
          </div>
          {form.has_exceptions && (
            <div className="grid gap-1.5">
              <Label htmlFor="blocked-exception-note">Exception note</Label>
              <Textarea
                id="blocked-exception-note"
                rows={2}
                maxLength={2000}
                value={form.exception_note ?? ""}
                aria-invalid={touched && errors.exception_note}
                onChange={(e) => set("exception_note", e.target.value)}
              />
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="blocked-reviewed">Reviewed by a tax advisor</Label>
              <p className="text-xs text-muted-foreground">Record who reviewed it and when.</p>
            </div>
            <Switch
              id="blocked-reviewed"
              checked={form.reviewed}
              onCheckedChange={(v) => {
                set("reviewed", v);
                if (v && !form.reviewed_on) set("reviewed_on", todayISO());
              }}
            />
          </div>
          {form.reviewed && (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="blocked-reviewed-by">Reviewed by</Label>
                <Input
                  id="blocked-reviewed-by"
                  value={form.reviewed_by ?? ""}
                  maxLength={200}
                  aria-invalid={touched && errors.reviewed_by}
                  onChange={(e) => set("reviewed_by", e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="blocked-reviewed-on">Reviewed on</Label>
                <Input
                  id="blocked-reviewed-on"
                  type="date"
                  value={form.reviewed_on ?? ""}
                  aria-invalid={touched && errors.reviewed_on}
                  onChange={(e) => set("reviewed_on", e.target.value || null)}
                />
              </div>
            </div>
          )}
          {touched && !valid && <p className="text-sm text-destructive">Fill in the highlighted fields.</p>}
          {problem && <InlineProblem>{problem}</InlineProblem>}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={isSaving} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={isSaving || (touched && !valid)} onClick={() => void save()}>
            {isSaving && <Loader2 className="animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
