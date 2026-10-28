"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Loader2, Lock, LogOut } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/data-table/DataTable";
import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import { EmployeeCell, Fact, isWholeNumber } from "@/components/payroll-ops/loans/common";
import { EmployeePicker } from "@/components/payroll-ops/loans/EmployeePicker";
import { apiErrorMessage, InlineProblem } from "@/components/payroll-ops/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { EmployeeSummary } from "@/lib/types";
import type { ExitGratuityInput, ExitReason, GratuityPayout } from "@/lib/types/payroll-ops";
import { formatDay, formatDays, toISODate } from "@/lib/utils";

import { EXIT_REASON_LABEL, WorkingButton } from "./common";
import { DatePicker } from "@/components/common/DatePicker";

const PAYOUT_COLUMNS: ColumnDef<GratuityPayout>[] = [
  {
    accessorKey: "employee_name",
    header: "Employee",
    meta: { text: (row) => [row.employee_name, row.employee_code].filter(Boolean).join(" ") },
    cell: ({ row }) => (
      <EmployeeCell name={row.original.employee_name} code={row.original.employee_code} />
    ),
  },
  {
    accessorKey: "exit_date",
    header: "Exit",
    meta: {
      cellClassName: "text-sm",
      text: (row) =>
        [
          formatDay(row.exit_date, true),
          EXIT_REASON_LABEL[row.exit_reason],
          row.eligibility_waived ? "Service requirement waived" : null,
        ]
          .filter(Boolean)
          .join(" · "),
    },
    cell: ({ row }) => (
      <>
        {formatDay(row.original.exit_date, true)}
        <span className="block text-xs text-muted-foreground">
          {EXIT_REASON_LABEL[row.original.exit_reason]}
        </span>
        {row.original.eligibility_waived && (
          <Badge variant="outline" className="mt-1">
            Service requirement waived
          </Badge>
        )}
      </>
    ),
  },
  {
    accessorKey: "service_years",
    header: "Service",
    sortingFn: "alphanumeric",
    meta: { className: "text-right", cellClassName: "tabular-nums" },
    cell: ({ row }) => `${formatDays(row.original.service_years)} yrs`,
  },
  {
    accessorKey: "gross_amount",
    header: "Gross",
    sortingFn: "alphanumeric",
    meta: { className: "text-right" },
    cell: ({ row }) => <Money value={row.original.gross_amount} />,
  },
  {
    accessorKey: "exempt_amount",
    header: "Exempt",
    sortingFn: "alphanumeric",
    meta: { className: "text-right" },
    cell: ({ row }) => <Money value={row.original.exempt_amount} />,
  },
  {
    accessorKey: "taxable_amount",
    header: "Taxable",
    sortingFn: "alphanumeric",
    meta: { className: "text-right" },
    cell: ({ row }) => <Money value={row.original.taxable_amount} className="font-medium" />,
  },
  {
    id: "actions",
    header: "",
    enableHiding: false,
    meta: { className: "text-right", headClassName: "w-24", text: false },
    cell: ({ row }) => (
      <WorkingButton
        title={`Gratuity working · ${row.original.employee_name ?? ""}`}
        working={row.original.working}
      />
    ),
  },
];

/** Gratuity computed for leavers: gross, the exempt part, and the taxable rest. */
export function PayoutsPanel({ canCompute }: { canCompute: boolean }) {
  const payouts = useApiQuery<GratuityPayout[]>("/gratuity/payouts");
  // A 403 is "no access", not a failed load: retrying will not help.
  const forbidden = payouts.error?.status === 403;

  return (
    <div className="space-y-4">
      {canCompute && <ComputePayoutCard onComputed={payouts.reload} />}

      <DataTable
        title="Payouts at exit"
        description="The taxable part of each payout reaches the employee's TDS projection."
        columns={PAYOUT_COLUMNS}
        data={forbidden ? [] : (payouts.data ?? [])}
        noun="payouts"
        exportName="gratuity-payouts"
        searchPlaceholder="Search payouts"
        isLoading={payouts.isLoading && payouts.data === null}
        error={forbidden ? null : (payouts.error?.detail ?? null)}
        onRetry={payouts.reload}
        empty={
          forbidden
            ? { icon: Lock, title: "You don't have access to this", description: payouts.error?.detail }
            : {
                icon: LogOut,
                title: "No gratuity payouts yet",
                description: "Gratuity computed for an employee's exit is recorded here.",
              }
        }
      />
    </div>
  );
}

