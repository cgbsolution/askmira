"use client";

import { ReceiptText } from "lucide-react";
import Link from "next/link";
import React from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { Money } from "@/components/common/Money";
import { PageShell } from "@/components/common/PageShell";
import { SalaryHistoryList } from "@/components/pay/SalaryHistoryList";
import { periodLabel, RUN_TYPE } from "@/components/payroll/labels";
import { DownloadButton } from "@/components/payroll-ops/shared";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { PayslipSummary, SalaryRecord } from "@/lib/types/payroll";
import { formatDate } from "@/lib/utils";

/** An employee's own payslips and salary history. Only published payslips appear. */
export default function MyPayPage() {
  const { user } = useAuth();
  const linked = Boolean(user?.employee_id);
  const payslips = useApiQuery<PayslipSummary[]>(linked ? "/payroll/my-payslips" : null);
  const salary = useApiQuery<SalaryRecord[]>(linked ? "/payroll/my-salary" : null);
  const rows = payslips.data ?? [];

  return (
    <PageShell title="Payslips" description="Your payslips and salary history.">
      <DataPanel
        title="Payslips"
        isLoading={payslips.isLoading && !payslips.data}
        error={payslips.error?.detail}
        onRetry={payslips.reload}
        isEmpty={!linked || rows.length === 0}
        empty={{
          icon: ReceiptText,
          title: linked ? "No payslips yet" : "Your login is not linked to an employee record",
          description: linked
            ? "A payslip appears here once payroll for the month is approved and published."
            : "Ask your HR admin to link your login to your employee record.",
        }}
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Other pay</TableHead>
                <TableHead className="text-right">Deductions</TableHead>
                <TableHead className="text-right">Net pay</TableHead>
                <TableHead>Published</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((slip) => (
                <TableRow key={slip.id}>
                  <TableCell>
                    <Link href={`/pay/payslips/${slip.id}`} className="font-medium text-foreground hover:underline">
                      {periodLabel(slip.period_year, slip.period_month)}
                    </Link>
                    <p className="text-xs text-muted-foreground">{RUN_TYPE[slip.run_type]}</p>
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={slip.gross_earnings} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={slip.other_earnings} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={slip.total_deductions} />
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    <Money value={slip.net_pay} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(slip.published_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DownloadButton
                      path={`/payroll/my-payslips/${slip.id}/pdf`}
                      fallbackName={`payslip-${slip.period_year}-${String(slip.period_month).padStart(2, "0")}.pdf`}
                      label="PDF"
                      variant="ghost"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DataPanel>
      {linked && (
        <SalaryHistoryList
          title="Your salary history"
          rows={salary.data ?? []}
          isLoading={salary.isLoading && !salary.data}
          error={salary.error?.detail}
          onRetry={salary.reload}
        />
      )}
    </PageShell>
  );
}
