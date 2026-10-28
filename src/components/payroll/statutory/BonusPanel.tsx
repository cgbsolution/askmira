"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Gift, Loader2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataTable } from "@/components/common/data-table/DataTable";
import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import { RequireRole } from "@/components/common/RequireRole";
import { apiMessage, periodLabel } from "@/components/payroll/labels";
import { useEmployeeNames } from "@/components/payroll/useEmployeeNames";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import { ADMIN } from "@/lib/access";
import type { Page } from "@/lib/types";
import type { BonusComputation, EntityOption, PayrollRun } from "@/lib/types/payroll";
import { formatDay } from "@/lib/utils";
import { DatePicker } from "@/components/common/DatePicker";

const OWN_PAYMENT = "own";

function defaultYear(): string {
  const now = new Date();
  // The last completed April–March year: bonus is computed once the year is over.
  const start = now.getMonth() >= 3 ? now.getFullYear() - 1 : now.getFullYear() - 2;
  return `${start}-${start + 1}`;
}

/** An approved bonus already placed in a payroll run reads as scheduled, not as approved. */
function statusLabel(row: BonusComputation): string {
  return row.status === "approved" && row.paid_in_run_id ? "Scheduled in a run" : row.status;
}

/**
 * Statutory bonus for a financial year: compute, approve, then pay — on its own
 * or inside a regular payroll run that has not been approved yet.
 */
