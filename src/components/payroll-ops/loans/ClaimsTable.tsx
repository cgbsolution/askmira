"use client";

import type { ColumnDef } from "@tanstack/react-table";
import React from "react";

import { DataTable, type DataTableProps } from "@/components/common/data-table/DataTable";
import { Money } from "@/components/common/Money";
import { DownloadButton } from "@/components/payroll-ops/shared";
import type { ReimbursementClaim } from "@/lib/types/payroll-ops";
import { formatDay } from "@/lib/utils";

import { CLAIM_STATUS_LABEL, ClaimStatusBadge, EmployeeCell } from "./common";

const EMPLOYEE_COLUMN: ColumnDef<ReimbursementClaim> = {
  accessorKey: "employee_name",
  header: "Employee",
  meta: { text: (claim) => [claim.employee_name, claim.employee_code].filter(Boolean).join(" ") },
  cell: ({ row }) => (
    <EmployeeCell name={row.original.employee_name} code={row.original.employee_code} />
  ),
};

/**
 * Reimbursement claims, for HR (with the employee) or for the claimant.
 *
 * Without a `title` it is a borderless table for a panel that draws its own
 * card; with one it is its own card. Other DataTable props pass through.
 */
export function ClaimsTable({
  rows,
  showEmployee = false,
  actions,
  ...table
}: {
  rows: ReimbursementClaim[];
  showEmployee?: boolean;
  actions?: (claim: ReimbursementClaim) => React.ReactNode;
} & Omit<DataTableProps<ReimbursementClaim, unknown>, "columns" | "data" | "actions">) {
  const columns: ColumnDef<ReimbursementClaim>[] = [
    ...(showEmployee ? [EMPLOYEE_COLUMN] : []),
    {
      id: "component",
      header: "Component",
      accessorFn: (claim) => claim.component_name ?? claim.component_code,
      meta: { cellClassName: "font-medium text-foreground" },
    },
    {
      id: "bill",
      header: "Bill",
      accessorFn: (claim) => claim.bill_date,
      meta: {
        cellClassName: "text-sm text-muted-foreground",
        text: (claim) =>
          [claim.bill_date ? formatDay(claim.bill_date, true) : null, claim.bill_reference]
            .filter(Boolean)
            .join(" · "),
      },
      cell: ({ row }) => (
        <>
          {row.original.bill_date ? formatDay(row.original.bill_date, true) : "—"}
          {row.original.bill_reference && (
            <span className="block text-xs">{row.original.bill_reference}</span>
          )}
        </>
      ),
    },
    {
      accessorKey: "amount",
      header: "Claimed",
      sortingFn: "alphanumeric",
      meta: { className: "text-right" },
      cell: ({ row }) => <Money value={row.original.amount} />,
    },
    {
      accessorKey: "accepted_amount",
      header: "Accepted",
      sortingFn: "alphanumeric",
      meta: {
        className: "text-right",
        text: (claim) => (claim.status === "submitted" ? "Awaiting HR" : claim.accepted_amount),
      },
      cell: ({ row }) =>
        row.original.status === "submitted" ? (
          <span className="text-muted-foreground">Awaiting HR</span>
        ) : (
          <Money value={row.original.accepted_amount} />
        ),
    },
    {
      accessorKey: "status",
      header: "Status",
      meta: {
        text: (claim) =>
          [
            CLAIM_STATUS_LABEL[claim.status],
            claim.paid_period ? `Paid with ${claim.paid_period} payroll` : null,
            claim.verification_note,
          ]
            .filter(Boolean)
            .join(" · "),
      },
      cell: ({ row }) => (
        <>
          <ClaimStatusBadge status={row.original.status} />
          {row.original.paid_period && (
            <span className="mt-1 block text-xs text-muted-foreground">
              Paid with {row.original.paid_period} payroll
            </span>
          )}
          {row.original.verification_note && (
            <span className="mt-1 block max-w-56 text-xs text-muted-foreground italic">
              “{row.original.verification_note}”
            </span>
          )}
        </>
      ),
    },
    {
      accessorKey: "created_at",
      header: "Submitted",
      meta: {
        cellClassName: "whitespace-nowrap text-muted-foreground",
        text: (claim) => formatDay(claim.created_at, true),
      },
      cell: ({ row }) => formatDay(row.original.created_at, true),
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      meta: { className: "text-right", headClassName: "w-40", text: false },
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          {row.original.has_bill && (
            <DownloadButton
              path={`/reimbursements/claims/${row.original.id}/bill`}
              fallbackName={`bill-${row.original.id}`}
              label="Bill"
              variant="ghost"
            />
          )}
          {actions?.(row.original)}
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      noun="claims"
      exportName="reimbursement-claims"
      searchPlaceholder="Search claims"
      bordered={false}
      {...table}
    />
  );
}
