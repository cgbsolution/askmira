"use client";

import { BadgeCheck, Ban, Calculator, IndianRupee, Loader2, Send } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import { apiMessage, periodLabel } from "@/components/payroll/labels";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { post } from "@/lib/api";
import type { PayrollRun } from "@/lib/types/payroll";
import { DatePicker } from "@/components/common/DatePicker";

type Action = "approve" | "publish" | "paid" | "cancel" | null;

/**
 * The lifecycle buttons for one run, shown only when the step is possible.
 * The API enforces every rule again; a refusal is shown in its own words.
 */
export function RunActions({ run, onChanged }: { run: PayrollRun; onChanged: (run: PayrollRun) => void }) {
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<Action>(null);
  const [paymentDate, setPaymentDate] = useState(run.payment_date ?? "");
  const [cancelReason, setCancelReason] = useState("");
  const period = periodLabel(run.period_year, run.period_month);

  const canCompute = ["draft", "pending_review", "failed"].includes(run.status);
  const canApprove = run.status === "pending_review";
  const canPublish = (run.status === "approved" || run.status === "paid") && !run.published_at;
  const canMarkPaid = run.status === "approved";
  // Opened in error (wrong month, wrong entity): discarded before anything is signed off.
  const canCancel = ["draft", "pending_review", "failed"].includes(run.status);

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
      {canCancel && (
        <Button variant="outline" disabled={busy} onClick={() => setConfirm("cancel")}>
          <Ban /> Cancel run
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
          <DatePicker
            id="paid-on"
            value={paymentDate}
            onChange={setPaymentDate}
          />
        </FormField>
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === "cancel"}
        onOpenChange={(open) => {
          if (!open) {
            setConfirm(null);
            setCancelReason("");
          }
        }}
        title={`Cancel this ${period} run?`}
        description="Its payslips are removed and nothing on it is paid. The run stays on the list as cancelled, with your reason, and the month can be opened again."
        confirmLabel="Cancel run"
        cancelLabel="Keep run"
        destructive
        onConfirm={async () => {
          if (cancelReason.trim().length < 3) {
            toast.error("Say why this run is being cancelled.");
            throw new Error("reason required");
          }
          await call("cancel", { reason: cancelReason.trim() }, "Run cancelled.");
        }}
      >
        <FormField htmlFor="cancel-reason" label="Reason">
          <Textarea
            id="cancel-reason"
            value={cancelReason}
            maxLength={500}
            placeholder="Opened for the wrong month"
            onChange={(event) => setCancelReason(event.target.value)}
          />
        </FormField>
      </ConfirmDialog>
    </div>
  );
}
