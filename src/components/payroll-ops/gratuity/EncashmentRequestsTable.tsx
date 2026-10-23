"use client";

import type { ColumnDef } from "@tanstack/react-table";
import React from "react";

import { DataTable, type DataTableProps } from "@/components/common/data-table/DataTable";
import { Money } from "@/components/common/Money";
import { EmployeeCell } from "@/components/payroll-ops/loans/common";
import type { EncashmentRequest } from "@/lib/types/payroll-ops";
import { formatDay, formatDays } from "@/lib/utils";

import { ENCASHMENT_STATUS_LABEL, EncashmentStatusBadge, WorkingButton } from "./common";

const EMPLOYEE_COLUMN: ColumnDef<EncashmentRequest> = {
  accessorKey: "employee_name",
  header: "Employee",
  meta: { text: (row) => [row.employee_name, row.employee_code].filter(Boolean).join(" ") },
  cell: ({ row }) => (
    <EmployeeCell name={row.original.employee_name} code={row.original.employee_code} />
  ),
};

/**
 * Leave encashment requests, for HR (with the employee) or for the requester.
 *
 * "Days approved" is what the server allowed after capping by policy and
 * balance — shown next to what was asked for.
 *
 * Without a `title` it is a borderless table for a panel that draws its own
 * card; with one it is its own card. Other DataTable props pass through.
 */
export function EncashmentRequestsTable({
  rows,
  showEmployee = false,
  actions,
  ...table
}: {
  rows: EncashmentRequest[];
  showEmployee?: boolean;
  actions?: (row: EncashmentRequest) => React.ReactNode;
} & Omit<DataTableProps<EncashmentRequest, unknown>, "columns" | "data" | "actions">) {
  const columns: ColumnDef<EncashmentRequest>[] = [
    ...(showEmployee ? [EMPLOYEE_COLUMN] : []),
    {
      accessorKey: "leave_type_code",
      header: "Leave",
      meta: {
        cellClassName: "text-sm",
        text: (row) =>
          `${row.leave_type_code} · ${row.is_exit_encashment ? "On exit" : "In service"} · FY ${row.financial_year} · ${formatDay(row.created_at, true)}`,
      },
      cell: ({ row }) => (
        <>
          <span className="font-medium text-foreground">{row.original.leave_type_code}</span>
          <span className="block text-xs text-muted-foreground">
            {row.original.is_exit_encashment ? "On exit" : "In service"} · FY{" "}
            {row.original.financial_year} · {formatDay(row.original.created_at, true)}
          </span>
        </>
      ),
    },
    {
      accessorKey: "days_requested",
      header: "Days requested",
      sortingFn: "alphanumeric",
      meta: { className: "text-right", cellClassName: "tabular-nums" },
      cell: ({ row }) => formatDays(row.original.days_requested),
    },
    {
      accessorKey: "days_approved",
      header: "Days approved",
      sortingFn: "alphanumeric",
      meta: { className: "text-right", cellClassName: "tabular-nums" },
      cell: ({ row }) => formatDays(row.original.days_approved),
    },
    {
      accessorKey: "daily_rate",
      header: "Daily rate",
      sortingFn: "alphanumeric",
      meta: { className: "text-right" },
      cell: ({ row }) => <Money value={row.original.daily_rate} />,
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
      cell: ({ row }) => <Money value={row.original.taxable_amount} />,
    },
    {
      accessorKey: "status",
      header: "Status",
      meta: {
        text: (row) =>
          [ENCASHMENT_STATUS_LABEL[row.status], row.decision_note].filter(Boolean).join(" · "),
      },
      cell: ({ row }) => (
        <>
          <EncashmentStatusBadge status={row.original.status} />
          {row.original.decision_note && (
            <span className="mt-1 block max-w-48 text-xs text-muted-foreground italic">
              “{row.original.decision_note}”
            </span>
          )}
        </>
      ),
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      meta: { className: "text-right", headClassName: "w-48", text: false },
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <WorkingButton title="Encashment working" working={row.original.working} />
          {actions?.(row.original)}
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      noun="requests"
      exportName="encashment-requests"
      searchPlaceholder="Search requests"
      bordered={false}
      {...table}
    />
  );
}
