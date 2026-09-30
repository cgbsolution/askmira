"use client";

import {
  AlertTriangle,
  CalendarPlus,
  FileCheck2,
  Info,
  Loader2,
  Paperclip,
  UserCheck,
  X,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DatePicker } from "@/components/common/DatePicker";
import { EmployeePicker, employeeDisplayName } from "@/components/common/EmployeePicker";
import { FormField } from "@/components/common/FormField";
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
import type {
  EmployeeSummary,
  HalfDaySession,
  LeaveAttachment,
  LeavePreview,
  LeaveRequest,
  LeaveRequestInput,
  LeaveType,
} from "@/lib/types";
import { formatDay, formatDays, pluralDays, toISODate } from "@/lib/utils";

const ACCEPT = "application/pdf,image/png,image/jpeg";

/**
 * Request time off, with the cost worked out before you submit.
 *
 * Every change to the form asks the server for a preview — the same rules the
 * submission is held to — so the person sees "this costs 3 days, you will have
 * 9.5 left, it goes to Vikram" instead of discovering a refusal afterwards.
 *
 * HR can raise a request for somebody else; it then goes to that person's
 * approver like any other.
 */
export function RequestTimeOffDialog({
  leaveTypes,
  canActForOthers,
  ownEmployeeId,
  onCreated,
}: {
  leaveTypes: LeaveType[];
  canActForOthers: boolean;
  ownEmployeeId: string | null;
  onCreated: () => void;
}) {
  const today = toISODate(new Date());
  const [open, setOpen] = useState(false);
  const [onBehalf, setOnBehalf] = useState(false);
  const [person, setPerson] = useState<EmployeeSummary | null>(null);
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [halfDay, setHalfDay] = useState(false);
  const [session, setSession] = useState<HalfDaySession>("first_half");
  const [reason, setReason] = useState("");
  const [attachment, setAttachment] = useState<{ name: string; key: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<LeavePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Without an employee record of their own, HR can only ever request for someone else.
  const forSomeoneElse = canActForOthers && (onBehalf || !ownEmployeeId);
  const employeeId = forSomeoneElse ? (person?.id ?? null) : null;

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
      leaveTypeId && startDate && endDate && (!forSomeoneElse || employeeId)
        ? {
            leave_type_id: leaveTypeId,
            start_date: startDate,
            end_date: endDate,
            is_half_day: halfDay,
            half_day_session: halfDay ? session : null,
            reason: reason.trim() || null,
            document_url: attachment?.key ?? null,
            employee_id: employeeId,
          }
        : null,
    [
      leaveTypeId,
      startDate,
      endDate,
      halfDay,
      session,
      reason,
      attachment,
      forSomeoneElse,
      employeeId,
    ],
  );

  // The reason does not change the cost, so it does not trigger a preview.
  const previewKey = input
    ? `${leaveTypeId}|${startDate}|${endDate}|${halfDay}|${session}|${attachment?.key ?? ""}|${employeeId ?? ""}`
    : "";

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
    setOnBehalf(false);
    setPerson(null);
    setLeaveTypeId("");
    setStartDate(today);
    setEndDate(today);
    setHalfDay(false);
    setSession("first_half");
    setReason("");
    setAttachment(null);
    setPreview(null);
    setPreviewError(null);
  };

  const upload = async (file: File | null) => {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    setIsUploading(true);
    try {
      const stored = await post<LeaveAttachment>("/leave/attachments", form);
      setAttachment({ name: file.name, key: stored.document_url });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.detail : "Could not upload the document.");
    } finally {
      setIsUploading(false);
    }
  };

  const submit = async () => {
    if (!input) return;
    setIsSubmitting(true);
    try {
      const created = await post<LeaveRequest>("/leave/requests", input);
      toast.success(
        `${pluralDays(created.total_days)} of ${created.leave_type_name} requested` +
          (forSomeoneElse ? ` for ${created.employee_name}` : ""),
        {
          description: created.approval_chain[0]?.approver_name
            ? `Sent to ${created.approval_chain[0].approver_name} for approval.`
            : undefined,
        },
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

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request time off</DialogTitle>
          <DialogDescription>
            Weekends and holidays inside the dates are not counted, unless the policy applies
            the sandwich rule.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {canActForOthers && ownEmployeeId && (
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
              <div>
                <Label htmlFor="leave-on-behalf">For someone else</Label>
                <p className="text-xs text-muted-foreground">
                  Raise it on an employee&apos;s behalf. It goes to their approver.
                </p>
              </div>
              <Switch id="leave-on-behalf" checked={onBehalf} onCheckedChange={setOnBehalf} />
            </div>
          )}
          {forSomeoneElse && (
            <FormField htmlFor="leave-person" label="Employee">
              <EmployeePicker
                id="leave-person"
                value={person}
                onChange={setPerson}
                excludeId={ownEmployeeId}
              />
            </FormField>
          )}

          <FormField htmlFor="leave-type" label="Leave type">
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
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField htmlFor="leave-start" label="From">
              <DatePicker
                id="leave-start"
                value={startDate}
                onChange={(value) => {
                  setStartDate(value);
                  if (endDate < value) setEndDate(value);
                }}
              />
            </FormField>
            <FormField htmlFor="leave-end" label="To">
              <DatePicker id="leave-end" value={endDate} min={startDate} onChange={setEndDate} />
            </FormField>
          </div>

          {leaveType?.allows_half_day && (
            <div className="grid gap-2 rounded-md border border-border px-3 py-2.5">
              <div className="flex items-center justify-between">
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
              {halfDay && (
                <Select value={session} onValueChange={(v) => setSession(v as HalfDaySession)}>
                  <SelectTrigger size="sm" className="w-full" aria-label="Which half">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="first_half">First half (morning)</SelectItem>
                    <SelectItem value="second_half">Second half (afternoon)</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {leaveType && (
            <FormField
              htmlFor="leave-document"
              label="Supporting document"
              optional={!leaveType.requires_document}
              required={leaveType.requires_document}
              hint={
                leaveType.requires_document
                  ? "This leave type needs one — a medical certificate, for example. PDF, PNG or JPEG."
                  : "PDF, PNG or JPEG. Your approver can open it."
              }
            >
              {attachment ? (
                <div className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2 text-foreground">
                    <FileCheck2 className="size-4 shrink-0 text-brand-600" />
                    <span className="truncate">{attachment.name}</span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove the document"
                    onClick={() => setAttachment(null)}
                  >
                    <X />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    id="leave-document"
                    type="file"
                    accept={ACCEPT}
                    disabled={isUploading}
                    onChange={(event) => void upload(event.target.files?.[0] ?? null)}
                  />
                  {isUploading ? (
                    <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                  ) : (
                    <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                  )}
                </div>
              )}
            </FormField>
          )}

          <FormField
            htmlFor="leave-reason"
            label="Note for the approver"
            optional
          >
            <Textarea
              id="leave-reason"
              value={reason}
              maxLength={2000}
              rows={3}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Anything they should know"
            />
          </FormField>

          <PreviewPanel
            preview={preview}
            error={previewError}
            isLoading={isPreviewing}
            hasInput={Boolean(input)}
            forName={forSomeoneElse && person ? employeeDisplayName(person) : null}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={!preview?.allowed || isPreviewing || isSubmitting || isUploading}
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
  forName,
}: {
  preview: LeavePreview | null;
  error: string | null;
  isLoading: boolean;
  hasInput: boolean;
  forName: string | null;
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
        <Loader2 className="size-4 animate-spin" /> Checking the dates…
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
            {forName && <span className="text-muted-foreground"> of {forName}&apos;s balance</span>}
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
        {preview.sandwiched.length > 0 && (
          <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            Counted under the sandwich rule:{" "}
            {preview.sandwiched.map((day) => formatDay(day)).join(", ")}
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
