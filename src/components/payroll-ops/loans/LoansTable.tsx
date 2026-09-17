"use client";

import React from "react";

import { Money } from "@/components/common/Money";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LoanAccount } from "@/lib/types/payroll-ops";
import { formatDate } from "@/lib/utils";

import { EmployeeCell, LoanStatusBadge } from "./common";

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
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {showEmployee && <TableHead>Employee</TableHead>}
          <TableHead>Scheme</TableHead>
          <TableHead className="text-right">Principal</TableHead>
          <TableHead className="text-right">EMI</TableHead>
          <TableHead className="text-right">Outstanding</TableHead>
          <TableHead className="text-right">Tenure</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Applied</TableHead>
          <TableHead className="w-20" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((loan) => (
          <TableRow key={loan.id}>
            {showEmployee && (
              <TableCell>
                <EmployeeCell name={loan.employee_name} code={loan.employee_code} />
              </TableCell>
            )}
            <TableCell>
              <span className="font-medium text-foreground">{loan.scheme_name ?? "—"}</span>
              {loan.status === "rejected" && loan.decision_note && (
                <span className="block max-w-64 text-xs text-muted-foreground italic">
                  “{loan.decision_note}”
                </span>
              )}
            </TableCell>
            <TableCell className="text-right">
              <Money value={loan.principal} />
            </TableCell>
            <TableCell className="text-right">
              <Money value={loan.emi_amount} />
            </TableCell>
            <TableCell className="text-right">
              <Money value={loan.outstanding_principal} />
            </TableCell>
            <TableCell className="text-right tabular-nums">{loan.tenure_months} mo</TableCell>
            <TableCell>
              <LoanStatusBadge status={loan.status} />
            </TableCell>
            <TableCell className="whitespace-nowrap text-muted-foreground">
              {formatDate(loan.applied_at)}
            </TableCell>
            <TableCell className="text-right">
              <Button variant="ghost" size="sm" onClick={() => onOpen(loan)}>
                {showEmployee && (loan.status === "applied" || loan.status === "approved")
                  ? "Review"
                  : "View"}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
