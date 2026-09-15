"use client";

import { Check, Inbox, Loader2, X } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

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
import type { LeaveRequest } from "@/lib/types";
import { formatDate, formatDateRange, initials, pluralDays, toISODate } from "@/lib/utils";

/**
 * Requests waiting on the signed-in person.
 *
 * The server decides what belongs here: steps naming this person, or every
 * pending request for HR, never their own. Declining asks for a reason, which
 * the server also insists on — a "no" without a why is a conversation deferred.
 */
export function ApprovalsInbox({
  version,
  onChanged,
  onCount,
}: {
  version: number;
  onChanged: () => void;
  onCount: (count: number) => void;
}) {
  const [rows, setRows] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [declining, setDeclining] = useState<LeaveRequest | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const items = await get<LeaveRequest[]>("/leave/approvals");
      setRows(items);
      onCount(items.length);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.detail : "Could not load approvals.");
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [onCount]);

  useEffect(() => {
    void load();
  }, [load, version]);

  const decide = async (request: LeaveRequest, approve: boolean, decisionNote: string | null) => {
    setBusyId(request.id);
    try {
      await post<LeaveRequest>(`/leave/requests/${request.id}/${approve ? "approve" : "reject"}`, {
        note: decisionNote,
      });
      toast.success(
        `${approve ? "Approved" : "Declined"} ${request.employee_name}'s ${request.leave_type_name}`,
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

  if (rows.length === 0) {
    return (
      <Card tier="tier1">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-lg bg-mint-100 text-brand-600 dark:bg-mint-900/40 dark:text-mint-200">
            <Inbox className="size-6" />
          </span>
          <div>
            <p className="font-medium text-foreground">You&apos;re all caught up</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Leave requests that need your decision will appear here.
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
                    {row.is_half_day && " (half day)"} ·{" "}
                    <span className="tabular-nums">{pluralDays(row.total_days)}</span>
                  </p>
                  {row.reason && (
                    <p className="text-sm text-muted-foreground">“{row.reason}”</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Requested {formatDate(row.created_at)}
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
                    setDeclining(row);
                  }}
                >
                  <X /> Decline
                </Button>
                <Button size="sm" disabled={busy} onClick={() => void decide(row, true, null)}>
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
            <DialogTitle>Decline {declining?.employee_name}&apos;s request</DialogTitle>
            <DialogDescription>
              {declining &&
                `${declining.leave_type_name}, ${formatDateRange(
                  declining.start_date,
                  declining.end_date,
                )}. They will see your reason.`}
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
              disabled={!note.trim() || busyId === declining?.id}
              onClick={() => declining && void decide(declining, false, note.trim())}
            >
              {busyId === declining?.id && <Loader2 className="animate-spin" />}
              Decline request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
