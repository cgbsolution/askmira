"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { IndianRupee, Lock } from "lucide-react";
import React from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { DataTable } from "@/components/common/data-table/DataTable";
import { EmptyState } from "@/components/common/EmptyState";
import { Money } from "@/components/common/Money";
import { Badge } from "@/components/ui/badge";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { SalaryHistoryRow } from "@/lib/types/people";
import { formatDay } from "@/lib/utils";

const COLUMNS: ColumnDef<SalaryHistoryRow>[] = [
  {
    accessorKey: "effective_from",
    header: "Effective",
    meta: {
      text: (row) =>
        `${formatDay(row.effective_from, true)}${row.effective_to ? ` – ${formatDay(row.effective_to, true)}` : " (current)"}`,
    },
    cell: ({ row }) => (
      <span className="flex items-center gap-2">
        {formatDay(row.original.effective_from, true)}
        {row.original.effective_to ? (
          <span className="text-muted-foreground">– {formatDay(row.original.effective_to, true)}</span>
        ) : (
          <Badge variant="success">Current</Badge>
        )}
      </span>
    ),
  },
  {
    accessorKey: "ctc_annual",
    header: "Annual CTC",
    meta: { className: "text-right" },
    cell: ({ row }) => <Money value={row.original.ctc_annual} />,
  },
  {
    accessorKey: "revision_reason",
    header: "Reason",
    meta: { cellClassName: "text-muted-foreground" },
    cell: ({ row }) => row.original.revision_reason ?? "—",
  },
];

/**
 * The effective-dated salary series. Tier 1: every figure is payroll's own, as a string.
 *
 * On your own profile it reads your own series (`/payroll/my-salary`); the
 * per-employee endpoint is HR's.
 */
export function CompensationPanel({ employeeId, isSelf = false }: { employeeId: string; isSelf?: boolean }) {
  const { data, error, isLoading, reload } = useApiQuery<SalaryHistoryRow[]>(
    isSelf ? "/payroll/my-salary" : `/employees/${employeeId}/salary/history`,
  );

  if (error?.status === 403) {
    return (
      <DataPanel title="Compensation">
        <EmptyState
          icon={Lock}
          title="Compensation is not available to you here"
          description={error.detail}
        />
      </DataPanel>
    );
  }

  return (
    <DataTable
      title="Compensation history"
      description="Annual CTC by effective date, as payroll holds it."
      columns={COLUMNS}
      data={data ?? []}
      noun="revisions"
      exportName="compensation-history"
      searchPlaceholder="Search revisions"
      isLoading={isLoading}
      error={error?.detail}
      onRetry={reload}
      empty={{
        icon: IndianRupee,
        title: "No salary assigned",
        description: "A salary appears here once payroll assigns a structure and CTC.",
      }}
    />
  );
}
