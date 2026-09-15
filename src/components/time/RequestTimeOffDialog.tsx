"use client";

import { AlertTriangle, CalendarPlus, Info, Loader2, UserCheck } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { ApiError, post } from "@/lib/api";
import type { LeavePreview, LeaveRequest, LeaveRequestInput, LeaveType } from "@/lib/types";
import { formatDay, formatDays, pluralDays, toISODate } from "@/lib/utils";

/**
 * Request time off, with the cost worked out before you submit.
 *
 * Every change to the form asks the server for a preview — the same rules the
 * submission is held to — so the person sees "this costs 3 days, you will have
 * 9.5 left, it goes to Vikram" instead of discovering a refusal afterwards.
 */
export function RequestTimeOffDialog({
  leaveTypes,
  onCreated,
}: {
  leaveTypes: LeaveType[];
  onCreated: () => void;
}) {
  const today = toISODate(new Date());
  const [open, setOpen] = useState(false);
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [halfDay, setHalfDay] = useState(false);
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<LeavePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const leaveType = useMemo(
    () => leaveTypes.find((type) => type.id === leaveTypeId),
    [leaveTypes, leaveTypeId],
  );
  const singleDay = startDate === endDate;
  const canHalfDay = Boolean(leaveType?.allows_half_day) && singleDay;

  useEffect(() => {
    if (!canHalfDay && halfDay) setHalfDay(false);
  }, [canHalfDay, halfDay]);

  const input: LeaveRequestInput | null = useMemo(
    () =>
      leaveTypeId && startDate && endDate
        ? {
            leave_type_id: leaveTypeId,
            start_date: startDate,
            end_date: endDate,
            is_half_day: halfDay,
            reason: reason.trim() || null,
          }
        : null,
    [leaveTypeId, startDate, endDate, halfDay, reason],
  );

  // The reason does not change the cost, so it does not trigger a preview.
  const previewKey = input ? `${leaveTypeId}|${startDate}|${endDate}|${halfDay}` : "";

  useEffect(() => {
    if (!open || !input) {
      setPreview(null);
      setPreviewError(null);
      return;
    }
    let cancelled = false;
    setIsPreviewing(true);
    const timer = setTimeout(() => {
      post<LeavePreview>("/leave/requests/preview", input)
        .then((result) => {
          if (cancelled) return;
          setPreview(result);
          setPreviewError(null);
        })
        .catch((error) => {
          if (cancelled) return;
          setPreview(null);
          setPreviewError(error instanceof ApiError ? error.detail : "Could not check these dates.");
        })
        .finally(() => {
          if (!cancelled) setIsPreviewing(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, previewKey]);

  const reset = () => {
    setLeaveTypeId("");
    setStartDate(today);
    setEndDate(today);
    setHalfDay(false);
    setReason("");
    setPreview(null);
    setPreviewError(null);
  };

  const submit = async () => {
    if (!input) return;
    setIsSubmitting(true);
    try {
      const created = await post<LeaveRequest>("/leave/requests", input);
      toast.success(
        `${pluralDays(created.total_days)} of ${created.leave_type_name} requested`,
        { description: created.approval_chain[0]?.approver_name
            ? `Sent to ${created.approval_chain[0].approver_name} for approval.`
            : undefined },
      );
      setOpen(false);
      reset();
      onCreated();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.detail : "Could not submit the request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="accent" disabled={leaveTypes.length === 0}>
          <CalendarPlus /> Request time off
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request time off</DialogTitle>
          <DialogDescription>
            Weekends and holidays inside your dates are not counted.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="leave-type">Leave type</Label>
            <Select value={leaveTypeId} onValueChange={setLeaveTypeId}>
              <SelectTrigger id="leave-type" className="w-full">
                <SelectValue placeholder="Choose a leave type" />
              </SelectTrigger>
              <SelectContent>
                {leaveTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                    {!type.is_paid && " (unpaid)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="leave-start">From</Label>
              <Input
                id="leave-start"
                type="date"
                value={startDate}
                onChange={(event) => {
                  const value = event.target.value;
                  setStartDate(value);
                  if (value && endDate < value) setEndDate(value);
                }}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="leave-end">To</Label>
              <Input
                id="leave-end"
                type="date"
                min={startDate}
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
          </div>

          {leaveType?.allows_half_day && (
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
              <div>
                <Label htmlFor="leave-half-day">Half day</Label>
                <p className="text-xs text-muted-foreground">
                  {singleDay ? "Counts as half a day." : "Only for a single date."}
                </p>
              </div>
              <Switch
                id="leave-half-day"
                checked={halfDay}
                disabled={!canHalfDay}
                onCheckedChange={setHalfDay}
              />
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="leave-reason">
              Note for your approver <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="leave-reason"
              value={reason}
              maxLength={2000}
              rows={3}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Anything they should know"
            />
          </div>

          <PreviewPanel
            preview={preview}
            error={previewError}
            isLoading={isPreviewing}
            hasInput={Boolean(input)}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={!preview?.allowed || isPreviewing || isSubmitting}
          >
            {isSubmitting && <Loader2 className="animate-spin" />}
            Submit request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreviewPanel({
  preview,
  error,
  isLoading,
  hasInput,
}: {
  preview: LeavePreview | null;
  error: string | null;
  isLoading: boolean;
  hasInput: boolean;
}) {
  if (!hasInput) return null;

  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2.5 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Checking your dates…
      </div>
    );
  }

  const skipped = [
    ...preview.holidays.map((holiday) => `${holiday.name} (${formatDay(holiday.date)})`),
    ...(preview.weekly_offs.length
      ? [`${preview.weekly_offs.length} weekly off${preview.weekly_offs.length === 1 ? "" : "s"}`]
      : []),
  ];

  return (
    <div className="space-y-2.5">
      <div className="rounded-md border border-border bg-muted/50 px-3 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm text-foreground">
            This costs{" "}
            <span className="font-semibold tabular-nums">{pluralDays(preview.total_days)}</span>
            {isLoading && <Loader2 className="ml-2 inline size-3.5 animate-spin" />}
          </p>
          {preview.available_before !== null && preview.available_after !== null && (
            <p className="text-xs text-muted-foreground tabular-nums">
              {formatDays(preview.available_before)} available
              {preview.pending_days && Number(preview.pending_days) > 0
                ? ` − ${formatDays(preview.pending_days)} pending`
                : ""}{" "}
              → <span className="font-semibold text-foreground">
                {formatDays(preview.available_after)}
              </span>{" "}
              left
            </p>
          )}
        </div>
        {skipped.length > 0 && (
          <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            Not counted: {skipped.join(", ")}
          </p>
        )}
        {preview.approvers.length > 0 && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <UserCheck className="size-3.5 shrink-0" />
            Goes to {preview.approvers.join(", then ")}
          </p>
        )}
      </div>

      {preview.problems.length > 0 && (
        <ul className="space-y-1 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          {preview.problems.map((problem) => (
            <li key={problem} className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {problem}
            </li>
          ))}
        </ul>
      )}
      {preview.warnings.length > 0 && (
        <ul className="space-y-1 rounded-md bg-mustard-50 px-3 py-2.5 text-sm text-mustard-900 dark:bg-mustard-900/20 dark:text-mustard-100">
          {preview.warnings.map((warning) => (
            <li key={warning} className="flex items-start gap-2">
              <Info className="mt-0.5 size-4 shrink-0" />
              {warning}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