export function BonusPanel() {
  const [year, setYear] = useState(defaultYear());
  const validYear = /^\d{4}-\d{4}$/.test(year);
  const bonus = useApiQuery<BonusComputation[]>(
    validYear ? `/statutory/bonus?financial_year=${year}` : null,
  );
  const entities = useApiQuery<EntityOption[]>("/org/legal-entities");
  const runs = useApiQuery<Page<PayrollRun>>("/payroll/runs?page_size=50");
  const nameOf = useEmployeeNames();
  const [entityId, setEntityId] = useState("");
  const [percentage, setPercentage] = useState("");
  const [paidOn, setPaidOn] = useState("");
  const [target, setTarget] = useState(OWN_PAYMENT);
  const [computing, setComputing] = useState(false);
  const [confirm, setConfirm] = useState<"approve" | "disburse" | null>(null);

  useEffect(() => {
    const active = (entities.data ?? []).filter((e) => e.is_active);
    if (!entityId && active.length > 0) setEntityId(active[0].id);
  }, [entities.data, entityId]);

  const rows = bonus.data ?? [];
  const drafts = rows.filter((row) => row.status === "draft");
  const payable = rows.filter((row) => row.status === "approved" && row.is_eligible && !row.paid_in_run_id);
  const openRuns = (runs.data?.items ?? []).filter(
    (run) => run.run_type === "regular" && ["draft", "pending_review", "failed"].includes(run.status),
  );

  const compute = async () => {
    if (!validYear) return toast.error("The financial year is written 2025-2026.");
    if (!entityId) return toast.error("Choose a legal entity.");
    if (percentage && !/^\d+(\.\d{1,3})?$/.test(percentage)) {
      return toast.error("The percentage must be a number.");
    }
    setComputing(true);
    try {
      await post("/statutory/bonus/compute", {
        financial_year: year,
        legal_entity_id: entityId,
        percentage: percentage || null,
      });
      toast.success("Bonus computed.");
      bonus.reload();
    } catch (caught) {
      toast.error(apiMessage(caught, "Could not compute the bonus."));
    } finally {
      setComputing(false);
    }
  };

  const approve = async () => {
    try {
      await post("/statutory/bonus/approve", { financial_year: year, legal_entity_id: entityId });
      toast.success("Bonus approved.");
      bonus.reload();
    } catch (caught) {
      toast.error(apiMessage(caught, "Could not approve the bonus."));
      throw caught;
    }
  };

  const disburse = async () => {
    try {
      await post("/statutory/bonus/disburse", {
        financial_year: year,
        paid_on: paidOn,
        run_id: target === OWN_PAYMENT ? null : target,
      });
      toast.success(target === OWN_PAYMENT ? "Bonus recorded as paid." : "Bonus scheduled into the payroll run.");
      bonus.reload();
    } catch (caught) {
      toast.error(apiMessage(caught, "Could not pay the bonus."));
      throw caught;
    }
  };

  const columns: ColumnDef<BonusComputation>[] = [
    {
      id: "employee",
      header: "Employee",
      accessorFn: (row) => nameOf(row.employee_id),
    },
    {
      id: "eligibility",
      header: "Eligibility",
      accessorFn: (row) => (row.is_eligible ? "Eligible" : (row.ineligibility_reason ?? "Not eligible")),
      meta: { cellClassName: "max-w-xs whitespace-normal text-sm" },
      cell: ({ row }) =>
        row.original.is_eligible ? (
          <Badge variant="success">Eligible</Badge>
        ) : (
          <span className="text-muted-foreground">{row.original.ineligibility_reason ?? "Not eligible"}</span>
        ),
    },
    {
      accessorKey: "eligible_wage",
      header: "Eligible wage",
      sortingFn: "alphanumeric",
      meta: { className: "text-right" },
      cell: ({ row }) => <Money value={row.original.eligible_wage} />,
    },
    {
      accessorKey: "days_worked",
      header: "Days",
      sortingFn: "alphanumeric",
      meta: {
        className: "text-right",
        cellClassName: "tabular-nums",
        text: (row) => `${row.days_worked}/${row.total_working_days}`,
      },
      cell: ({ row }) => `${row.original.days_worked}/${row.original.total_working_days}`,
    },
    {
      accessorKey: "percentage",
      header: "%",
      sortingFn: "alphanumeric",
      meta: { className: "text-right", cellClassName: "tabular-nums" },
    },
    {
      accessorKey: "amount",
      header: "Amount",
      sortingFn: "alphanumeric",
      meta: { className: "text-right" },
      cell: ({ row }) => <Money value={row.original.amount} />,
    },
    {
      accessorKey: "status",
      header: "Status",
      meta: {
        cellClassName: "text-sm",
        text: (row) => (row.paid_on ? `${statusLabel(row)} ${formatDay(row.paid_on, true)}` : statusLabel(row)),
      },
      cell: ({ row }) => (
        <>
          <Badge
            variant={
              row.original.status === "paid" ? "success" : row.original.status === "approved" ? "accent" : "muted"
            }
          >
            {statusLabel(row.original)}
          </Badge>
          {row.original.paid_on && (
            <span className="ml-1 text-xs text-muted-foreground">{formatDay(row.original.paid_on, true)}</span>
          )}
        </>
      ),
    },
  ];

  return (
    <>
      <DataTable
        title="Statutory bonus"
        description="Computed from the year's payslips against the approved bonus rule set."
        columns={columns}
        data={rows}
        noun="employees"
        exportName={validYear ? `statutory-bonus-${year}` : "statutory-bonus"}
        searchPlaceholder="Search employees"
        tabs={
          <div className="flex flex-wrap items-end gap-3">
            <FormField htmlFor="bonus-year" label="Financial year">
              <Input id="bonus-year" className="w-32" value={year} onChange={(e) => setYear(e.target.value)} />
            </FormField>
            <RequireRole roles={ADMIN}>
              <FormField htmlFor="bonus-entity" label="Legal entity">
                <Select value={entityId} onValueChange={setEntityId}>
                  <SelectTrigger id="bonus-entity" className="w-48">
                    <SelectValue placeholder="Choose" />
                  </SelectTrigger>
                  <SelectContent>
                    {(entities.data ?? []).map((entity) => (
                      <SelectItem key={entity.id} value={entity.id}>
                        {entity.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField htmlFor="bonus-pct" label="Declared %" optional>
                <Input id="bonus-pct" className="w-24" inputMode="decimal" value={percentage} onChange={(e) => setPercentage(e.target.value)} />
              </FormField>
              <Button variant="outline" disabled={computing} onClick={() => void compute()}>
                {computing && <Loader2 className="animate-spin" />}
                Compute
              </Button>
              {drafts.length > 0 && <Button onClick={() => setConfirm("approve")}>Approve</Button>}
              {payable.length > 0 && <Button onClick={() => setConfirm("disburse")}>Pay</Button>}
            </RequireRole>
          </div>
        }
        isLoading={bonus.isLoading && !bonus.data}
        error={bonus.error?.status === 404 ? null : bonus.error?.detail}
        onRetry={bonus.reload}
        empty={{
          icon: Gift,
          title: validYear ? `No bonus computed for ${year}` : "Enter a financial year like 2025-2026",
          description: "Compute it once the year's payroll runs are approved.",
        }}
      />

      <ConfirmDialog
        open={confirm === "approve"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`Approve statutory bonus for ${year}?`}
        description={`${drafts.length} computation(s) are frozen against recomputation once approved.`}
        confirmLabel="Approve"
        onConfirm={approve}
      />
      <ConfirmDialog
        open={confirm === "disburse"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Pay the approved bonus"
        description={`${payable.length} employee(s). Paid on its own, it is recorded as paid on the date you give. Inside a payroll run, it appears on the payslips and is marked paid when that run is approved.`}
        confirmLabel={target === OWN_PAYMENT ? "Record as paid" : "Schedule into run"}
        onConfirm={async () => {
          if (target === OWN_PAYMENT && !paidOn) {
            toast.error("Give the payment date.");
            throw new Error("missing date");
          }
          await disburse();
        }}
      >
        <div className="grid gap-3">
          <FormField htmlFor="bonus-target" label="How it is paid">
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger id="bonus-target" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={OWN_PAYMENT}>As its own payment</SelectItem>
                {openRuns.map((run) => (
                  <SelectItem key={run.id} value={run.id}>
                    In the {periodLabel(run.period_year, run.period_month)} run
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          {target === OWN_PAYMENT && (
            <FormField htmlFor="bonus-paid-on" label="Paid on">
              <DatePicker id="bonus-paid-on" value={paidOn} onChange={setPaidOn} />
            </FormField>
          )}
        </div>
      </ConfirmDialog>
    </>
  );
}
