"use client";

import { BadgeCheck, Calculator, IndianRupee, Loader2, Send } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import { apiMessage, periodLabel } from "@/components/payroll/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { post } from "@/lib/api";
import type { PayrollRun } from "@/lib/types/payroll";

type Action = "approve" | "publish" | "paid" | null;

/**
 * The lifecycle buttons for one run, shown only when the step is possible.
 * The API enforces every rule again; a refusal is shown in its own words.
 */
export function RunActions({ run, onChanged }: { run: PayrollRun; onChanged: (run: PayrollRun) => void }) {
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<Action>(null);
  const [paymentDate, setPaymentDate] = useState(run.payment_date ?? "");
  const period = periodLabel(run.period_year, run.period_month);

  const canCompute = ["draft", "pending_review", "failed"].includes(run.status);
  const canApprove = run.status === "pending_review";
  const canPublish = (run.status === "approved" || run.status === "paid") && !run.published_at;
  const canMarkPaid = run.status === "approved";

  const call = async (path: string, body: unknown, success: string) => {
    try {
      const updated = await post<PayrollRun>(`/payroll/runs/${run.id}/${path}`, body);
      toast.success(success);
      onChanged(updated);
    } catch (caught) {
      toast.error(apiMessage(caught, "That step could not be completed."));
      throw caught;
    }
  };

  const compute = async () => {
    setBusy(true);
    try {
      await call("compute", undefined, "Payroll computed.");
    } catch {
      // Shown as a toast; a failed compute also reloads so its error log shows.
      onChanged({ ...run });
    } finally {
      setBusy(false);
    }
  };

  const approveBlocked =
    run.unacknowledged_variances > 0
      ? "Acknowledge every variance first."
      : run.review_flags.length > 0
        ? "Resolve the review flags and recompute first."
        : !run.caller_may_approve
          ? "You computed this run, so someone else approves it."
          : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canCompute && (
        <Button variant={run.status === "pending_review" ? "outline" : "default"} disabled={busy} onClick={() => void compute()}>
          {busy ? <Loader2 className="animate-spin" /> : <Calculator />}
          {run.status === "pending_review" ? "Recompute" : "Compute"}
        </Button>
      )}
      {canApprove && (
        <Button
          disabled={busy || approveBlocked !== null}
          title={approveBlocked ?? undefined}
          onClick={() => setConfirm("approve")}
        >
          <BadgeCheck /> Approve
        </Button>
      )}
      {canPublish && (
        <Button onClick={() => setConfirm("publish")}>
          <Send /> Publish payslips
        </Button>
      )}
      {canMarkPaid && (
        <Button variant="outline" onClick={() => setConfirm("paid")}>
          <IndianRupee /> Mark paid
        </Button>
      )}
      {canApprove && approveBlocked && (
        <p className="w-full text-xs text-muted-foreground">{approveBlocked}</p>
      )}

      <ConfirmDialog
        open={confirm === "approve"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`Approve ${period} payroll?`}
        description={
          <>
            {run.employee_count} employee(s), net pay <Money value={run.total_net} />. Once
            approved the run cannot be recomputed, and every loan, reimbursement, arrear and
            bonus on it is marked as paid by this run.
          </>
        }
        confirmLabel="Approve run"
        onConfirm={() => call("approve", undefined, "Run approved.")}
      />
      <ConfirmDialog
        open={confirm === "publish"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Publish payslips?"
        description={`Each of the ${run.employee_count} employees can then see their ${period} payslip and is notified.`}
        confirmLabel="Publish"
        onConfirm={() => call("publish", undefined, "Payslips published.")}
      />
      <ConfirmDialog
        open={confirm === "paid"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Mark this run paid?"
        description="Record that the money has moved. A paid run is locked for good."
        confirmLabel="Mark paid"
        onConfirm={() => call("mark-paid", { payment_date: paymentDate || null }, "Run marked paid.")}
      >
        <FormField htmlFor="paid-on" label="Payment date" optional hint="Defaults to today.">
          <Input
            id="paid-on"
            type="date"
            value={paymentDate}
            onChange={(event) => setPaymentDate(event.target.value)}
          />
        </FormField>
      </ConfirmDialog>
    </div>
  );
}
