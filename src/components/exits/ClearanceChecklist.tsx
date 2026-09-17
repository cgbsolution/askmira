"use client";

import { ClipboardCheck, Loader2 } from "lucide-react";
import React, { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  CLEARANCE_STATUS_LABELS,
  ClearanceStatusBadge,
  ownerLabel,
  timestampOrDash,
  useReloadOn,
} from "@/components/exits/common";
import { EmptyState } from "@/components/common/EmptyState";
import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import {
  apiErrorMessage,
  InlineProblem,
  isMoneyInput,
  isZero,
  QueryBoundary,
} from "@/components/payroll-ops/shared";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { patch } from "@/lib/api";
import type {
  ClearanceItem,
  ClearanceUpdateInput,
} from "@/lib/types/payroll-ops";

type Outcome = ClearanceUpdateInput["outcome"];

/**
 * The clearance checklist of one exit, grouped by department. An item can be
 * signed off only where the API says the caller may (`can_update`).
 */
export function ClearanceChecklist({
  exitId,
  isOwnExit,
  version,
  onChanged,
}: {
  exitId: string;
  isOwnExit: boolean;
  version: number;
  onChanged: () => void;
}) {
  const query = useApiQuery<ClearanceItem[]>(`/exits/${exitId}/clearance`);
  useReloadOn(version, query.reload);
  const [editing, setEditing] = useState<ClearanceItem | null>(null);

  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle>Clearance checklist</CardTitle>
        <CardDescription>
          Each department signs its items off. The settlement cannot be computed while a
          mandatory item is pending.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <QueryBoundary query={query} skeletonRows={3}>
          {(items) =>
            items.length === 0 ? (
              <EmptyState
                icon={ClipboardCheck}
                title="No clearance items"
                description="This exit has no checklist. Items come from the checklist setup when an exit starts."
              />
            ) : (
              <Groups
                items={items}
                isOwnExit={isOwnExit}
                onEdit={(item) => setEditing(item)}
              />
            )
          }
        </QueryBoundary>
      </CardContent>

      <UpdateItemDialog
        item={editing}
        onOpenChange={(open) => !open && setEditing(null)}
        onSaved={(updated) => {
          query.setData((current) =>
            current ? current.map((item) => (item.id === updated.id ? updated : item)) : current,
          );
          setEditing(null);
          onChanged();
        }}
      />
    </Card>
  );
}

