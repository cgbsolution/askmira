"use client";

import { Building2, Loader2, Pencil, Plus, ShieldAlert, Ban } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/common/EmptyState";
import { InlineProblem, QueryBoundary, errorDetail, todayISO } from "@/components/expenses/ReviewCommon";
import { humanizeKey } from "@/components/expenses/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
          {(rows) =>
            rows.length === 0 ? (
              <EmptyState
                icon={Building2}
                title="No registrations recorded"
                description="Without the company's GSTIN, whether tax should be IGST or CGST + SGST cannot be checked."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">Legal entity</TableHead>
                    <TableHead>GSTIN</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead className="pr-5">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="pl-5 font-medium text-foreground">{entityName(row.legal_entity_id)}</TableCell>
                      <TableCell className="tabular-nums">{row.gstin}</TableCell>
                      <TableCell>
                        {row.state_code}
                        {row.state_name && ` · ${row.state_name}`}
                      </TableCell>
                      <TableCell className="pr-5">
                        <Badge variant={row.is_active ? "success" : "muted"}>{row.is_active ? "Active" : "Inactive"}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          }
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

function BlockedCategories({ canAdmin }: { canAdmin: boolean }) {
  const query = useApiQuery<GstBlockedCategory[]>("/gst/blocked-categories");
  const defaults = useApiQuery<BlockedCategoryDefaults>("/gst/blocked-categories/defaults");
  const [editing, setEditing] = useState<{ initial: BlockedCategoryInput; isNew: boolean } | null>(null);

  const configuredKeys = new Set((query.data ?? []).map((row) => row.category_key));

  return (
    <div className="grid gap-4">
      <Card tier="tier1">
        <CardHeader>
          <CardTitle>Blocked categories</CardTitle>
          <CardDescription>
            Categories whose input tax credit is blocked under Section 17(5), as configured for this workspace.
          </CardDescription>
          {canAdmin && (
            <CardAction>
              <Button size="sm" onClick={() => setEditing({ initial: BLANK, isNew: true })}>
                <Plus /> Add category
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <QueryBoundary query={query}>
            {(rows) =>
              rows.length === 0 ? (
                <EmptyState
                  icon={Ban}
                  title="No categories configured"
                  description="The shipped defaults below apply until a category is configured here."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-5">Category</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Exceptions</TableHead>
                      <TableHead>Review</TableHead>
                      {canAdmin && <TableHead className="pr-5" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id} className="align-top">
                        <TableCell className="pl-5 font-medium text-foreground">{humanizeKey(row.category_key)}</TableCell>
                        <TableCell className="max-w-80 whitespace-normal">
                          <p>{row.reason}</p>
                          <p className="text-xs text-muted-foreground">{row.reference}</p>
                        </TableCell>
                        <TableCell className="max-w-64 whitespace-normal">
                          {row.has_exceptions ? (
                            <>
                              <Badge variant="warning">Has exceptions — goes to review</Badge>
                              {row.exception_note && (
                                <p className="mt-1 text-xs text-muted-foreground">{row.exception_note}</p>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground">None</span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          {row.reviewed ? (
                            <>
                              <Badge variant="success">Reviewed</Badge>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {row.reviewed_by ?? "—"}
                                {row.reviewed_on && ` · ${formatDay(row.reviewed_on, true)}`}
                              </p>
                            </>
                          ) : (
                            <Badge variant="warning">Unreviewed</Badge>
                          )}
                        </TableCell>
                        {canAdmin && (
                          <TableCell className="pr-5 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setEditing({
                                  isNew: false,
                                  initial: {
                                    category_key: row.category_key,
                                    reason: row.reason,
                                    reference: row.reference,
                                    has_exceptions: row.has_exceptions,
                                    exception_note: row.exception_note,
                                    reviewed: row.reviewed,
                                    reviewed_by: row.reviewed_by,
                                    reviewed_on: row.reviewed_on,
                                  },
                                })
                              }
                            >
                              <Pencil /> Edit
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )
            }
          </QueryBoundary>
        </CardContent>
      </Card>

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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-5">Category</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Exceptions</TableHead>
                      {canAdmin && <TableHead className="pr-5" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.rules.map((rule) => (
                      <TableRow key={rule.category_key} className="align-top">
                        <TableCell className="pl-5 font-medium text-foreground">
                          {humanizeKey(rule.category_key)}
                          {configuredKeys.has(rule.category_key) && (
                            <Badge variant="outline" className="ml-2">
                              Configured
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-80 whitespace-normal">
                          <p>{rule.reason}</p>
                          <p className="text-xs text-muted-foreground">{rule.reference}</p>
                        </TableCell>
                        <TableCell className="max-w-72 whitespace-normal text-muted-foreground">
                          {rule.has_exceptions ? (rule.exception_note ?? "Has exceptions") : "None"}
                        </TableCell>
                        {canAdmin && (
                          <TableCell className="pr-5 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setEditing({
                                  isNew: !configuredKeys.has(rule.category_key),
                                  initial: {
                                    category_key: rule.category_key,
                                    reason: rule.reason,
                                    reference: rule.reference,
                                    has_exceptions: rule.has_exceptions,
                                    exception_note: rule.exception_note,
                                    reviewed: false,
                                    reviewed_by: null,
                                    reviewed_on: null,
                                  },
                                })
                              }
                            >
                              Start from this
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
