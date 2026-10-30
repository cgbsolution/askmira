"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ReceiptText } from "lucide-react";
import Link from "next/link";
import React from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { Money } from "@/components/common/Money";
import { PageShell } from "@/components/common/PageShell";
import { SalaryHistoryList } from "@/components/pay/SalaryHistoryList";
import { isImported, periodLabel, RUN_TYPE } from "@/components/payroll/labels";
import { ImportedBadge } from "@/components/payroll/RunStatusBadge";
import { DownloadButton } from "@/components/payroll-ops/shared";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { PayslipSummary, SalaryRecord } from "@/lib/types/payroll";
import { formatDate } from "@/lib/utils";

const PAYSLIP_COLUMNS: ColumnDef<PayslipSummary>[] = [
  {
    id: "month",
    header: "Month",
    // Sorts by period; searched and exported as the label shown.
    accessorFn: (slip) => slip.period_year * 100 + slip.period_month,
    meta: { text: (slip) => `${periodLabel(slip.period_year, slip.period_month)} ${RUN_TYPE[slip.run_type]}` },
    cell: ({ row }) => (
      <>
        <Link href={`/pay/payslips/${row.original.id}`} className="font-medium text-foreground hover:underline">
          {periodLabel(row.original.period_year, row.original.period_month)}
        </Link>
        <p className="text-xs text-muted-foreground">{RUN_TYPE[row.original.run_type]}</p>
      </>
    ),
  },
  {
    accessorKey: "gross_earnings",
    header: "Gross",
    meta: { className: "text-right" },
    cell: ({ row }) => <Money value={row.original.gross_earnings} />,
  },
  {
    accessorKey: "other_earnings",
    header: "Other pay",
    meta: { className: "text-right" },
    cell: ({ row }) => <Money value={row.original.other_earnings} />,
  },
  {
    accessorKey: "total_deductions",
    header: "Deductions",
    meta: { className: "text-right" },
    cell: ({ row }) => <Money value={row.original.total_deductions} />,
  },
  {
    accessorKey: "net_pay",
    header: "Net pay",
    meta: { className: "text-right", cellClassName: "font-semibold" },
    cell: ({ row }) => <Money value={row.original.net_pay} />,
  },
  {
    accessorKey: "published_at",
    header: "Published",
    // An imported month was paid on factoHR; the date it was imported is not when you got it.
    meta: {
      cellClassName: "text-sm text-muted-foreground",
      text: (slip) => (isImported(slip) ? "From factoHR" : formatDate(slip.published_at)),
    },
    cell: ({ row }) =>
      isImported(row.original) ? <ImportedBadge>From factoHR</ImportedBadge> : formatDate(row.original.published_at),
  },
  {
    id: "actions",
    header: "",
    enableHiding: false,
    meta: { className: "w-28 text-right", text: false },
    cell: ({ row }) => (
      <DownloadButton
        path={`/payroll/my-payslips/${row.original.id}/pdf`}
        fallbackName={`payslip-${row.original.period_year}-${String(row.original.period_month).padStart(2, "0")}.pdf`}
        label="PDF"
        variant="ghost"
      />
    ),
  },
];

/** An employee's own payslips and salary history. Only published payslips appear. */
export default function MyPayPage() {
  const { user } = useAuth();
  const linked = Boolean(user?.employee_id);
  const payslips = useApiQuery<PayslipSummary[]>(linked ? "/payroll/my-payslips" : null);
  const salary = useApiQuery<SalaryRecord[]>(linked ? "/payroll/my-salary" : null);
  const rows = payslips.data ?? [];

  return (
    <PageShell title="Payslips" description="Your payslips and salary history.">
      <DataTable
        title="Payslips"
        columns={PAYSLIP_COLUMNS}
        data={rows}
        noun="payslips"
        exportName="my-payslips"
        searchPlaceholder="Search by month or type"
        isLoading={payslips.isLoading && !payslips.data}
        error={payslips.error?.detail}
        onRetry={payslips.reload}
        empty={{
          icon: ReceiptText,
          title: linked ? "No payslips yet" : "Your login is not linked to an employee record",
          description: linked
            ? "A payslip appears here once payroll for the month is approved and published."
            : "Ask your admin to link your login to your employee record.",
        }}
      />
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
