"use client";

import { Download, Users } from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { Money } from "@/components/common/Money";
import { apiMessage, isZero } from "@/components/payroll/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import { downloadFile } from "@/lib/api";
import type { RunRegister } from "@/lib/types/payroll";
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

  return (
    <DataPanel
      title="Register"
      description="Every payslip on this run. The download is recorded in the audit log."
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
      isEmpty={rows.length === 0}
      empty={{
        icon: Users,
        title: "No payslips yet",
        description: "Payslips appear here once the run is computed.",
      }}
    >
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead className="text-right">Paid days</TableHead>
              {MONEY_COLUMNS.map((column) => (
                <TableHead key={column.key} className="text-right">
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.payslip_id}>
                <TableCell>
                  <Link
                    href={`/payroll/runs/${runId}/payslips/${row.payslip_id}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    {row.employee_name}
                  </Link>
                  <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                    {row.employee_code}
                    {row.has_variance && <Badge variant="warning">Variance</Badge>}
                    {row.review_flags.length > 0 && <Badge variant="destructive">Review</Badge>}
                    {row.skipped_recoveries > 0 && <Badge variant="muted">Recovery held</Badge>}
                    {!isZero(row.not_employed_days) && (
                      <Badge variant="muted">Not employed: {formatDays(row.not_employed_days)} days</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatDays(row.paid_days)}/{formatDays(row.working_days)}
                </TableCell>
                {MONEY_COLUMNS.map((column) => (
                  <TableCell key={column.key} className="text-right">
                    <Money value={String(row[column.key])} currency={false} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
          {data && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-semibold">
                  Total
                </TableCell>
                {MONEY_COLUMNS.map((column) => (
                  <TableCell key={column.key} className="text-right font-semibold">
                    <Money value={data.totals[column.key]} currency={false} />
                  </TableCell>
                ))}
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </DataPanel>
  );
}
