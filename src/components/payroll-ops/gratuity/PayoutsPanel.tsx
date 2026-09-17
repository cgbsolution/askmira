"use client";

import { Loader2, LogOut } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import { EmployeeCell, Fact, isWholeNumber } from "@/components/payroll-ops/loans/common";
import { EmployeePicker } from "@/components/payroll-ops/loans/EmployeePicker";
import { QueryPanel } from "@/components/payroll-ops/loans/QueryPanel";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { EmployeeSummary } from "@/lib/types";
import type { ExitGratuityInput, ExitReason, GratuityPayout } from "@/lib/types/payroll-ops";
import { formatDay, formatDays, toISODate } from "@/lib/utils";

import { EXIT_REASON_LABEL, WorkingButton } from "./common";

/** Gratuity computed for leavers: gross, the exempt part, and the taxable rest. */
export function PayoutsPanel({ canCompute }: { canCompute: boolean }) {
  const payouts = useApiQuery<GratuityPayout[]>("/gratuity/payouts");

  return (
    <div className="space-y-4">
      {canCompute && <ComputePayoutCard onComputed={payouts.reload} />}

      <QueryPanel
        query={payouts}
        title="Payouts at exit"
        description="The taxable part of each payout reaches the employee's TDS projection."
        isEmpty={(rows) => rows.length === 0}
        empty={{
          icon: LogOut,
          title: "No gratuity payouts yet",
          description: "Gratuity computed for an employee's exit is recorded here.",
        }}
      >
        {(rows) => (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Exit</TableHead>
                <TableHead className="text-right">Service</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Exempt</TableHead>
                <TableHead className="text-right">Taxable</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <EmployeeCell name={row.employee_name} code={row.employee_code} />
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDay(row.exit_date, true)}
                    <span className="block text-xs text-muted-foreground">
                      {EXIT_REASON_LABEL[row.exit_reason]}
                    </span>
                    {row.eligibility_waived && (
                      <Badge variant="outline" className="mt-1">
                        Service requirement waived
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatDays(row.service_years)} yrs
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={row.gross_amount} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={row.exempt_amount} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={row.taxable_amount} className="font-medium" />
                  </TableCell>
                  <TableCell className="text-right">
                    <WorkingButton
                      title={`Gratuity working · ${row.employee_name ?? ""}`}
                      working={row.working}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </QueryPanel>
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
            <Input
              id="payout-exit-date"
              type="date"
              required
              value={exitDate}
              disabled={isBusy}
              onChange={(event) => setExitDate(event.target.value)}
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
