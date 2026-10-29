"use client";

import { Calculator, IndianRupee, Loader2, Lock, Send, Trash2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DatePicker } from "@/components/common/DatePicker";
import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import { DeleteRunDialog } from "@/components/payroll/DeleteRunDialog";
import { apiMessage, isRunDeletable, periodLabel } from "@/components/payroll/labels";
import { Button } from "@/components/ui/button";
import { post } from "@/lib/api";
import type { PayrollRun } from "@/lib/types/payroll";

type Action = "approve" | "publish" | "paid" | "delete" | null;

/**
 * The lifecycle buttons for one run, shown only when the step is possible.
 * Approval is the lock: until then the run can be recomputed or deleted.
 * The API enforces every rule again; a refusal is shown in its own words.
 */
export function RunActions({
  run,
  onChanged,
  onDeleted,
}: {
  run: PayrollRun;
  onChanged: (run: PayrollRun) => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<Action>(null);
  const [paymentDate, setPaymentDate] = useState(run.payment_date ?? "");
  const period = periodLabel(run.period_year, run.period_month);
  const noSalary = run.input_notices.filter((notice) => notice.key === "no_salary").length;

  const canCompute = ["draft", "pending_review", "failed"].includes(run.status);
  const canApprove = run.status === "pending_review";
  const canPublish = (run.status === "approved" || run.status === "paid") && !run.published_at;
  const canMarkPaid = run.status === "approved";
  const canDelete = isRunDeletable(run.status);

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
          ? "You computed this run, so someone else approves and locks it."
          : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canCompute && (
        <Button
          variant={run.status === "pending_review" ? "outline" : "default"}
          disabled={busy}
          onClick={() => void compute()}
        >
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
          <Lock /> Approve &amp; lock
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
      {canDelete && (
        <Button variant="outline" disabled={busy} onClick={() => setConfirm("delete")}>
          <Trash2 /> Delete run
        </Button>
      )}
      {canApprove && approveBlocked && (
        <p className="w-full text-xs text-muted-foreground">{approveBlocked}</p>
      )}

      <ConfirmDialog
        open={confirm === "approve"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`Approve and lock ${period} payroll?`}
        description={
          <>
            {run.employee_count} employee(s), net pay <Money value={run.total_net} />. Once locked
            the run cannot be recomputed or deleted, and every loan, reimbursement, arrear and bonus
            on it is marked as paid by this run. A correction after that is an arrears or off-cycle
            run.
            {noSalary > 0 &&
              ` ${noSalary === 1 ? "1 person" : `${noSalary} people`} had no salary when this run was computed and ${noSalary === 1 ? "is" : "are"} not on it. If their salary has been added since, cancel and Recompute to include them; otherwise an off-cycle run pays them later.`}
          </>
        }
        confirmLabel="Approve & lock"
        onConfirm={() => call("approve", undefined, "Run approved and locked.")}
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
        description="Record that the money has moved. The run is already locked; this records the payment date."
        confirmLabel="Mark paid"
        onConfirm={() => call("mark-paid", { payment_date: paymentDate || null }, "Run marked paid.")}
      >
        <FormField htmlFor="paid-on" label="Payment date" optional hint="Defaults to today.">
          <DatePicker id="paid-on" value={paymentDate} onChange={setPaymentDate} />
        </FormField>
      </ConfirmDialog>
      <DeleteRunDialog
        run={confirm === "delete" ? run : null}
        onOpenChange={(open) => !open && setConfirm(null)}
        onDeleted={onDeleted}
      />
    </div>
  );
}
