"use client";

import { DoorOpen, Loader2, LogOut, Undo2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { DatePicker } from "@/components/common/DatePicker";
import { ErrorState } from "@/components/common/ErrorState";
import { FormField } from "@/components/common/FormField";
import { ExitStatusBadge, ReasonDialog } from "@/components/exits/common";
import { apiMessage } from "@/components/people/labels";
import { DetailItem } from "@/components/people/StatusBadges";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { ExitRecord } from "@/lib/types/payroll-ops";
import type { EmployeeRecord } from "@/lib/types/people";
import { formatDate, formatDay, parseISODate, toISODate } from "@/lib/utils";

function addDays(iso: string, days: number): string {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

function daysBetween(from: string, to: string): number {
  return Math.round((parseISODate(to).getTime() - parseISODate(from).getTime()) / 86_400_000);
}

/** Resign: reason, the last day (proposed from the notice period), and any comments. */
function ResignDialog({
  open,
  onOpenChange,
  employee,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: EmployeeRecord;
  onSubmitted: (record: ExitRecord) => void;
}) {
  const today = toISODate(new Date());
  const notice = employee.notice_period_days ?? 0;
  const proposed = addDays(today, notice);
  const [lastDay, setLastDay] = useState(proposed);
  const [reason, setReason] = useState("");
  const [comments, setComments] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLastDay(proposed);
    setReason("");
    setComments("");
    setError(null);
    setTouched(false);
  }, [open, proposed]);

  const shortfall = Math.max(0, notice - daysBetween(today, lastDay));

  const submit = async () => {
    setTouched(true);
    if (reason.trim().length < 3) return;
    setIsSaving(true);
    setError(null);
    try {
      const record = await post<ExitRecord>("/exits/resign", {
        reason: reason.trim(),
        requested_last_working_day: lastDay,
        comments: comments.trim() || null,
      });
      toast.success("Resignation submitted. Your manager and HR have been told.");
      onSubmitted(record);
      onOpenChange(false);
    } catch (caught) {
      setError(apiMessage(caught, "Your resignation could not be submitted."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Submit your resignation</DialogTitle>
          <DialogDescription>
            Your line manager and HR are told straight away. Until one of them accepts it, you can
            withdraw it here.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <FormField
            htmlFor="resign-last-day"
            label="Last working day you propose"
            hint={
              notice > 0
                ? `Your notice period is ${notice} days, which ends on ${formatDay(proposed, true)}.`
                : "No notice period is recorded on your employment."
            }
          >
            <DatePicker id="resign-last-day" value={lastDay} min={today} onChange={setLastDay} />
          </FormField>
          {shortfall > 0 && (
            <Alert variant="warning">
              <AlertTitle>{shortfall} day(s) short of your notice period</AlertTitle>
              <AlertDescription>
                HR may waive the shortfall or recover it from your final settlement. The decision
                and its basis are shown to you on the settlement.
              </AlertDescription>
            </Alert>
          )}
          <FormField
            htmlFor="resign-reason"
            label="Reason"
            error={touched && reason.trim().length < 3 ? "Give a reason; a few words is enough." : null}
          >
            <Textarea
              id="resign-reason"
              rows={3}
              maxLength={2000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </FormField>
          <FormField htmlFor="resign-comments" label="Comments" optional hint="Handover notes, anything your manager should know.">
            <Textarea
              id="resign-comments"
              rows={3}
              maxLength={2000}
              value={comments}
              onChange={(event) => setComments(event.target.value)}
            />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={isSaving} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={isSaving} onClick={() => void submit()}>
            {isSaving ? <Loader2 className="animate-spin" /> : <LogOut />}
            Submit resignation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Your own resignation: submit one, see where it stands, withdraw it while
 * nobody has accepted it. After acceptance the exit is run by HR.
 */
export function ResignationCard({ employee }: { employee: EmployeeRecord }) {
  const query = useApiQuery<ExitRecord | null>("/exits/mine");
  const [resigning, setResigning] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const record = query.data;
  const open = record && record.status !== "cancelled" ? record : null;

  if (query.isLoading && record === null) return <Skeleton className="h-40 w-full" />;
  if (query.error) {
    return (
      <Card tier="tier1">
        <ErrorState message={query.error.detail} onRetry={query.reload} />
      </Card>
    );
  }

  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <DoorOpen className="size-4 text-brand-600" /> Resignation
        </CardTitle>
        <CardDescription>
          {open
            ? "Where your resignation stands. Clearance and your final settlement follow once it is accepted."
            : "If you are leaving, submit your resignation here. Your notice period decides the proposed last day."}
        </CardDescription>
        <CardAction>
          {open ? (
            open.awaiting_acceptance && (
              <Button size="sm" variant="outline" onClick={() => setWithdrawing(true)}>
                <Undo2 /> Withdraw
              </Button>
            )
          ) : (
            employee.status !== "exited" && (
              <Button size="sm" variant="outline" onClick={() => setResigning(true)}>
                <LogOut /> Resign
              </Button>
            )
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-4">
        {record?.status === "cancelled" && record.withdrawn_at && (
          <p className="text-sm text-muted-foreground">
            You withdrew the resignation you submitted on {formatDay(record.resignation_date, true)}.
          </p>
        )}
        {open ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {open.awaiting_acceptance ? (
                <Badge variant="warning">Waiting for your manager or HR to accept</Badge>
              ) : (
                <Badge variant="secondary">
                  Accepted{open.accepted_by_name ? ` by ${open.accepted_by_name}` : ""}
                  {open.accepted_at ? ` on ${formatDate(open.accepted_at)}` : ""}
                </Badge>
              )}
              <ExitStatusBadge status={open.status} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <DetailItem label="Submitted">{formatDay(open.resignation_date, true)}</DetailItem>
              <DetailItem label="Last day you proposed">
                {open.requested_last_working_day ? formatDay(open.requested_last_working_day, true) : null}
              </DetailItem>
              <DetailItem label="Agreed last working day">
                {open.approved_last_working_day ? formatDay(open.approved_last_working_day, true) : "Not agreed yet"}
              </DetailItem>
              <DetailItem label="Notice period">{`${open.notice_period_days} days`}</DetailItem>
              <DetailItem label="Notice shortfall">
                {open.notice_shortfall_days > 0
                  ? `${open.notice_shortfall_days} day(s)${open.notice_waived ? ", waived" : ""}`
                  : "None"}
              </DetailItem>
              <DetailItem label="Clearance">
                {open.clearance_total === 0
                  ? "No items"
                  : `${open.clearance_pending_mandatory} of ${open.clearance_total} mandatory pending`}
              </DetailItem>
            </div>
            {!open.awaiting_acceptance && (
              <p className="text-xs text-muted-foreground">
                To withdraw an accepted resignation, speak to your manager or HR.
              </p>
            )}
          </>
        ) : (
          !record?.withdrawn_at && (
            <p className="text-sm text-muted-foreground">You have not submitted a resignation.</p>
          )
        )}
      </CardContent>

      <ResignDialog
        open={resigning}
        onOpenChange={setResigning}
        employee={employee}
        onSubmitted={(saved) => query.setData(saved)}
      />
      {open && (
        <ReasonDialog
          open={withdrawing}
          onOpenChange={setWithdrawing}
          title="Withdraw your resignation?"
          description="Your manager and HR are told. Your status goes back to active."
          label="Why you are withdrawing"
          confirmLabel="Withdraw resignation"
          onSubmit={async (reason) => {
            const saved = await post<ExitRecord>(`/exits/${open.id}/withdraw`, { reason });
            toast.success("Resignation withdrawn");
            query.setData(saved);
          }}
        />
      )}
    </Card>
  );
}
