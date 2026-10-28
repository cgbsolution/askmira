"use client";

import React from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { apiMessage, periodLabel, RUN_TYPE } from "@/components/payroll/labels";
import { del } from "@/lib/api";
import type { PayrollRun } from "@/lib/types/payroll";

/**
 * Delete a run that is not locked, with its payslips, so the month can be run
 * again. Open while `run` is set. The audit log keeps what the run was.
 */
export function DeleteRunDialog({
  run,
  onOpenChange,
  onDeleted,
}: {
  run: PayrollRun | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const period = run ? periodLabel(run.period_year, run.period_month) : "";
  const kind = run ? RUN_TYPE[run.run_type].toLowerCase() : "";

  return (
    <ConfirmDialog
      open={run !== null}
      onOpenChange={onOpenChange}
      title={`Delete the ${period} ${kind} run?`}
      description={
        run && run.employee_count > 0
          ? `Its ${run.employee_count} payslip(s) are removed too. Nothing on it has been paid, and ${period} can be run again. This cannot be undone; the audit log keeps a record.`
          : `Nothing on it has been computed or paid, and ${period} can be run again. This cannot be undone; the audit log keeps a record.`
      }
      confirmLabel="Delete run"
      cancelLabel="Keep run"
      destructive
      onConfirm={async () => {
        if (!run) return;
        try {
          await del(`/payroll/runs/${run.id}`);
        } catch (caught) {
          toast.error(apiMessage(caught, "The run could not be deleted."));
          throw caught;
        }
        toast.success(`The ${period} run was deleted.`);
        onDeleted();
      }}
    />
  );
}
