"use client";

import { Loader2, Lock } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { DatePicker } from "@/components/common/DatePicker";
import { FormField } from "@/components/common/FormField";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { post } from "@/lib/api";
import {
  REGULARISABLE_STATUSES,
  type AttendanceDay,
  type AttendanceStatus,
  type Regularisation,
  type RegularisationInput,
  type RegularisationKind,
  type RegularisationRangeInput,
} from "@/lib/types/attendance";
import { formatDay, parseISODate, toISODate } from "@/lib/utils";

import { errorDetail, formatClock, localDateTimeToISO, STATUS_LABELS } from "./shared";

export const KIND_LABELS: Record<RegularisationKind, string> = {
  missed_punch: "Missed punch",
  status_change: "Attendance correction",
  on_duty: "On duty",
  work_from_home: "Work from home",
};

const KIND_HINTS: Record<RegularisationKind, string> = {
  missed_punch: "You were at work but a punch in or out is missing.",
  status_change: "The day was recorded wrongly — a full day marked as half, say.",
  on_duty: "You worked away from the office: a client site, travel or training.",
  work_from_home: "You worked remotely. Can be asked ahead of time.",
};

/** How far ahead on-duty and work-from-home may be asked; mirrors the API. */
const MAX_ADVANCE_DAYS = 60;

