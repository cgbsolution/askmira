"use client";

import { ChevronDown, Download, Loader2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { apiMessage } from "@/components/payroll/labels";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadFile } from "@/lib/api";
import type { PayrollRun } from "@/lib/types/payroll";

export type RegisterFormat = "xlsx" | "csv";

const FILE_NAME: Record<RegisterFormat, string> = {
  xlsx: "salary-register.xlsx",
  csv: "payroll-register.csv",
};

/** Download one run's register. The server names the file and records the download. */
export async function downloadRegister(runId: string, format: RegisterFormat): Promise<void> {
  try {
    await downloadFile(`/payroll/runs/${runId}/register.${format}`, FILE_NAME[format]);
  } catch (caught) {
    toast.error(apiMessage(caught, "Could not download the register."));
  }
}

/**
 * The month's payroll data: the salary register in Excel (every wage type,
 * deduction and net pay per person) or the summary CSV. Shown once the run
 * has payslips — before locking too, so HR can check the numbers first.
 */
export function RegisterDownloadMenu({
  run,
  size = "default",
}: {
  run: Pick<PayrollRun, "id" | "employee_count">;
  size?: "default" | "sm";
}) {
  const [busy, setBusy] = useState<RegisterFormat | null>(null);
  if (run.employee_count === 0) return null;

  const download = async (format: RegisterFormat) => {
    setBusy(format);
    try {
      await downloadRegister(run.id, format);
    } finally {
      setBusy(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={size} disabled={busy !== null}>
          {busy ? <Loader2 className="animate-spin" /> : <Download />}
          Download
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>This month&apos;s payroll data</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => void download("xlsx")}>
          Salary register (Excel)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void download("csv")}>Register summary (CSV)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
