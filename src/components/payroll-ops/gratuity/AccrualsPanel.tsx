"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { CalendarClock, Loader2, Lock, Play } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/data-table/DataTable";
import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import { EmployeeCell } from "@/components/payroll-ops/loans/common";
import { apiErrorMessage, InlineProblem } from "@/components/payroll-ops/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { AccrualRunResult, GratuityAccrual } from "@/lib/types/payroll-ops";
import { formatDay, formatDays, toISODate } from "@/lib/utils";

import { AccrualDateSelect, useAccrualDates } from "./AccrualDatePicker";
import { WorkingButton } from "./common";

const ACCRUAL_COLUMNS: ColumnDef<GratuityAccrual>[] = [
  {
    accessorKey: "employee_name",
    header: "Employee",
    meta: { text: (row) => [row.employee_name, row.employee_code].filter(Boolean).join(" ") },
    cell: ({ row }) => (
      <EmployeeCell name={row.original.employee_name} code={row.original.employee_code} />
    ),
  },
  {
    accessorKey: "service_days",
    header: "Service",
    meta: {
      className: "text-right",
      cellClassName: "tabular-nums",
      text: (row) => `${formatDays(row.service_years)} yrs · ${row.service_days} days`,
    },
    cell: ({ row }) => (
      <>
        {formatDays(row.original.service_years)} yrs
        <span className="block text-xs text-muted-foreground">{row.original.service_days} days</span>
      </>
    ),
  },
  {
    accessorKey: "is_eligible",
    header: "Eligibility",
    meta: { text: (row) => (row.is_eligible ? "Eligible" : "Not yet eligible") },
    cell: ({ row }) =>
      row.original.is_eligible ? (
        <Badge variant="success">Eligible</Badge>
      ) : (
        <Badge variant="muted">Not yet eligible</Badge>
      ),
  },
  {
    accessorKey: "monthly_wages",
    header: "Monthly wages",
    sortingFn: "alphanumeric",
    meta: { className: "text-right" },
    cell: ({ row }) => <Money value={row.original.monthly_wages} />,
  },
  {
    accessorKey: "eligible_amount",
    header: "Accrued",
    sortingFn: "alphanumeric",
    meta: { className: "text-right" },
    cell: ({ row }) => <Money value={row.original.eligible_amount} />,
  },
  {
    id: "actions",
    header: "",
    enableHiding: false,
    meta: { className: "text-right", headClassName: "w-24", text: false },
    cell: ({ row }) => (
      <WorkingButton
        title={`Accrual working · ${row.original.employee_name ?? ""}`}
        working={row.original.working}
      />
    ),
  },
];

/** Run a gratuity accrual, and read each employee's accrual on a date. */
export function AccrualsPanel({ canRun }: { canRun: boolean }) {
  const { dates, asOf, setAsOf } = useAccrualDates();
  const accruals = useApiQuery<GratuityAccrual[]>(
    asOf ? `/gratuity/accruals?as_of=${encodeURIComponent(asOf)}` : null,
  );

  // The run dates load first; once there is one, the panel shows the chosen date's accruals.
  const hasDates = !dates.error && (dates.data?.length ?? 0) > 0;
  const current = hasDates ? accruals : dates;
  // A 403 reads as "no access", not as a failed load.
  const forbidden = current.error?.status === 403;
  // The newest date is picked a moment after the dates arrive; until its accruals do, it is loading.
  const isLoading = hasDates
    ? accruals.data === null && !accruals.error
    : dates.isLoading && dates.data === null;

  return (
    <div className="space-y-4">
      {canRun && (
        <RunAccrualCard
          onRan={(ranOn) => {
            setAsOf(ranOn);
            dates.reload();
            accruals.reload();
          }}
        />
      )}

      <DataTable
        title="Accruals by employee"
        description="Each figure is what the employee would be owed in gratuity on that date, under the approved configuration."
        columns={ACCRUAL_COLUMNS}
        data={hasDates && !forbidden ? (accruals.data ?? []) : []}
        noun="employees"
        exportName={asOf ? `gratuity-accruals-${asOf}` : "gratuity-accruals"}
        searchPlaceholder="Search employees"
        isLoading={isLoading}
        error={forbidden ? null : (current.error?.detail ?? null)}
        onRetry={current.reload}
        empty={
          forbidden
            ? { icon: Lock, title: "You don't have access to this", description: current.error?.detail }
            : hasDates
              ? {
                  icon: CalendarClock,
                  title: "No accruals on this date",
                  description: "The accrual run for this date covered no employees.",
                }
              : {
                  icon: CalendarClock,
                  title: "No accrual has been run yet",
                  description: "Accruals appear here once one has been run for a date.",
                }
        }
        filters={
          dates.data && dates.data.length > 0 ? (
            <AccrualDateSelect dates={dates.data} value={asOf} onChange={setAsOf} />
          ) : undefined
        }
      />
    </div>
  );
}

function RunAccrualCard({ onRan }: { onRan: (asOf: string) => void }) {
  const [asOf, setAsOf] = useState(toISODate(new Date()));
  const [result, setResult] = useState<AccrualRunResult | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const run = async () => {
    if (!asOf) return setProblem("Choose the date to accrue as of.");
    setProblem(null);
    setIsBusy(true);
    try {
      const ran = await post<AccrualRunResult>("/gratuity/accrue", { as_of: asOf });
      setResult(ran);
      toast.success(`Accrual run as of ${formatDay(ran.as_of, true)}`);
      onRan(ran.as_of);
    } catch (error) {
      setResult(null);
      setProblem(apiErrorMessage(error, "The accrual could not be run."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle>Run an accrual</CardTitle>
        <CardDescription>
          Accruals are meant to run monthly on a schedule, which is not connected yet — until it is,
          run them here. Running it again for a date that already has an accrual changes nothing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <FormField htmlFor="accrue-as-of" label="As of">
            <Input
              id="accrue-as-of"
              type="date"
              required
              className="w-44"
              value={asOf}
              disabled={isBusy}
              onChange={(event) => setAsOf(event.target.value)}
            />
          </FormField>
          <Button disabled={isBusy} onClick={() => void run()}>
            {isBusy ? <Loader2 className="animate-spin" /> : <Play />}
            Run accrual
          </Button>
        </div>
        {problem && <InlineProblem>{problem}</InlineProblem>}
        {result && (
          <p className="text-sm text-foreground">
            As of {formatDay(result.as_of, true)}:{" "}
            <span className="tabular-nums">{result.employees}</span> employees, total accrued
            liability <Money value={result.total_accrued_liability} className="font-semibold" />.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
