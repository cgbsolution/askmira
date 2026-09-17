"use client";

import { CalendarClock, Loader2, Play } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/common/EmptyState";
import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import { EmployeeCell } from "@/components/payroll-ops/loans/common";
import { QueryPanel } from "@/components/payroll-ops/loans/QueryPanel";
import { apiErrorMessage, InlineProblem, QueryBoundary } from "@/components/payroll-ops/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import type { AccrualRunResult, GratuityAccrual } from "@/lib/types/payroll-ops";
import { formatDay, formatDays, toISODate } from "@/lib/utils";

import { AccrualDateSelect, useAccrualDates } from "./AccrualDatePicker";
import { WorkingButton } from "./common";

/** Run a gratuity accrual, and read each employee's accrual on a date. */
export function AccrualsPanel({ canRun }: { canRun: boolean }) {
  const { dates, asOf, setAsOf } = useAccrualDates();
  const accruals = useApiQuery<GratuityAccrual[]>(
    asOf ? `/gratuity/accruals?as_of=${encodeURIComponent(asOf)}` : null,
  );

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

      <QueryPanel
        query={dates}
        title="Accruals by employee"
        description="Each figure is what the employee would be owed in gratuity on that date, under the approved configuration."
        toolbar={
          dates.data && dates.data.length > 0 ? (
            <>
              <AccrualDateSelect dates={dates.data} value={asOf} onChange={setAsOf} />
              <span className="ml-auto text-sm text-muted-foreground tabular-nums">
                {accruals.data ? `${accruals.data.length} employees` : ""}
              </span>
            </>
          ) : undefined
        }
        isEmpty={(rows) => rows.length === 0}
        empty={{
          icon: CalendarClock,
          title: "No accrual has been run yet",
          description: "Accruals appear here once one has been run for a date.",
        }}
      >
        {() => (
          <QueryBoundary query={accruals} skeletonRows={5}>
            {(rows) =>
              rows.length === 0 ? (
                <EmptyState
                  icon={CalendarClock}
                  title="No accruals on this date"
                  description="The accrual run for this date covered no employees."
                />
              ) : (
                <AccrualsTable rows={rows} />
              )
            }
          </QueryBoundary>
        )}
      </QueryPanel>
    </div>
  );
}

function AccrualsTable({ rows }: { rows: GratuityAccrual[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Employee</TableHead>
          <TableHead className="text-right">Service</TableHead>
          <TableHead>Eligibility</TableHead>
          <TableHead className="text-right">Monthly wages</TableHead>
          <TableHead className="text-right">Accrued</TableHead>
          <TableHead className="w-24" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <EmployeeCell name={row.employee_name} code={row.employee_code} />
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatDays(row.service_years)} yrs
              <span className="block text-xs text-muted-foreground">{row.service_days} days</span>
            </TableCell>
            <TableCell>
              {row.is_eligible ? (
                <Badge variant="success">Eligible</Badge>
              ) : (
                <Badge variant="muted">Not yet eligible</Badge>
              )}
            </TableCell>
            <TableCell className="text-right">
              <Money value={row.monthly_wages} />
            </TableCell>
            <TableCell className="text-right">
              <Money value={row.eligible_amount} />
            </TableCell>
            <TableCell className="text-right">
              <WorkingButton
                title={`Accrual working · ${row.employee_name ?? ""}`}
                working={row.working}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
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
