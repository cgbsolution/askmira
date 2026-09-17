"use client";

import { BookOpen, Download } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { FormField } from "@/components/common/FormField";
import { apiMessage, periodLabel } from "@/components/payroll/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import { downloadFile } from "@/lib/api";
import type { Page } from "@/lib/types";
import type { PayrollRun, RegisterFormat, RenderedRegister } from "@/lib/types/payroll";

const ANNUAL = "BONUS_FORM_C";

/** Prescribed statutory registers, assembled from payslips and bonus records. */
export function RegistersPanel() {
  const formats = useApiQuery<RegisterFormat[]>("/statutory/registers");
  const runs = useApiQuery<Page<PayrollRun>>("/payroll/runs?page_size=50");
  const [code, setCode] = useState("");
  const [runId, setRunId] = useState("");
  const [year, setYear] = useState("");

  const annual = code === ANNUAL;
  const scope = annual
    ? /^\d{4}-\d{4}$/.test(year)
      ? `financial_year=${year}`
      : null
    : runId
      ? `run_id=${runId}`
      : null;
  const register = useApiQuery<RenderedRegister>(
    code && scope ? `/statutory/registers/${code}?${scope}` : null,
  );
  const closedRuns = (runs.data?.items ?? []).filter((run) => run.status === "approved" || run.status === "paid");

  const download = async () => {
    if (!code || !scope) return;
    try {
      await downloadFile(`/statutory/registers/${code}?${scope}&export_format=csv`, `${code.toLowerCase()}.csv`);
    } catch (caught) {
      toast.error(apiMessage(caught, "Could not download the register."));
    }
  };

  const data = register.data;
  return (
    <DataPanel
      title={data?.title ?? "Statutory registers"}
      description={data ? data.prescribed_by : "Choose a register and the run or year it covers."}
      actions={
        data ? (
          <Button size="sm" variant="outline" onClick={() => void download()}>
            <Download /> CSV
          </Button>
        ) : undefined
      }
      toolbar={
        <div className="flex flex-wrap items-end gap-3">
          <FormField htmlFor="reg-code" label="Register">
            <Select value={code} onValueChange={setCode}>
              <SelectTrigger id="reg-code" className="w-72">
                <SelectValue placeholder="Choose a register" />
              </SelectTrigger>
              <SelectContent>
                {(formats.data ?? []).map((format) => (
                  <SelectItem key={format.code} value={format.code}>
                    {format.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          {code && annual && (
            <FormField htmlFor="reg-year" label="Financial year">
              <Input id="reg-year" className="w-32" placeholder="2025-2026" value={year} onChange={(e) => setYear(e.target.value)} />
            </FormField>
          )}
          {code && !annual && (
            <FormField htmlFor="reg-run" label="Payroll run">
              <Select value={runId} onValueChange={setRunId}>
                <SelectTrigger id="reg-run" className="w-56">
                  <SelectValue placeholder={closedRuns.length ? "Choose a run" : "No approved runs"} />
                </SelectTrigger>
                <SelectContent>
                  {closedRuns.map((run) => (
                    <SelectItem key={run.id} value={run.id}>
                      {periodLabel(run.period_year, run.period_month)} · {run.legal_entity_name ?? ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          )}
        </div>
      }
      isLoading={(formats.isLoading && !formats.data) || (register.isLoading && !register.data)}
      error={formats.error?.detail ?? register.error?.detail}
      onRetry={register.error ? register.reload : formats.reload}
      isEmpty={!data || data.row_count === 0}
      empty={{
        icon: BookOpen,
        title: data ? "Nothing to register" : "No register selected",
        description: data
          ? "No one on this run or year has an amount under this head."
          : "Monthly registers cover one approved run; Form C covers a financial year.",
      }}
    >
      {data && (
        <div className="space-y-2">
          <div className="px-5 pt-3 text-xs text-muted-foreground">
            {data.heading_lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {data.headings.map((heading) => (
                    <TableHead key={heading} className="max-w-48 whitespace-normal">
                      {heading}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row, index) => (
                  <TableRow key={index}>
                    {row.map((cell, cellIndex) => (
                      <TableCell key={cellIndex} className="tabular-nums">
                        {cell}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {(data.notes.length > 0 || data.excluded.length > 0) && (
            <div className="space-y-1 px-5 pb-3 text-xs text-muted-foreground">
              {data.notes.map((note) => (
                <p key={note}>{note}</p>
              ))}
              {data.excluded.length > 0 && <p>Not eligible, so not listed: {data.excluded.join(", ")}</p>}
            </div>
          )}
        </div>
      )}
    </DataPanel>
  );
}
