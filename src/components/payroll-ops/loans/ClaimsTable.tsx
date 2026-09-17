"use client";

import React from "react";

import { Money } from "@/components/common/Money";
import { DownloadButton } from "@/components/payroll-ops/shared";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ReimbursementClaim } from "@/lib/types/payroll-ops";
import { formatDay } from "@/lib/utils";

import { ClaimStatusBadge, EmployeeCell } from "./common";

/** Reimbursement claims, for HR (with the employee) or for the claimant. */
export function ClaimsTable({
  rows,
  showEmployee = false,
  actions,
}: {
  rows: ReimbursementClaim[];
  showEmployee?: boolean;
  actions?: (claim: ReimbursementClaim) => React.ReactNode;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {showEmployee && <TableHead>Employee</TableHead>}
          <TableHead>Component</TableHead>
          <TableHead>Bill</TableHead>
          <TableHead className="text-right">Claimed</TableHead>
          <TableHead className="text-right">Accepted</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Submitted</TableHead>
          <TableHead className="w-40" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((claim) => (
          <TableRow key={claim.id}>
            {showEmployee && (
              <TableCell>
                <EmployeeCell name={claim.employee_name} code={claim.employee_code} />
              </TableCell>
            )}
            <TableCell className="font-medium text-foreground">
              {claim.component_name ?? claim.component_code}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {claim.bill_date ? formatDay(claim.bill_date, true) : "—"}
              {claim.bill_reference && <span className="block text-xs">{claim.bill_reference}</span>}
            </TableCell>
            <TableCell className="text-right">
              <Money value={claim.amount} />
            </TableCell>
            <TableCell className="text-right">
              {claim.status === "submitted" ? (
                <span className="text-muted-foreground">Awaiting HR</span>
              ) : (
                <Money value={claim.accepted_amount} />
              )}
            </TableCell>
            <TableCell>
              <ClaimStatusBadge status={claim.status} />
              {claim.verification_note && (
                <span className="mt-1 block max-w-56 text-xs text-muted-foreground italic">
                  “{claim.verification_note}”
                </span>
              )}
            </TableCell>
            <TableCell className="whitespace-nowrap text-muted-foreground">
              {formatDay(claim.created_at, true)}
            </TableCell>
            <TableCell>
              <div className="flex justify-end gap-2">
                {claim.has_bill && (
                  <DownloadButton
                    path={`/reimbursements/claims/${claim.id}/bill`}
                    fallbackName={`bill-${claim.id}`}
                    label="Bill"
                    variant="ghost"
                  />
                )}
                {actions?.(claim)}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
