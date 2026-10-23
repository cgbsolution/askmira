"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { CheckCircle2, Loader2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/data-table/DataTable";
import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import { apiMessage, formatMoment, isZero } from "@/components/payroll/labels";
import { Badge } from "@/components/ui/badge";
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
import { post } from "@/lib/api";
import type { PayrollRun, VarianceFlag } from "@/lib/types/payroll";
import { formatDays } from "@/lib/utils";

/**
 * Net pay that moved beyond the threshold since last month, and payslips whose
 * deductions pass the legal ceiling on their own. Each needs a person to say
 * why it is right before the run can be approved.
 */
export function VariancePanel({
  run,
  onChanged,
}: {
  run: PayrollRun;
  onChanged: (run: PayrollRun) => void;
}) {
  const [target, setTarget] = useState<VarianceFlag | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const editable = run.status === "pending_review";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!target) return;
    if (note.trim().length < 3) return setError("Say why this payslip is correct.");
    setSaving(true);
    setError(null);
    try {
      const updated = await post<PayrollRun>(
        `/payroll/runs/${run.id}/variances/${target.employee_id}/acknowledge`,
        { note: note.trim() },
      );
      toast.success("Variance acknowledged.");
      setTarget(null);
      setNote("");
      onChanged(updated);
    } catch (caught) {
      setError(apiMessage(caught, "Could not record the acknowledgement."));
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnDef<VarianceFlag>[] = [
    {
      id: "employee",
      header: "Employee",
      accessorFn: (flag) => flag.employee_name ?? flag.employee_code,
      meta: { text: (flag) => `${flag.employee_name ?? flag.employee_code} ${flag.employee_code}` },
      cell: ({ row }) => {
        const flag = row.original;
        return (
          <>
            <p className="font-medium text-foreground">{flag.employee_name ?? flag.employee_code}</p>
            <p className="text-xs text-muted-foreground">{flag.employee_code}</p>
            {!isZero(flag.not_employed_days) && (
              <Badge variant="muted" className="mt-1">
                Not employed: {formatDays(flag.not_employed_days)} days
              </Badge>
            )}
            {flag.deduction_ceiling && (
              <Badge variant="warning" className="mt-1">
                Deductions {flag.deduction_ceiling.share_percent}% of wages, ceiling{" "}
                {flag.deduction_ceiling.ceiling_percent}%
              </Badge>
            )}
          </>
        );
      },
    },
    {
      accessorKey: "previous_net",
      header: "Last month",
      meta: { className: "text-right" },
      cell: ({ row }) => (row.original.previous_net === null ? "—" : <Money value={row.original.previous_net} />),
    },
    {
      accessorKey: "current_net",
      header: "This month",
      meta: { className: "text-right" },
      cell: ({ row }) => <Money value={row.original.current_net} />,
    },
    {
      accessorKey: "change_percent",
      header: "Change",
      meta: {
        className: "text-right",
        cellClassName: "tabular-nums",
        text: (flag) => (flag.change_percent === null ? null : `${flag.change_percent}%`),
      },
      cell: ({ row }) => (row.original.change_percent === null ? "—" : `${row.original.change_percent}%`),
    },
    {
      id: "acknowledgement",
      header: "Acknowledgement",
      accessorFn: (flag) => (flag.acknowledged ? "Acknowledged" : "Not acknowledged"),
      meta: {
        cellClassName: "max-w-sm whitespace-normal",
        text: (flag) =>
          flag.acknowledged
            ? `Acknowledged: “${flag.note}” — ${flag.acknowledged_by_name ?? "someone"}, ${formatMoment(flag.acknowledged_at)}`
            : "Not acknowledged",
      },
      cell: ({ row }) => {
        const flag = row.original;
        return flag.acknowledged ? (
          <div className="text-sm">
            <Badge variant="success">Acknowledged</Badge>
            <p className="mt-1 text-muted-foreground">
              “{flag.note}” — {flag.acknowledged_by_name ?? "someone"}, {formatMoment(flag.acknowledged_at)}
            </p>
          </div>
        ) : editable ? (
          <Button size="sm" variant="outline" onClick={() => setTarget(flag)}>
            Acknowledge
          </Button>
        ) : (
          <Badge variant="warning">Not acknowledged</Badge>
        );
      },
    },
  ];

  return (
    <>
      <DataTable
        title="Variances"
        description="Net pay that moved more than the review threshold against last month, and deductions above the legal ceiling."
        columns={columns}
        data={run.variance_flags}
        getRowId={(flag) => flag.employee_id}
        noun="variances"
        exportName={`payroll-variances-${run.period_year}-${String(run.period_month).padStart(2, "0")}`}
        searchPlaceholder="Search by name or code"
        empty={{
          icon: CheckCircle2,
          title: "No variances",
          description:
            "Nobody's net pay moved beyond the threshold or past the deductions ceiling, or there is no prior month to compare.",
        }}
      />

      <Dialog open={target !== null} onOpenChange={(open) => !open && !saving && setTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={(event) => void submit(event)} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Acknowledge a variance</DialogTitle>
              <DialogDescription>
                {target?.employee_name ?? target?.employee_code}:{" "}
                {target?.change_percent !== null && target?.change_percent !== undefined ? (
                  <>
                    net pay moved {target.change_percent}%, from <Money value={target.previous_net} /> to{" "}
                    <Money value={target.current_net} />.{" "}
                  </>
                ) : null}
                {target?.deduction_ceiling ? (
                  <>
                    Deductions of <Money value={target.deduction_ceiling.deductions} /> are{" "}
                    {target.deduction_ceiling.share_percent}% of wages, above the{" "}
                    {target.deduction_ceiling.ceiling_percent}% legal ceiling; recoveries that could wait have
                    already been held back.{" "}
                  </>
                ) : null}
                Your note is kept with the run.
              </DialogDescription>
            </DialogHeader>
            <FormField htmlFor="variance-note" label="Why this is right" error={error}>
              <Textarea
                id="variance-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Promotion effective this month"
                maxLength={1000}
              />
            </FormField>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={saving} onClick={() => setTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="animate-spin" />}
                Acknowledge
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
