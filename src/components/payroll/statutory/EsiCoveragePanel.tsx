"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ShieldCheck } from "lucide-react";
import React from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { Money } from "@/components/common/Money";
import { MONTHS } from "@/components/payroll/labels";
import { useEmployeeNames } from "@/components/payroll/useEmployeeNames";
import { Badge } from "@/components/ui/badge";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { EsiCoverage } from "@/lib/types/payroll";
import { formatDay } from "@/lib/utils";

/** The period's label and the months it spans. */
function periodText(row: EsiCoverage): string {
  return `${row.period_label} (${MONTHS[row.period_start_month - 1]} – ${MONTHS[row.period_end_month - 1]})`;
}

/**
 * ESI coverage as recorded when each contribution period opened. It is why an
 * employee who crossed the ceiling mid-period still contributes to its end.
 */
export function EsiCoveragePanel() {
  const { data, error, isLoading, reload } = useApiQuery<EsiCoverage[]>("/statutory/esi-coverage");
  const nameOf = useEmployeeNames();
  const columns: ColumnDef<EsiCoverage>[] = [
    {
      id: "employee",
      header: "Employee",
      accessorFn: (row) => nameOf(row.employee_id),
    },
    {
      accessorKey: "period_label",
      header: "Period",
      meta: { cellClassName: "text-sm", text: periodText },
      cell: ({ row }) => periodText(row.original),
    },
    {
      accessorKey: "was_contributing_at_start",
      header: "At the start",
      meta: { text: (row) => (row.was_contributing_at_start ? "Contributing" : "Not covered") },
      cell: ({ row }) => (
        <Badge variant={row.original.was_contributing_at_start ? "success" : "muted"}>
          {row.original.was_contributing_at_start ? "Contributing" : "Not covered"}
        </Badge>
      ),
    },
    {
      accessorKey: "opening_wage",
      header: "Opening wage",
      sortingFn: "alphanumeric",
      meta: { className: "text-right" },
      cell: ({ row }) => <Money value={row.original.opening_wage} />,
    },
    {
      accessorKey: "ceiling_crossed_on",
      header: "Crossed the ceiling",
      // Not "auto": it compares a missing date inconsistently against a present one.
      sortingFn: "alphanumeric",
      meta: {
        cellClassName: "text-sm",
        text: (row) => (row.ceiling_crossed_on ? formatDay(row.ceiling_crossed_on, true) : null),
      },
      cell: ({ row }) => (row.original.ceiling_crossed_on ? formatDay(row.original.ceiling_crossed_on, true) : "—"),
    },
  ];

  return (
    <DataTable
      title="ESI coverage"
      description="Recorded by payroll when a contribution period opens."
      columns={columns}
      data={data ?? []}
      noun="coverage periods"
      exportName="esi-coverage"
      searchPlaceholder="Search employees or periods"
      isLoading={isLoading && !data}
      error={error?.detail}
      onRetry={reload}
      empty={{
        icon: ShieldCheck,
        title: "No coverage periods recorded",
        description: "A period is recorded the first time a run computes its opening month with an ESI rule set in force.",
      }}
    />
  );
}
