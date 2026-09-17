"use client";

import { Loader2, LogOut } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { EXIT_TYPE_LABELS, useExitRoles } from "@/components/exits/common";
import { EmployeePicker, employeeDisplayName } from "@/components/exits/EmployeePicker";
import { apiErrorMessage, InlineProblem } from "@/components/payroll-ops/shared";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { post } from "@/lib/api";
import type { EmployeeSummary } from "@/lib/types";
import type { ExitCreateInput, ExitRecord, ExitType } from "@/lib/types/payroll-ops";

/**
 * Start an exit (resignation, termination, …) for someone else.
 *
 * A manager may only start one for their reporting line; the server enforces
 * that and its refusal is shown here word for word.
 */
export function StartExitDialog({ onCreated }: { onCreated: (record: ExitRecord) => void }) {
  const { ownEmployeeId, isHr } = useExitRoles();
  const [open, setOpen] = useState(false);
  const [employee, setEmployee] = useState<EmployeeSummary | null>(null);
  const [exitType, setExitType] = useState<ExitType | "">("");
  const [resignationDate, setResignationDate] = useState("");
  const [requestedLwd, setRequestedLwd] = useState("");
  const [approvedLwd, setApprovedLwd] = useState("");
  const [noticeDays, setNoticeDays] = useState("");
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const noticeValid = noticeDays.trim() === "" || /^\d+$/.test(noticeDays.trim());
  const requestedBeforeResignation = Boolean(
    requestedLwd && resignationDate && requestedLwd < resignationDate,
  );
  const approvedBeforeResignation = Boolean(
    approvedLwd && resignationDate && approvedLwd < resignationDate,
  );
  const isValid =
    Boolean(employee) &&
    Boolean(exitType) &&
    Boolean(resignationDate) &&
    noticeValid &&
    !requestedBeforeResignation &&
    !approvedBeforeResignation;

  const reset = () => {
    setEmployee(null);
    setExitType("");
    setResignationDate("");
    setRequestedLwd("");
    setApprovedLwd("");
    setNoticeDays("");
    setReason("");
    setTouched(false);
    setError(null);
  };

  const submit = async () => {
    setTouched(true);
    if (!isValid || !employee || !exitType) return;
    const input: ExitCreateInput = {
      employee_id: employee.id,
      exit_type: exitType,
      resignation_date: resignationDate,
      requested_last_working_day: requestedLwd || null,
      approved_last_working_day: approvedLwd || null,
      notice_period_days: noticeDays.trim() === "" ? null : Number(noticeDays.trim()),
      reason: reason.trim() || null,
    };
    setIsSubmitting(true);
    setError(null);
    try {
      const created = await post<ExitRecord>("/exits", input);
      toast.success(`Exit started for ${created.employee_name ?? employeeDisplayName(employee)}`);
      setOpen(false);
      reset();
      onCreated(created);
    } catch (caught) {
      setError(apiErrorMessage(caught, "The exit could not be started."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isSubmitting) return;
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="accent">
          <LogOut /> Start an exit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Start an exit</DialogTitle>
          <DialogDescription>
            {isHr
              ? "The clearance checklist is created from your checklist setup."
              : "You can start an exit only for people in your reporting line."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <FormField
            htmlFor="exit-employee"
            label="Employee"
            error={touched && !employee ? "Choose the employee who is leaving." : null}
          >
            <EmployeePicker
              id="exit-employee"
              value={employee}
              onChange={setEmployee}
              excludeId={ownEmployeeId}
              invalid={touched && !employee}
              disabled={isSubmitting}
            />
          </FormField>

          <FormField
            htmlFor="exit-type"
            label="Exit type"
            error={touched && !exitType ? "Choose an exit type." : null}
          >
            <Select
              value={exitType}
              disabled={isSubmitting}
              onValueChange={(next) => setExitType(next as ExitType)}
            >
              <SelectTrigger id="exit-type" className="w-full" aria-invalid={touched && !exitType}>
                <SelectValue placeholder="Choose an exit type" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(EXIT_TYPE_LABELS) as ExitType[]).map((type) => (
                  <SelectItem key={type} value={type}>
                    {EXIT_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            htmlFor="exit-resignation-date"
            label="Resignation or notice date"
            error={touched && !resignationDate ? "The date is required." : null}
          >
            <Input
              id="exit-resignation-date"
              type="date"
              value={resignationDate}
              disabled={isSubmitting}
              aria-invalid={touched && !resignationDate}
              onChange={(event) => setResignationDate(event.target.value)}
            />
          </FormField>

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              htmlFor="exit-requested-lwd"
              label="Requested last working day"
              optional
              error={
                requestedBeforeResignation ? "Cannot be before the resignation date." : null
              }
            >
              <Input
                id="exit-requested-lwd"
                type="date"
                min={resignationDate || undefined}
                value={requestedLwd}
                disabled={isSubmitting}
                aria-invalid={requestedBeforeResignation}
                onChange={(event) => setRequestedLwd(event.target.value)}
              />
            </FormField>
            <FormField
              htmlFor="exit-approved-lwd"
              label="Approved last working day"
              optional
              error={approvedBeforeResignation ? "Cannot be before the resignation date." : null}
            >
              <Input
                id="exit-approved-lwd"
                type="date"
                min={resignationDate || undefined}
                value={approvedLwd}
                disabled={isSubmitting}
                aria-invalid={approvedBeforeResignation}
                onChange={(event) => setApprovedLwd(event.target.value)}
              />
            </FormField>
          </div>

          <FormField
            htmlFor="exit-notice-days"
            label="Notice period in days"
            optional
            hint="Leave blank to use the employee's notice period."
            error={noticeValid ? null : "Enter a whole number of days."}
          >
            <Input
              id="exit-notice-days"
              inputMode="numeric"
              value={noticeDays}
              disabled={isSubmitting}
              aria-invalid={!noticeValid}
              className="tabular-nums"
              onChange={(event) => setNoticeDays(event.target.value)}
            />
          </FormField>

          <FormField htmlFor="exit-reason" label="Reason" optional>
            <Textarea
              id="exit-reason"
              rows={3}
              maxLength={2000}
              value={reason}
              disabled={isSubmitting}
              onChange={(event) => setReason(event.target.value)}
            />
          </FormField>

          {error && <InlineProblem>{error}</InlineProblem>}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={isSubmitting} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={isSubmitting} onClick={() => void submit()}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            Start exit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
