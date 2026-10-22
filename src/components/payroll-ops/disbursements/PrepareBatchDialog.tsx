"use client";

import { Loader2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { formatPeriod, InlineProblem } from "@/components/payroll-ops/shared";
import { FORMAT_LABEL } from "@/components/payroll-ops/disbursements/labels";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError, post } from "@/lib/api";
import type {
  BankProfile,
  BatchPrepareInput,
  DisbursementBatch,
  PayrollRunSummary,
} from "@/lib/types/payroll-ops";
import { toISODate } from "@/lib/utils";

export function runLabel(run: PayrollRunSummary): string {
  const period = formatPeriod(`${run.period_year}-${String(run.period_month).padStart(2, "0")}`);
  return `${period} · ${run.run_type} · ${run.employee_count} employees`;
}

/** Prepare a salary file for an approved or paid payroll run. */
export function PrepareBatchDialog({
  open,
  onOpenChange,
  runs,
  runsError,
  profiles,
  initial,
  onPrepared,
  onBlocked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Already narrowed to runs that can be disbursed. */
  runs: PayrollRunSummary[];
  runsError: string | null;
  profiles: BankProfile[];
  initial: Partial<BatchPrepareInput> | null;
  onPrepared: (batch: DisbursementBatch) => void;
  onBlocked: (input: BatchPrepareInput, message: string) => void;
}) {
  const [runId, setRunId] = useState("");
  const [profileId, setProfileId] = useState("");
  const [valueDate, setValueDate] = useState("");
  const [holdCodes, setHoldCodes] = useState<string[]>([]);
  const [holdReason, setHoldReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [seeded, setSeeded] = useState(false);

  // Seed from `initial` each time the dialog opens.
  if (open && !seeded) {
    setSeeded(true);
    setRunId(initial?.payroll_run_id ?? "");
    setProfileId(initial?.bank_profile_id ?? (profiles.length === 1 ? profiles[0].id : ""));
    setValueDate(initial?.value_date ?? "");
    setHoldCodes((initial?.hold ?? []).map((item) => item.employee_code));
    setHoldReason(initial?.hold?.[0]?.reason ?? "");
    setError(null);
  }
  if (!open && seeded) setSeeded(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!runId || !profileId || !valueDate) {
      setError("Choose a payroll run, a bank profile and the value date.");
      return;
    }
    if (holdCodes.length > 0 && holdReason.trim().length < 3) {
      setError("Say why these salaries are held.");
      return;
    }
    const body: BatchPrepareInput = {
      payroll_run_id: runId,
      bank_profile_id: profileId,
      value_date: valueDate,
      ...(holdCodes.length > 0
        ? { hold: holdCodes.map((code) => ({ employee_code: code, reason: holdReason.trim() })) }
        : {}),
    };
    setIsBusy(true);
    try {
      const batch = await post<DisbursementBatch>("/disbursement/batches", body);
      toast.success("Salary file prepared and waiting for approval");
      onOpenChange(false);
      onPrepared(batch);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 422) {
        const message = caught.detail.startsWith("Request failed")
          ? "The file was blocked by validation. Fix the listed problems and prepare it again."
          : caught.detail;
        onOpenChange(false);
        onBlocked(body, message);
      } else {
        setError(caught instanceof ApiError ? caught.detail : "The batch could not be prepared.");
      }
    } finally {
      setIsBusy(false);
    }
  };

  const activeProfiles = profiles.filter((profile) => profile.active);

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Prepare a salary file</DialogTitle>
          <DialogDescription>
            Only approved or paid payroll runs can be disbursed. Someone other than you approves
            the file.
          </DialogDescription>
        </DialogHeader>
        <form id="prepare-form" className="grid gap-4" onSubmit={(event) => void submit(event)} noValidate>
          <FormField htmlFor="prepare-run" label="Payroll run">
            {runsError ? (
              <InlineProblem>Payroll runs could not be loaded: {runsError}</InlineProblem>
            ) : runs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No payroll run is approved or paid yet, so there is nothing to disburse.
              </p>
            ) : (
              <Select value={runId} onValueChange={setRunId}>
                <SelectTrigger id="prepare-run" className="w-full">
                  <SelectValue placeholder="Choose a payroll run" />
                </SelectTrigger>
                <SelectContent>
                  {runs.map((run) => (
                    <SelectItem key={run.id} value={run.id}>
                      {runLabel(run)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
          <FormField htmlFor="prepare-profile" label="Bank profile">
            {activeProfiles.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No active bank profile. An admin adds one under Bank profiles.
              </p>
            ) : (
              <Select value={profileId} onValueChange={setProfileId}>
                <SelectTrigger id="prepare-profile" className="w-full">
                  <SelectValue placeholder="Choose a bank profile" />
                </SelectTrigger>
                <SelectContent>
                  {activeProfiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.bank_name} · {FORMAT_LABEL[profile.file_format] ?? profile.file_format}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
          <FormField htmlFor="prepare-value-date" label="Value date">
            <Input
              id="prepare-value-date"
              type="date"
              required
              min={toISODate(new Date())}
              value={valueDate}
              onChange={(event) => setValueDate(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">The date the bank should credit salaries.</p>
          </FormField>
          {holdCodes.length > 0 && (
            <FormField htmlFor="prepare-hold-reason" label={`Hold ${holdCodes.length} salary(ies)`}>
              <p className="text-sm text-foreground">{holdCodes.join(", ")}</p>
              <Textarea
                id="prepare-hold-reason"
                value={holdReason}
                placeholder="Why they are held, e.g. bank details not given yet"
                onChange={(event) => setHoldReason(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Left out of this file so everyone else is paid on time. Once their bank accounts are
                in, pay them from the file with Pay held salaries.
              </p>
            </FormField>
          )}
          {error && <InlineProblem>{error}</InlineProblem>}
        </form>
        <DialogFooter>
          <Button variant="outline" disabled={isBusy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="prepare-form"
            disabled={isBusy || runs.length === 0 || activeProfiles.length === 0}
          >
            {isBusy && <Loader2 className="animate-spin" />}
            Validate and prepare
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