function addDays(iso: string, days: number): string {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

/**
 * Raise a missed punch, an attendance correction, on-duty or work-from-home.
 *
 * All four go to the same approver (line manager, else HR) and appear in the
 * approvals inbox. On-duty and work-from-home may span several days; the API
 * leaves out week offs and holidays inside the range.
 *
 * HR's own correction is not a request: the API applies it at once, for
 * anybody, so `direct` words the dialog that way. `employee` aims it at
 * somebody else's record.
 */
export function AttendanceRequestDialog({
  open,
  onOpenChange,
  initialKind,
  initialDate,
  day,
  today,
  isLocked,
  onCreated,
  employee,
  direct = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialKind: RegularisationKind;
  initialDate: string;
  /** The computed day, when there is one, for context. */
  day: AttendanceDay | null;
  today: string;
  isLocked: boolean;
  onCreated: () => void;
  /** Whose day it is, when it is not the signed-in person's. */
  employee?: { id: string; name: string };
  /** The caller is HR: their correction is applied, not sent for approval. */
  direct?: boolean;
}) {
  const [kind, setKind] = useState<RegularisationKind>(initialKind);
  const [date, setDate] = useState(initialDate);
  const [endDate, setEndDate] = useState(initialDate);
  const [status, setStatus] = useState<AttendanceStatus>("present");
  const [firstIn, setFirstIn] = useState("");
  const [lastOut, setLastOut] = useState("");
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setKind(initialKind);
    setDate(initialDate);
    setEndDate(initialDate);
    setStatus("present");
    setFirstIn("");
    setLastOut("");
    setReason("");
    setSubmitted(false);
    setServerError(null);
  }, [open, initialKind, initialDate]);

  const isAdvance = kind === "on_duty" || kind === "work_from_home";
  const maxDate = isAdvance ? addDays(today, MAX_ADVANCE_DAYS) : today;
  const reasonOk = reason.trim().length >= 3;
  const timesOk = kind !== "missed_punch" || Boolean(firstIn || lastOut);
  const rangeOk = !isAdvance || endDate >= date;
  const overnight = Boolean(firstIn && lastOut && lastOut < firstIn);

  const submit = async () => {
    setSubmitted(true);
    if (!reasonOk || !timesOk || !rangeOk || !date) return;
    setIsSubmitting(true);
    setServerError(null);
    try {
      if (isAdvance && endDate !== date) {
        const body: RegularisationRangeInput = {
          kind: kind as RegularisationRangeInput["kind"],
          start_date: date,
          end_date: endDate,
          reason: reason.trim(),
          employee_id: employee?.id ?? null,
        };
        const created = await post<Regularisation[]>("/attendance/regularisations/range", body);
        const days = `${created.length} working day${created.length === 1 ? "" : "s"}`;
        toast.success(
          created.every((row) => row.status === "approved")
            ? `${KIND_LABELS[kind]} applied for ${days}`
            : `${KIND_LABELS[kind]} requested for ${days}`,
        );
      } else {
        const body: RegularisationInput = {
          attendance_date: date,
          kind,
          requested_status: isAdvance ? "present" : status,
          reason: reason.trim(),
          requested_first_in: firstIn ? localDateTimeToISO(date, firstIn) : null,
          requested_last_out: lastOut
            ? localDateTimeToISO(date, lastOut, overnight ? 1 : 0)
            : null,
          employee_id: employee?.id ?? null,
        };
        const created = await post<Regularisation>("/attendance/regularisation", body);
        toast.success(
          created.status === "approved"
            ? `${KIND_LABELS[kind]} applied to ${formatDay(date, true)}`
            : `${KIND_LABELS[kind]} raised for ${formatDay(date, true)}`,
        );
      }
      onCreated();
      onOpenChange(false);
    } catch (caught) {
      setServerError(errorDetail(caught, "Could not raise the request."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {KIND_LABELS[kind]}
            {employee ? ` · ${employee.name}` : ""}
          </DialogTitle>
          <DialogDescription>
            {day
              ? `${formatDay(day.attendance_date, true)} is recorded as ${STATUS_LABELS[day.status]} · in ${formatClock(day.first_in)}, out ${formatClock(day.last_out)}.`
              : direct
                ? "Applied to the record at once, with no approval, and written to the audit log."
                : "Your manager — or HR, if you have none — decides it, and sees your reason."}
            {day && direct ? " Your change is applied at once, with no approval." : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {isLocked && (
            <Alert variant="warning">
              <Lock />
              <AlertDescription>
                {direct
                  ? "This period is locked for payroll. Unlock it in Attendance → Periods, with a reason, before changing a day in it."
                  : "This period is locked for payroll. You can raise the request now; it can only be approved after HR unlocks the period."}
              </AlertDescription>
            </Alert>
          )}

          <FormField htmlFor="req-kind" label="Request type" hint={KIND_HINTS[kind]}>
            <Select value={kind} onValueChange={(value) => setKind(value as RegularisationKind)}>
              <SelectTrigger id="req-kind" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(KIND_LABELS) as RegularisationKind[]).map((option) => (
                  <SelectItem key={option} value={option}>
                    {KIND_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <div className={isAdvance ? "grid grid-cols-2 gap-3" : "grid gap-3"}>
            <FormField htmlFor="req-date" label={isAdvance ? "From" : "Date"}>
              <DatePicker
                id="req-date"
                value={date}
                max={maxDate}
                onChange={(value) => {
                  setDate(value);
                  if (endDate < value) setEndDate(value);
                }}
              />
            </FormField>
            {isAdvance && (
              <FormField
                htmlFor="req-end"
                label="To"
                error={submitted && !rangeOk ? "The last day cannot be before the first." : null}
              >
                <DatePicker
                  id="req-end"
                  value={endDate}
                  min={date}
                  max={maxDate}
                  invalid={submitted && !rangeOk}
                  onChange={setEndDate}
                />
              </FormField>
            )}
          </div>

          {kind === "status_change" && (
            <FormField htmlFor="req-status" label="The day should be">
              <Select value={status} onValueChange={(value) => setStatus(value as AttendanceStatus)}>
                <SelectTrigger id="req-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REGULARISABLE_STATUSES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {STATUS_LABELS[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          )}

          {(kind === "missed_punch" || kind === "status_change") && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  htmlFor="req-in"
                  label="Came in at"
                  optional={kind === "status_change"}
                >
                  <Input
                    id="req-in"
                    type="time"
                    className="h-11"
                    value={firstIn}
                    aria-invalid={submitted && !timesOk}
                    onChange={(event) => setFirstIn(event.target.value)}
                  />
                </FormField>
                <FormField htmlFor="req-out" label="Left at" optional={kind === "status_change"}>
                  <Input
                    id="req-out"
                    type="time"
                    className="h-11"
                    value={lastOut}
                    aria-invalid={submitted && !timesOk}
                    onChange={(event) => setLastOut(event.target.value)}
                  />
                </FormField>
              </div>
              {submitted && !timesOk && (
                <p className="-mt-2 text-xs text-destructive">
                  Give the time you came in, the time you left, or both.
                </p>
              )}
              {kind === "missed_punch" && (
                <p className="-mt-2 text-xs text-muted-foreground">
                  Fill in only the punch you missed; the other comes from your recorded punches.
                </p>
              )}
              {overnight && (
                <p className="-mt-2 text-xs text-muted-foreground">
                  The out time is earlier than the in time, so it is taken as the next morning.
                </p>
              )}
            </>
          )}

          <FormField
            htmlFor="req-reason"
            label="Reason"
            error={submitted && !reasonOk ? "Give a reason of at least 3 characters." : null}
          >
            <Textarea
              id="req-reason"
              rows={3}
              maxLength={1000}
              value={reason}
              aria-invalid={submitted && !reasonOk}
              onChange={(event) => setReason(event.target.value)}
              placeholder={
                kind === "missed_punch"
                  ? "e.g. Forgot to punch out after the client call"
                  : kind === "on_duty"
                    ? "e.g. At the Pune client site for the rollout"
                    : kind === "work_from_home"
                      ? "e.g. Internet installation at home"
                      : "e.g. Worked the full day; the half day is wrong"
              }
            />
          </FormField>

          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={isSubmitting} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={isSubmitting} onClick={() => void submit()}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            {direct ? "Apply" : "Send request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
