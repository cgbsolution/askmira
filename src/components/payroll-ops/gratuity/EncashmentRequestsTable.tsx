"use client";

import React from "react";

import { Money } from "@/components/common/Money";
import { EmployeeCell } from "@/components/payroll-ops/loans/common";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { EncashmentRequest } from "@/lib/types/payroll-ops";
import { formatDay, formatDays } from "@/lib/utils";

import { EncashmentStatusBadge, WorkingButton } from "./common";

/**
 * Leave encashment requests, for HR (with the employee) or for the requester.
 *
 * "Days approved" is what the server allowed after capping by policy and
 * balance — shown next to what was asked for.
 */
export function EncashmentRequestsTable({
  rows,
  showEmployee = false,
  actions,
}: {
  rows: EncashmentRequest[];
  showEmployee?: boolean;
  actions?: (row: EncashmentRequest) => React.ReactNode;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {showEmployee && <TableHead>Employee</TableHead>}
          <TableHead>Leave</TableHead>
          <TableHead className="text-right">Days requested</TableHead>
          <TableHead className="text-right">Days approved</TableHead>
          <TableHead className="text-right">Daily rate</TableHead>
          <TableHead className="text-right">Gross</TableHead>
          <TableHead className="text-right">Exempt</TableHead>
          <TableHead className="text-right">Taxable</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-48" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            {showEmployee && (
              <TableCell>
                <EmployeeCell name={row.employee_name} code={row.employee_code} />
              </TableCell>
            )}
            <TableCell className="text-sm">
              <span className="font-medium text-foreground">{row.leave_type_code}</span>
              <span className="block text-xs text-muted-foreground">
                {row.is_exit_encashment ? "On exit" : "In service"} · FY {row.financial_year} ·{" "}
                {formatDay(row.created_at, true)}
              </span>
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatDays(row.days_requested)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatDays(row.days_approved)}</TableCell>
            <TableCell className="text-right">
              <Money value={row.daily_rate} />
            </TableCell>
            <TableCell className="text-right">
              <Money value={row.gross_amount} />
            </TableCell>
            <TableCell className="text-right">
              <Money value={row.exempt_amount} />
            </TableCell>
            <TableCell className="text-right">
              <Money value={row.taxable_amount} />
            </TableCell>
            <TableCell>
              <EncashmentStatusBadge status={row.status} />
              {row.decision_note && (
                <span className="mt-1 block max-w-48 text-xs text-muted-foreground italic">
                  “{row.decision_note}”
                </span>
              )}
            </TableCell>
            <TableCell>
              <div className="flex justify-end gap-1">
                <WorkingButton title="Encashment working" working={row.working} />
                {actions?.(row)}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
