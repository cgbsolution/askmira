"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, Building2, CheckCircle2, LineChart, Timer } from "lucide-react";
import React from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { EmptyState } from "@/components/common/EmptyState";
import { Money } from "@/components/common/Money";
import { InlineProblem, QueryBoundary } from "@/components/payroll-ops/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { GratuityLiability } from "@/lib/types/payroll-ops";
import { formatDay } from "@/lib/utils";

import { AccrualDateSelect, useAccrualDates } from "./AccrualDatePicker";

type DepartmentRow = GratuityLiability["by_department"][number];
type TenureBandRow = GratuityLiability["by_tenure_band"][number];

const DEPARTMENT_COLUMNS: ColumnDef<DepartmentRow>[] = [
  { accessorKey: "department_name", header: "Department" },
  {
    accessorKey: "employee_count",
    header: "Employees",
    meta: { className: "text-right", cellClassName: "tabular-nums" },
  },
  {
    accessorKey: "accrued_liability",
    header: "Accrued",
    sortingFn: "alphanumeric",
    meta: { className: "text-right" },
    cell: ({ row }) => <Money value={row.original.accrued_liability} />,
  },
];

const TENURE_BAND_COLUMNS: ColumnDef<TenureBandRow>[] = [
  // By the years in the label: "5-10 years" before "10+ years", not after it.
  { accessorKey: "band", header: "Band", sortingFn: "alphanumeric" },
  {
    accessorKey: "accrued_liability",
    header: "Accrued",
    sortingFn: "alphanumeric",
    meta: { className: "text-right" },
    cell: ({ row }) => <Money value={row.original.accrued_liability} />,
  },
];

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
        <DataTable
          title="By department"
          columns={DEPARTMENT_COLUMNS}
          data={data.by_department}
          getRowId={(row) => row.department_id}
          noun="departments"
          exportName={`gratuity-liability-by-department-${data.as_of}`}
          searchPlaceholder="Search departments"
          empty={{ icon: Building2, title: "No department breakdown was returned" }}
        />

        <DataTable
          title="By tenure band"
          description="Completed years of service."
          columns={TENURE_BAND_COLUMNS}
          data={data.by_tenure_band}
          getRowId={(row) => row.band}
          noun="tenure bands"
          exportName={`gratuity-liability-by-tenure-band-${data.as_of}`}
          searchPlaceholder="Search bands"
          empty={{ icon: Timer, title: "No tenure breakdown was returned" }}
        />
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
