"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Wallet } from "lucide-react";
import React from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { PersonCell } from "@/components/common/PersonCell";
import { QueryBoundary, StatTile } from "@/components/expenses/ReviewCommon";
import { AdvanceStatusBadge, formatMoney } from "@/components/expenses/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { Advance, AdvanceStatus, AgeingReport } from "@/lib/types/expenses";
import { formatDay } from "@/lib/utils";

const BUCKETS: { key: keyof AgeingReport["buckets"]; label: string }[] = [
  { key: "0-30", label: "0–30 days" },
  { key: "31-45", label: "31–45 days" },
  { key: "46-90", label: "46–90 days" },
  { key: "over_90", label: "Over 90 days" },
];

/** One age bracket of the report, as a row of the ageing table. */
type BucketRow = {
  key: keyof AgeingReport["buckets"];
  label: string;
  count: number;
  amount: string | undefined;
};

const BUCKET_COLUMNS: ColumnDef<BucketRow>[] = [
  { accessorKey: "label", header: "Age" },
  {
    accessorKey: "count",
    header: "Advances",
    meta: { className: "text-right", cellClassName: "tabular-nums" },
  },
  {
    accessorKey: "amount",
    header: "Outstanding",
    meta: { className: "text-right", cellClassName: "tabular-nums" },
    cell: ({ row }) => formatMoney(row.original.amount),
  },
];

/** The status badge's words, for sorting, the search and the CSV. */
const STATUS_TEXT: Record<AdvanceStatus, string> = {
  issued: "Outstanding",
  settled: "Settled",
  cancelled: "Cancelled",
};

const ADVANCE_COLUMNS: ColumnDef<Advance>[] = [
  {
    id: "employee",
    header: "Employee",
    accessorFn: (advance) => advance.employee_name ?? "",
    meta: { text: (advance) => `${advance.employee_name ?? "—"} ${advance.employee_code ?? ""}`.trim() },
    cell: ({ row }) => (
      <PersonCell size="sm" name={row.original.employee_name ?? "—"} subtitle={row.original.employee_code} />
    ),
  },
  {
    id: "trip",
    header: "Trip",
    accessorFn: (advance) => advance.trip_purpose ?? "",
    meta: { cellClassName: "max-w-56 truncate" },
    cell: ({ row }) => row.original.trip_purpose ?? "—",
  },
  {
    accessorKey: "issued_on",
    header: "Issued",
    meta: { cellClassName: "whitespace-nowrap", text: (advance) => formatDay(advance.issued_on, true) },
    cell: ({ row }) => formatDay(row.original.issued_on, true),
  },
  {
    accessorKey: "amount",
    header: "Amount",
    // Decimal strings: compared digit group by digit group, so 9.00 sorts before 10.00.
    sortingFn: "alphanumeric",
    meta: { className: "text-right", cellClassName: "tabular-nums" },
    cell: ({ row }) => formatMoney(row.original.amount),
  },
  {
    accessorKey: "outstanding",
    header: "Outstanding",
    sortingFn: "alphanumeric",
    meta: { className: "text-right", cellClassName: "tabular-nums" },
    cell: ({ row }) => formatMoney(row.original.outstanding),
  },
  {
    accessorKey: "recovered_amount",
    header: "Recovered",
    sortingFn: "alphanumeric",
    meta: { className: "text-right", cellClassName: "tabular-nums" },
    cell: ({ row }) => formatMoney(row.original.recovered_amount),
  },
  {
    accessorKey: "refunded_amount",
    header: "Refunded",
    sortingFn: "alphanumeric",
    meta: { className: "text-right", cellClassName: "tabular-nums" },
    cell: ({ row }) => formatMoney(row.original.refunded_amount),
  },
  {
    accessorKey: "age_days",
    header: "Age",
    meta: { className: "text-right", cellClassName: "tabular-nums" },
    cell: ({ row }) => `${row.original.age_days}d`,
  },
  {
    id: "status",
    header: "Status",
    accessorFn: (advance) => STATUS_TEXT[advance.status],
    meta: {
      text: (advance) =>
        [
          STATUS_TEXT[advance.status],
          advance.is_blocking && "Blocking",
          advance.payroll_recovery_ref && `Payroll recovery ${advance.payroll_recovery_ref}`,
        ]
          .filter(Boolean)
          .join(" · "),
    },
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        <AdvanceStatusBadge status={row.original.status} />
        {row.original.is_blocking && <Badge variant="destructive">Blocking</Badge>}
        {row.original.payroll_recovery_ref && (
          <Badge variant="outline">Payroll recovery {row.original.payroll_recovery_ref}</Badge>
        )}
      </div>
    ),
  },
];

/** Outstanding advances by age, and every advance on record. */
export function ReviewAgeing() {
  const ageing = useApiQuery<AgeingReport>("/expenses/advances/ageing");
  const advances = useApiQuery<Advance[]>("/expenses/advances?scope=all");

  return (
    <div className="grid gap-6">
      <Card tier="tier1">
        <CardHeader>
          <CardTitle>Ageing</CardTitle>
          <CardDescription>
            {ageing.data
              ? `As of ${formatDay(ageing.data.as_of, true)}. An advance unsettled beyond ${ageing.data.block_after_days} days blocks a new one.`
              : "Outstanding advances by how long they have been open."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <QueryBoundary query={ageing}>
            {(report) => (
              <div className="grid gap-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <StatTile label="Total outstanding" value={formatMoney(report.total_outstanding)} />
                  <StatTile
                    label="Blocking a new advance"
                    tone={report.blocking_count > 0 ? "destructive" : "default"}
                    value={report.blocking_count}
                  />
                </div>
                <DataTable
                  variant="plain"
                  columns={BUCKET_COLUMNS}
                  data={BUCKETS.map((bucket) => {
                    const row = report.buckets[bucket.key];
                    return { ...bucket, count: row?.count ?? 0, amount: row?.amount };
                  })}
                  getRowId={(row) => row.key}
                />
              </div>
            )}
          </QueryBoundary>
        </CardContent>
      </Card>

      <DataTable
        title="All advances"
        description="Every advance issued, settled or cancelled."
        tier="tier1"
        columns={ADVANCE_COLUMNS}
        data={advances.data ?? []}
        noun="advances"
        exportName="travel-advances"
        searchPlaceholder="Search by employee or trip"
        isLoading={advances.isLoading && !advances.data}
        error={advances.error?.detail}
        onRetry={advances.reload}
        empty={{
          icon: Wallet,
          title: "No advances yet",
          description: "Advances appear here once finance issues one against an approved trip.",
        }}
      />
    </div>
  );
}
