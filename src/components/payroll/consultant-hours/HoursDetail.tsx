"use client";

import { Loader2, Pencil, RotateCcw } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { AttachmentList } from "@/components/payroll/consultant-hours/AttachmentList";
import { DAY_STATUS, periodText } from "@/components/payroll/consultant-hours/labels";
import { HoursStatusBadge } from "@/components/payroll/consultant-hours/HoursStatusBadge";
import { apiMessage } from "@/components/payroll/labels";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { post } from "@/lib/api";
import type { HoursEntry } from "@/lib/types/consultant-hours";
import { formatDay } from "@/lib/utils";

/** One entry in full, with Approve / Reject for an approver, Edit for a draft, Reopen for HR. */
export function HoursDetail({
  entry,
  open,
  onOpenChange,
  onChanged,
  onEdit,
}: {
  entry: HoursEntry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the entry as the server now holds it. */
  onChanged: (entry: HoursEntry) => void;
  onEdit: (entry: HoursEntry) => void;
}) {
  const { hasRole } = useAuth();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editable = entry.status === "draft" || entry.status === "rejected";
  const decided = entry.status === "approved" || entry.status === "rejected";

  const run = async (path: string, body: unknown, done: string) => {
    setBusy(true);
    setError(null);
    try {
      const next = await post<HoursEntry>(`/consultant-hours/${entry.id}/${path}`, body);
      toast.success(done);
      setRejecting(false);
      setReason("");
      onChanged(next);
    } catch (caught) {
      // The server's own words: it says who may and may not, and why.
      setError(apiMessage(caught, "That did not work. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {entry.employee_name}
            {entry.employee_code && <span className="font-normal text-muted-foreground"> · {entry.employee_code}</span>}
          </DialogTitle>
          <DialogDescription>{periodText(entry.period_start, entry.period_end)}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <HoursStatusBadge status={entry.status} />
            <span className="text-sm">
              Billable hours: <span className="font-semibold tabular-nums">{entry.total_billable_hours}</span>
            </span>
            {entry.non_billable_hours && (
              <span className="text-sm text-muted-foreground">Non-billable: {entry.non_billable_hours}</span>
            )}
          </div>
          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Project</dt>
              <dd>{entry.project_name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Customer reference</dt>
              <dd>{entry.customer_reference ?? "—"}</dd>
            </div>
          </dl>
          {decided && entry.decision_note && (
            <Alert variant={entry.status === "rejected" ? "warning" : "default"}>
              <AlertDescription>
                {entry.status === "rejected" ? "Rejected: " : "Note: "}
                {entry.decision_note}
              </AlertDescription>
            </Alert>
          )}
          {entry.days && entry.days.length > 0 && (
            <div className="max-h-56 overflow-y-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1.5 font-medium">Date</th>
                    <th className="px-2 py-1.5 font-medium">Status</th>
                    <th className="px-2 py-1.5 text-right font-medium">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {entry.days.map((day) => (
                    <tr key={day.date} className="border-t border-border">
                      <td className="px-2 py-1">{formatDay(day.date)}</td>
                      <td className="px-2 py-1">{DAY_STATUS[day.status] ?? day.status}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{day.hours}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="grid gap-2">
            <p className="text-sm font-medium">Customer&apos;s timesheet</p>
            <AttachmentList entry={entry} />
          </div>
          {!entry.can_approve && entry.approval_note && (
            <Alert variant="warning">
              <AlertDescription>{entry.approval_note}</AlertDescription>
            </Alert>
          )}
          {entry.can_approve && rejecting && (
            <FormField htmlFor="hours-reject-reason" label="What needs changing" required>
              <Textarea
                id="hours-reject-reason"
                maxLength={1000}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </FormField>
          )}
        </div>
        <DialogFooter>
          {editable && (
            <Button variant="outline" disabled={busy} onClick={() => onEdit(entry)}>
              <Pencil /> Edit
            </Button>
          )}
          {decided && hasRole("admin", "sub_admin") && (
            <Button variant="outline" disabled={busy} onClick={() => void run("reopen", undefined, "Reopened as a draft.")}>
              <RotateCcw /> Reopen
            </Button>
          )}
          {entry.can_approve && !rejecting && (
            <>
              <Button variant="outline" disabled={busy} onClick={() => setRejecting(true)}>
                Reject
              </Button>
              <Button disabled={busy} onClick={() => void run("decide", { approve: true }, "Hours approved.")}>
                {busy && <Loader2 className="animate-spin" />} Approve
              </Button>
            </>
          )}
          {entry.can_approve && rejecting && (
            <>
              <Button variant="outline" disabled={busy} onClick={() => setRejecting(false)}>
                Back
              </Button>
              <Button
                variant="destructive"
                disabled={busy || !reason.trim()}
                onClick={() => void run("decide", { approve: false, note: reason.trim() }, "Hours rejected.")}
              >
                {busy && <Loader2 className="animate-spin" />} Reject hours
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