function ComputePayoutCard({ onComputed }: { onComputed: () => void }) {
  const [employee, setEmployee] = useState<EmployeeSummary | null>(null);
  const [exitDate, setExitDate] = useState(toISODate(new Date()));
  const [reason, setReason] = useState<ExitReason | "">("");
  const [unpaidDays, setUnpaidDays] = useState("0");
  const [result, setResult] = useState<GratuityPayout | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const submit = async () => {
    if (!employee) return setProblem("Choose the employee who is leaving.");
    if (!exitDate) return setProblem("Enter the exit date.");
    if (!reason) return setProblem("Choose the reason for exit.");
    if (!isWholeNumber(unpaidDays)) {
      return setProblem("Unpaid leave days must be a whole number (0 if none).");
    }
    setProblem(null);
    setIsBusy(true);
    const body: ExitGratuityInput = {
      employee_id: employee.id,
      exit_date: exitDate,
      exit_reason: reason,
      unpaid_leave_days: Number(unpaidDays.trim()),
    };
    try {
      const payout = await post<GratuityPayout>("/gratuity/payout", body);
      setResult(payout);
      toast.success("Gratuity computed and recorded");
      setEmployee(null);
      setReason("");
      setUnpaidDays("0");
      onComputed();
    } catch (error) {
      setResult(null);
      setProblem(apiErrorMessage(error, "Gratuity could not be computed."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle>Compute gratuity for a leaver</CardTitle>
        <CardDescription>
          Worked out from the approved configuration and the employee&apos;s service. The result is
          recorded as a payout.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField htmlFor="payout-employee" label="Employee">
            <EmployeePicker
              id="payout-employee"
              value={employee}
              onChange={setEmployee}
              disabled={isBusy}
            />
          </FormField>
          <FormField htmlFor="payout-reason" label="Reason for exit">
            <Select
              value={reason}
              disabled={isBusy}
              onValueChange={(value) => setReason(value as ExitReason)}
            >
              <SelectTrigger id="payout-reason" className="w-full">
                <SelectValue placeholder="Choose a reason" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(EXIT_REASON_LABEL) as ExitReason[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {EXIT_REASON_LABEL[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField htmlFor="payout-exit-date" label="Exit date">
            <DatePicker
              id="payout-exit-date"
              required
              value={exitDate}
              disabled={isBusy}
              onChange={setExitDate}
            />
          </FormField>
          <FormField htmlFor="payout-unpaid" label="Unpaid leave days">
            <Input
              id="payout-unpaid"
              type="number"
              min={0}
              step={1}
              required
              className="tabular-nums"
              value={unpaidDays}
              disabled={isBusy}
              onChange={(event) => setUnpaidDays(event.target.value)}
            />
          </FormField>
        </div>
        <div className="flex justify-end">
          <Button disabled={isBusy} onClick={() => void submit()}>
            {isBusy && <Loader2 className="animate-spin" />}
            Compute gratuity
          </Button>
        </div>
        {problem && <InlineProblem>{problem}</InlineProblem>}
        {result && (
          <div className="space-y-2 rounded-md border border-border bg-muted/50 p-3">
            <p className="text-sm font-medium text-foreground">
              {result.employee_name ?? "Employee"} · {formatDays(result.service_years)} years of
              service
            </p>
            <dl className="grid grid-cols-3 gap-3">
              <Fact label="Gross">
                <Money value={result.gross_amount} />
              </Fact>
              <Fact label="Exempt">
                <Money value={result.exempt_amount} />
              </Fact>
              <Fact label="Taxable">
                <Money value={result.taxable_amount} />
              </Fact>
            </dl>
            <p className="text-xs text-muted-foreground">
              The taxable part reaches the employee&apos;s TDS projection.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
