"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Download, Users } from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/data-table/DataTable";
import { Money } from "@/components/common/Money";
import { apiMessage, isZero } from "@/components/payroll/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useApiQuery } from "@/hooks/useApiQuery";
import { downloadFile } from "@/lib/api";
import type { RegisterRow, RunRegister } from "@/lib/types/payroll";
import { formatDays } from "@/lib/utils";

const MONEY_COLUMNS: { key: keyof RunRegister["rows"][number] & string; label: string }[] = [
  { key: "gross_earnings", label: "Gross" },
  { key: "other_earnings", label: "Other pay" },
  { key: "pf_employee", label: "PF" },
  { key: "esi_employee", label: "ESI" },
  { key: "professional_tax", label: "PT" },
  { key: "lwf_employee", label: "LWF" },
  { key: "tds", label: "TDS" },
  { key: "other_deductions", label: "Other deductions" },
  { key: "net_pay", label: "Net pay" },
  { key: "employer_cost", label: "Employer cost" },
];

/** Everyone on the run, with a drill-down to each payslip's full trace. */
export function RegisterPanel({ runId, version }: { runId: string; version: number }) {
  const { data, error, isLoading, reload } = useApiQuery<RunRegister>(
    `/payroll/runs/${runId}/register?v=${version}`,
  );
  const [downloading, setDownloading] = useState(false);
  const rows = data?.rows ?? [];

  const download = async () => {
    setDownloading(true);
    try {
      await downloadFile(`/payroll/runs/${runId}/register.csv`, "payroll-register.csv");
    } catch (caught) {
      toast.error(apiMessage(caught, "Could not download the register."));
    } finally {
      setDownloading(false);
    }
  };

  const columns: ColumnDef<RegisterRow>[] = [
    {
      accessorKey: "employee_name",
      header: "Employee",
      meta: { text: (row) => `${row.employee_name} ${row.employee_code}` },
      cell: ({ row }) => (
        <>
          <Link
            href={`/payroll/runs/${runId}/payslips/${row.original.payslip_id}`}
            className="font-medium text-foreground hover:underline"
          >
            {row.original.employee_name}
          </Link>
          <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            {row.original.employee_code}
            {row.original.has_variance && <Badge variant="warning">Variance</Badge>}
            {row.original.review_flags.length > 0 && <Badge variant="destructive">Review</Badge>}
            {row.original.skipped_recoveries > 0 && <Badge variant="muted">Recovery held</Badge>}
            {!isZero(row.original.not_employed_days) && (
              <Badge variant="muted">Not employed: {formatDays(row.original.not_employed_days)} days</Badge>
            )}
          </div>
        </>
      ),
      footer: () => <span className="font-semibold">Total</span>,
    },
    {
      accessorKey: "paid_days",
      header: "Paid days",
      meta: {
        className: "text-right",
        cellClassName: "tabular-nums",
        text: (row) => `${formatDays(row.paid_days)}/${formatDays(row.working_days)}`,
      },
      cell: ({ row }) => `${formatDays(row.original.paid_days)}/${formatDays(row.original.working_days)}`,
      footer: () => null,
    },
    ...MONEY_COLUMNS.map(
      (column): ColumnDef<RegisterRow> => ({
        id: column.key,
        header: column.label,
        accessorFn: (row) => String(row[column.key]),
        meta: { className: "text-right" },
        cell: ({ row }) => <Money value={String(row.original[column.key])} currency={false} />,
        footer: () =>
          data ? <Money value={data.totals[column.key]} currency={false} className="font-semibold" /> : null,
      }),
    ),
  ];

  return (
    <DataTable
      title="Register"
      description="Every payslip on this run. The download is recorded in the audit log."
      columns={columns}
      data={rows}
      getRowId={(row) => row.payslip_id}
      noun="payslips"
      // The register leaves only through the audited download below.
      exportName={false}
      searchPlaceholder="Search by name or code"
      actions={
        rows.length > 0 ? (
          <Button variant="outline" size="sm" disabled={downloading} onClick={() => void download()}>
            <Download /> CSV
          </Button>
        ) : undefined
      }
      isLoading={isLoading && !data}
      error={error?.detail}
      onRetry={reload}
      empty={{
        icon: Users,
        title: "No payslips yet",
        description: "Payslips appear here once the run is computed.",
      }}
    />
  );
}
