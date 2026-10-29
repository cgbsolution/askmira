"use client";

import { AlertTriangle, Check, Inbox, Loader2, Palmtree, X } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { LeaveDocumentButton } from "@/components/time/LeaveDocumentButton";
import { halfDayLabel } from "@/components/time/LeaveStatusBadge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, get, post } from "@/lib/api";
import type { CompOffClaim, LeaveRequest, RequestBalance } from "@/lib/types";
import {
  formatDate,
  formatDateRange,
  formatDay,
  formatDays,
  initials,
  pluralDays,
  toISODate,
} from "@/lib/utils";

const isZero = (value: string) => /^-?0(\.0+)?$/.test(value);

/** Approving would take the balance below zero, which leave never may. */
const isShort = (balance: RequestBalance | null | undefined) =>
  Boolean(balance?.after_approval.startsWith("-"));

/**
 * What the person has of this leave, so the approver need not leave the inbox
 * to look it up. Every figure is the API's; "left" is what approving this one
 * request leaves, with their other pending requests named rather than taken off.
 *
 * Leave is taken only against a balance, so a request the balance no longer
 * covers cannot be approved (the server refuses it too): it says so here.
 */
function RequestBalanceLine({ balance }: { balance: RequestBalance }) {
  if (isShort(balance)) {
    return (
      <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-destructive">
        <AlertTriangle className="size-3.5 shrink-0" />
        <span>
          Only <span className="font-medium tabular-nums">{pluralDays(balance.available)}</span>{" "}
          available — not enough to approve. Decline it, or ask HR to credit days first.
        </span>
      </p>
    );
  }
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
      <Palmtree className="size-3.5 shrink-0 text-brand-600" />
      <span>
        Balance{" "}
        <span className="font-medium text-foreground tabular-nums">
          {formatDays(balance.available)}
        </span>{" "}
        →{" "}
        <span className="font-medium text-foreground tabular-nums">
          {formatDays(balance.after_approval)}
        </span>{" "}
        left after this
      </span>
      {!isZero(balance.other_pending) && (
        <span className="text-warning">
          · {pluralDays(balance.other_pending)} more pending
        </span>
      )}
      {balance.projected_carry_forward && (
        <span>
          · includes {pluralDays(balance.projected_carry_forward)} expected to carry forward
        </span>
      )}
    </p>
  );
}

type Declining =
  | { kind: "leave"; row: LeaveRequest }
  | { kind: "comp-off"; row: CompOffClaim }
  | null;

/**
 * Everything waiting on the signed-in person here: leave requests and comp-off
 * claims.
 *
 * The server decides what belongs here: steps naming this person, or every
 * pending item for HR, never their own. Declining asks for a reason, which
 * the server also insists on — a "no" without a why is a conversation deferred.
 */