function Groups({
  items,
  isOwnExit,
  onEdit,
}: {
  items: ClearanceItem[];
  isOwnExit: boolean;
  onEdit: (item: ClearanceItem) => void;
}) {
  const groups = useMemo(() => {
    const byDepartment = new Map<string, ClearanceItem[]>();
    for (const item of items) {
      const list = byDepartment.get(item.department) ?? [];
      list.push(item);
      byDepartment.set(item.department, list);
    }
    return Array.from(byDepartment.entries());
  }, [items]);

  return (
    <div className="divide-y divide-border border-t border-border">
      {groups.map(([department, list]) => (
        <section key={department} className="px-5 py-4">
          <h4 className="text-sm font-semibold text-foreground">{department}</h4>
          <ul className="mt-2 space-y-3">
            {list.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border px-3 py-2.5"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-foreground">{item.description}</span>
                    {item.is_mandatory ? (
                      <Badge variant="outline">Mandatory</Badge>
                    ) : (
                      <Badge variant="muted">Optional</Badge>
                    )}
                    <ClearanceStatusBadge status={item.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">Owner: {ownerLabel(item)}</p>
                  {!isZero(item.recovery_amount) && (
                    <p className="text-xs text-muted-foreground">
                      Recovery: <Money value={item.recovery_amount} className="text-foreground" />
                    </p>
                  )}
                  {item.status !== "pending" && (
                    <p className="text-xs text-muted-foreground">
                      {CLEARANCE_STATUS_LABELS[item.status]}
                      {item.cleared_by_name && ` by ${item.cleared_by_name}`}
                      {item.cleared_at && ` on ${timestampOrDash(item.cleared_at)}`}
                    </p>
                  )}
                  {item.waiver_reason && (
                    <p className="text-xs text-muted-foreground">
                      Waiver reason: {item.waiver_reason}
                    </p>
                  )}
                  {item.notes && (
                    <p className="text-xs text-muted-foreground">Notes: {item.notes}</p>
                  )}
                </div>
                {item.can_update && !isOwnExit && (
                  <Button variant="outline" size="sm" onClick={() => onEdit(item)}>
                    {item.status === "pending" ? "Sign off" : "Update"}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function UpdateItemDialog({
  item,
  onOpenChange,
  onSaved,
}: {
  item: ClearanceItem | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (item: ClearanceItem) => void;
}) {
  const [outcome, setOutcome] = useState<Outcome | "">("");
  const [recovery, setRecovery] = useState("");
  const [waiverReason, setWaiverReason] = useState("");
  const [notes, setNotes] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const reset = () => {
    setOutcome("");
    setRecovery("");
    setWaiverReason("");
    setNotes("");
    setTouched(false);
    setError(null);
  };

  const recoveryProblem =
    outcome === "cleared_with_recovery"
      ? !isMoneyInput(recovery)
        ? "Enter the recovery amount in rupees, up to two decimals."
        : isZero(recovery)
          ? "A recovery must be more than zero."
          : null
      : null;
  const waiverProblem =
    outcome === "waived" && waiverReason.trim() === "" ? "Say why this item is waived." : null;
  const isValid = Boolean(outcome) && !recoveryProblem && !waiverProblem;

  const save = async () => {
    setTouched(true);
    if (!item || !outcome || !isValid) return;
    const input: ClearanceUpdateInput = {
      outcome,
      recovery_amount: outcome === "cleared_with_recovery" ? recovery.trim() : "0",
      waiver_reason: outcome === "waived" ? waiverReason.trim() : null,
      notes: notes.trim() || null,
    };
    setIsSaving(true);
    setError(null);
    try {
      const updated = await patch<ClearanceItem>(`/exits/clearance/${item.id}`, input);
      toast.success(`${updated.description}: ${CLEARANCE_STATUS_LABELS[updated.status]}`);
      reset();
      onSaved(updated);
    } catch (caught) {
      setError(apiErrorMessage(caught, "The item could not be updated."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open={item !== null}
      onOpenChange={(open) => {
        if (isSaving) return;
        if (!open) reset();
        onOpenChange(open);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sign off a clearance item</DialogTitle>
          <DialogDescription>
            {item && `${item.department} · ${item.description}`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <FormField
            htmlFor="clearance-outcome"
            label="Outcome"
            error={touched && !outcome ? "Choose an outcome." : null}
          >
            <Select
              value={outcome}
              disabled={isSaving}
              onValueChange={(next) => setOutcome(next as Outcome)}
            >
              <SelectTrigger
                id="clearance-outcome"
                className="w-full"
                aria-invalid={touched && !outcome}
              >
                <SelectValue placeholder="Choose an outcome" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cleared">Cleared</SelectItem>
                <SelectItem value="cleared_with_recovery">Cleared with recovery</SelectItem>
                <SelectItem value="waived">Waived</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          {outcome === "cleared_with_recovery" && (
            <FormField
              htmlFor="clearance-recovery"
              label="Recovery amount (₹)"
              hint="Deducted in the full & final settlement."
              error={touched ? recoveryProblem : null}
            >
              <Input
                id="clearance-recovery"
                inputMode="decimal"
                value={recovery}
                disabled={isSaving}
                aria-invalid={touched && Boolean(recoveryProblem)}
                className="tabular-nums"
                onChange={(event) => setRecovery(event.target.value)}
              />
            </FormField>
          )}

          {outcome === "waived" && (
            <FormField
              htmlFor="clearance-waiver"
              label="Waiver reason"
              error={touched ? waiverProblem : null}
            >
              <Textarea
                id="clearance-waiver"
                rows={2}
                maxLength={2000}
                value={waiverReason}
                disabled={isSaving}
                aria-invalid={touched && Boolean(waiverProblem)}
                onChange={(event) => setWaiverReason(event.target.value)}
              />
            </FormField>
          )}

          <FormField htmlFor="clearance-notes" label="Notes" optional>
            <Textarea
              id="clearance-notes"
              rows={2}
              maxLength={2000}
              value={notes}
              disabled={isSaving}
              onChange={(event) => setNotes(event.target.value)}
            />
          </FormField>

          {error && <InlineProblem>{error}</InlineProblem>}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={isSaving}
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button disabled={isSaving} onClick={() => void save()}>
            {isSaving && <Loader2 className="animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
