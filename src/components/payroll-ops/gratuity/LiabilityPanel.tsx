"use client";

import { AlertTriangle, Building2, CheckCircle2, LineChart, Timer } from "lucide-react";
import React from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { EmptyState } from "@/components/common/EmptyState";
import { Money } from "@/components/common/Money";
import { InlineProblem, QueryBoundary } from "@/components/payroll-ops/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { GratuityLiability } from "@/lib/types/payroll-ops";
import { formatDay } from "@/lib/utils";

import { AccrualDateSelect, useAccrualDates } from "./AccrualDatePicker";

/** Accrued gratuity liability on a date, and how it breaks down. */
export function LiabilityPanel() {
  const { dates, asOf, setAsOf } = useAccrualDates();
  const liability = useApiQuery<GratuityLiability>(
    asOf ? `/gratuity/liability?as_of=${encodeURIComponent(asOf)}` : null,
  );

  return (
    <QueryBoundary query={dates} skeletonRows={4}>
      {(available) =>
        available.length === 0 ? (
          <Card tier="tier1">
            <EmptyState
              icon={LineChart}
              title="No accrual has been run yet"
              description="Liability is the sum of individual accruals. Run an accrual from the Accruals tab once the gratuity configuration is approved."
            />
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <AccrualDateSelect dates={available} value={asOf} onChange={setAsOf} />
              {liability.data &&
                liability.data.as_of === asOf &&
                (liability.data.reconciles ? (
                  <Badge variant="success">
                    <CheckCircle2 /> Ties out to individual accruals
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <AlertTriangle /> Does not tie out to individual accruals
                  </Badge>
                ))}
            </div>
            <QueryBoundary query={liability} skeletonRows={5}>
              {(data) => <LiabilityView data={data} />}
            </QueryBoundary>
          </div>
        )
      }
    </QueryBoundary>
  );
}

function LiabilityView({ data }: { data: GratuityLiability }) {
  return (
    <div className="space-y-4">
      {!data.reconciles && (
        <InlineProblem>
          The department and tenure breakdowns do not add up to the total of individual accruals as
          of {formatDay(data.as_of, true)}. Do not report this liability until it has been checked.
        </InlineProblem>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total accrued liability" value={<Money value={data.total_accrued_liability} />} />
        <Stat
          label="Eligible now"
          value={<Money value={data.eligible_liability} />}
          hint="Employees past the service needed to be paid gratuity"
        />
        <Stat
          label="Not yet eligible"
          value={<Money value={data.not_yet_eligible_liability} />}
          hint="Accrued, but payable only once service is completed"
        />
        <Stat label="Employees" value={<span className="tabular-nums">{data.employee_count}</span>} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DataPanel
          title="By department"
          isEmpty={data.by_department.length === 0}
          empty={{ icon: Building2, title: "No department breakdown was returned" }}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department</TableHead>
                <TableHead className="text-right">Employees</TableHead>
                <TableHead className="text-right">Accrued</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.by_department.map((row) => (
                <TableRow key={row.department_id}>
                  <TableCell>{row.department_name}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.employee_count}</TableCell>
                  <TableCell className="text-right">
                    <Money value={row.accrued_liability} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataPanel>

        <DataPanel
          title="By tenure band"
          description="Completed years of service."
          isEmpty={data.by_tenure_band.length === 0}
          empty={{ icon: Timer, title: "No tenure breakdown was returned" }}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Band</TableHead>
                <TableHead className="text-right">Accrued</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.by_tenure_band.map((row) => (
                <TableRow key={row.band}>
                  <TableCell>{row.band}</TableCell>
                  <TableCell className="text-right">
                    <Money value={row.accrued_liability} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataPanel>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Card tier="tier1" className="gap-1 py-4">
      <CardContent className="px-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground tabular-nums">
          {value}
        </p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
