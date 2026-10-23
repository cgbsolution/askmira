"use client";

import type { ColumnDef } from "@tanstack/react-table";
import React from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { Money } from "@/components/common/Money";
import { Button } from "@/components/ui/button";
import type { LoanAccount } from "@/lib/types/payroll-ops";
import { formatDate } from "@/lib/utils";

import { EmployeeCell, LOAN_STATUS_LABEL, LoanStatusBadge } from "./common";

const EMPLOYEE_COLUMN: ColumnDef<LoanAccount> = {
  accessorKey: "employee_name",
  header: "Employee",
  meta: { text: (loan) => [loan.employee_name, loan.employee_code].filter(Boolean).join(" ") },
  cell: ({ row }) => <EmployeeCell name={row.original.employee_name} code={row.original.employee_code} />,
};

/** Loan accounts, for HR (with the employee) or for the borrower. */
export function LoansTable({
  rows,
  showEmployee = false,
  onOpen,
}: {
  rows: LoanAccount[];
  showEmployee?: boolean;
  onOpen: (loan: LoanAccount) => void;
}) {
  const columns: ColumnDef<LoanAccount>[] = [
    ...(showEmployee ? [EMPLOYEE_COLUMN] : []),
    {
      accessorKey: "scheme_name",
      header: "Scheme",
      cell: ({ row }) => (
        <>
          <span className="font-medium text-foreground">{row.original.scheme_name ?? "—"}</span>
          {row.original.status === "rejected" && row.original.decision_note && (
            <span className="block max-w-64 text-xs text-muted-foreground italic">
              “{row.original.decision_note}”
            </span>
          )}
        </>
      ),
    },
    {
      accessorKey: "principal",
      header: "Principal",
      sortingFn: "alphanumeric",
      meta: { className: "text-right" },
      cell: ({ row }) => <Money value={row.original.principal} />,
    },
    {
      accessorKey: "emi_amount",
      header: "EMI",
      sortingFn: "alphanumeric",
      meta: { className: "text-right" },
      cell: ({ row }) => <Money value={row.original.emi_amount} />,
    },
    {
      accessorKey: "outstanding_principal",
      header: "Outstanding",
      sortingFn: "alphanumeric",
      meta: { className: "text-right" },
      cell: ({ row }) => <Money value={row.original.outstanding_principal} />,
    },
    {
      accessorKey: "tenure_months",
      header: "Tenure",
      meta: { className: "text-right", cellClassName: "tabular-nums" },
      cell: ({ row }) => `${row.original.tenure_months} mo`,
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (loan) => LOAN_STATUS_LABEL[loan.status],
      cell: ({ row }) => <LoanStatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "applied_at",
      header: "Applied",
      meta: {
        cellClassName: "whitespace-nowrap text-muted-foreground",
        text: (loan) => formatDate(loan.applied_at),
      },
      cell: ({ row }) => formatDate(row.original.applied_at),
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      meta: { className: "text-right", headClassName: "w-20", text: false },
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" onClick={() => onOpen(row.original)}>
          {showEmployee && (row.original.status === "applied" || row.original.status === "approved")
            ? "Review"
            : "View"}
        </Button>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      noun="loans"
      exportName={showEmployee ? "loans" : "my-loans"}
      searchPlaceholder="Search loans"
      bordered={false}
    />
  );
}