export function ApprovalsInbox({
  version,
  onChanged,
  onCounts,
}: {
  version: number;
  onChanged: () => void;
  onCounts: (leave: number, compOff: number) => void;
}) {
  const [rows, setRows] = useState<LeaveRequest[]>([]);
  const [claims, setClaims] = useState<CompOffClaim[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [declining, setDeclining] = useState<Declining>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [items, compOff] = await Promise.all([
        get<LeaveRequest[]>("/leave/approvals"),
        get<CompOffClaim[]>("/leave/comp-off/approvals"),
      ]);
      setRows(items);
      setClaims(compOff);
      onCounts(items.length, compOff.length);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.detail : "Could not load approvals.");
      setRows([]);
      setClaims([]);
    } finally {
      setIsLoading(false);
    }
  }, [onCounts]);

  useEffect(() => {
    void load();
    // `onCounts` is recreated by the parent on each render; reload on data changes only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const decide = async (item: NonNullable<Declining>, approve: boolean, decisionNote: string | null) => {
    setBusyId(item.row.id);
    const path =
      item.kind === "leave"
        ? `/leave/requests/${item.row.id}/${approve ? "approve" : "reject"}`
        : `/leave/comp-off/${item.row.id}/${approve ? "approve" : "reject"}`;
    try {
      await post(path, { note: decisionNote });
      toast.success(
        item.kind === "leave"
          ? `${approve ? "Approved" : "Declined"} ${item.row.employee_name}'s ${item.row.leave_type_name}`
          : `${approve ? "Approved" : "Declined"} ${item.row.employee_name}'s comp-off claim`,
      );
      setDeclining(null);
      setNote("");
      onChanged();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.detail : "Could not record the decision.");
    } finally {
      setBusyId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  if (rows.length === 0 && claims.length === 0) {
    return (
      <Card tier="tier1">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-lg bg-blush-100 text-brand-600 dark:bg-blush-900/40 dark:text-blush-200">
            <Inbox className="size-6" />
          </span>
          <div>
            <p className="font-medium text-foreground">You&apos;re all caught up</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Leave requests and comp-off claims that need your decision will appear here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const today = toISODate(new Date());

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const busy = busyId === row.id;
        const backdated = row.start_date < today;
        const step = row.approval_chain.find((s) => s.status === "pending");
        return (
          <Card key={row.id} tier="tier1" className="gap-0 py-4">
            <CardContent className="flex flex-col gap-4 px-4 md:flex-row md:items-center">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <Avatar className="size-10">
                  {row.employee_photo_url && <AvatarImage src={row.employee_photo_url} alt="" />}
                  <AvatarFallback>{initials(row.employee_name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-foreground">{row.employee_name}</p>
                    <Badge variant="secondary">{row.leave_type_name}</Badge>
                    {backdated && <Badge variant="warning">Backdated</Badge>}
                    {step?.role === "hr" && <Badge variant="outline">No manager — HR decides</Badge>}
                  </div>
                  <p className="text-sm text-foreground">
                    {formatDateRange(row.start_date, row.end_date)}
                    {row.is_half_day &&
                      ` (${halfDayLabel(row.half_day_session)})`}{" "}
                    · <span className="tabular-nums">{pluralDays(row.total_days)}</span>
                  </p>
                  {row.balance && <RequestBalanceLine balance={row.balance} />}
                  {row.reason && (
                    <p className="text-sm text-muted-foreground">“{row.reason}”</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>Requested {formatDate(row.created_at)}</span>
                    {row.has_document && <LeaveDocumentButton requestId={row.id} />}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 gap-2 md:flex-col lg:flex-row">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    setNote("");
                    setDeclining({ kind: "leave", row });
                  }}
                >
                  <X /> Decline
                </Button>
                <Button
                  size="sm"
                  disabled={busy || isShort(row.balance)}
                  title={isShort(row.balance) ? "Not enough balance to approve" : undefined}
                  onClick={() => void decide({ kind: "leave", row }, true, null)}
                >
                  {busy ? <Loader2 className="animate-spin" /> : <Check />}
                  Approve
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {claims.map((claim) => {
        const busy = busyId === claim.id;
        return (
          <Card key={claim.id} tier="tier1" className="gap-0 py-4">
            <CardContent className="flex flex-col gap-4 px-4 md:flex-row md:items-center">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <Avatar className="size-10">
                  {claim.employee_photo_url && (
                    <AvatarImage src={claim.employee_photo_url} alt="" />
                  )}
                  <AvatarFallback>{initials(claim.employee_name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-foreground">{claim.employee_name}</p>
                    <Badge variant="accent">Comp-off claim</Badge>
                    {claim.approver_name === "HR team" && (
                      <Badge variant="outline">No manager — HR decides</Badge>
                    )}
                  </div>
                  <p className="text-sm text-foreground">
                    Worked {formatDay(claim.worked_date, true)}
                    {claim.worked_day_label && ` (${claim.worked_day_label})`} ·{" "}
                    <span className="tabular-nums">{pluralDays(claim.days)}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">“{claim.reason}”</p>
                  <p className="text-xs text-muted-foreground">
                    Claimed {formatDate(claim.created_at)}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2 md:flex-col lg:flex-row">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    setNote("");
                    setDeclining({ kind: "comp-off", row: claim });
                  }}
                >
                  <X /> Decline
                </Button>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => void decide({ kind: "comp-off", row: claim }, true, null)}
                >
                  {busy ? <Loader2 className="animate-spin" /> : <Check />}
                  Approve
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={declining !== null} onOpenChange={(open) => !open && setDeclining(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Decline {declining?.row.employee_name}&apos;s request</DialogTitle>
            <DialogDescription>
              {declining?.kind === "leave" &&
                `${declining.row.leave_type_name}, ${formatDateRange(
                  declining.row.start_date,
                  declining.row.end_date,
                )}. They will see your reason.`}
              {declining?.kind === "comp-off" &&
                `Comp-off for working ${formatDay(declining.row.worked_date, true)}. They will see your reason.`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="decline-note">Reason</Label>
            <Textarea
              id="decline-note"
              rows={3}
              maxLength={1000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="e.g. We have the release that week — could you move it by a few days?"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclining(null)}>
              Back
            </Button>
            <Button
              variant="destructive"
              disabled={!note.trim() || busyId === declining?.row.id}
              onClick={() => declining && void decide(declining, false, note.trim())}
            >
              {busyId === declining?.row.id && <Loader2 className="animate-spin" />}
              Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
