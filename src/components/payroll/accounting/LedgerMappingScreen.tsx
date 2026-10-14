"use client";

import { BookOpen, Loader2, Save } from "lucide-react";
import { useSearchParams } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { apiMessage, periodLabel, RUN_TYPE } from "@/components/payroll/labels";
import { Badge } from "@/components/ui/badge";
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
import { put } from "@/lib/api";
import type { Page } from "@/lib/types";
import type { PayrollRun } from "@/lib/types/payroll";

interface MappingRow {
  line_code: string;
  name: string;
  nature: "earning" | "deduction" | "employer_contribution" | "net_pay";
  debit_ledger: string | null;
  credit_ledger: string | null;
  complete: boolean;
  used_by_run: boolean;
}

const NATURE_LABEL: Record<MappingRow["nature"], string> = {
  earning: "Earning — expense",
  deduction: "Deduction — liability",
  employer_contribution: "Employer cost — expense and liability",
  net_pay: "Net pay — salary payable",
};

const NONE = "__none__";

/** Which ledger each payslip line posts to, so a run exports as a balanced journal. */
export function LedgerMappingScreen() {
  const params = useSearchParams();
  const [runId, setRunId] = useState(params.get("run") ?? NONE);
  const runs = useApiQuery<Page<PayrollRun>>("/payroll/runs?page_size=50");
  const approved = (runs.data?.items ?? []).filter(
    (run) => run.status === "approved" || run.status === "paid",
  );
  const query = useApiQuery<MappingRow[]>(
    `/payroll/ledger-mappings${runId === NONE ? "" : `?run_id=${runId}`}`,
  );
  const [draft, setDraft] = useState<Record<string, { debit: string; credit: string }>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const next: Record<string, { debit: string; credit: string }> = {};
    for (const row of query.data ?? []) {
      next[row.line_code] = { debit: row.debit_ledger ?? "", credit: row.credit_ledger ?? "" };
    }
    setDraft(next);
  }, [query.data]);

  const rows = useMemo(() => query.data ?? [], [query.data]);
  const incomplete = rows.filter((row) => {
    const value = draft[row.line_code] ?? { debit: "", credit: "" };
    const needsDebit = row.nature === "earning" || row.nature === "employer_contribution";
    const needsCredit = row.nature !== "earning";
    return (needsDebit && !value.debit.trim()) || (needsCredit && !value.credit.trim());
  }).length;

  const save = async () => {
    setIsSaving(true);
    try {
      await put("/payroll/ledger-mappings", {
        mappings: rows.map((row) => ({
          line_code: row.line_code,
          nature: row.nature,
          debit_ledger: draft[row.line_code]?.debit.trim() || null,
          credit_ledger: draft[row.line_code]?.credit.trim() || null,
        })),
      });
      toast.success("Ledger mapping saved.");
      query.reload();
    } catch (caught) {
      toast.error(apiMessage(caught, "Could not save the mapping."));
    } finally {
      setIsSaving(false);
    }
  };

  const set = (code: string, side: "debit" | "credit", value: string) =>
    setDraft((current) => ({
      ...current,
      [code]: { ...(current[code] ?? { debit: "", credit: "" }), [side]: value },
    }));

  return (
    <DataPanel
      title="Ledger mapping"
      description="Type each ledger exactly as it is named in your books. An export with an unmapped line is refused rather than posting to a ledger that does not exist."
      actions={
        <Button disabled={isSaving || rows.length === 0} onClick={() => void save()}>
          {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
          Save mapping
        </Button>
      }
      toolbar={
        <>
          <Select value={runId} onValueChange={setRunId}>
            <SelectTrigger size="sm" className="w-72" aria-label="Show the lines a run posts">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Mapped lines only</SelectItem>
              {approved.map((run) => (
                <SelectItem key={run.id} value={run.id}>
                  Lines used by {periodLabel(run.period_year, run.period_month)} (
                  {RUN_TYPE[run.run_type].toLowerCase()})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {incomplete > 0 && (
            <span className="text-sm text-muted-foreground">{incomplete} still to map</span>
          )}
        </>
      }
      isLoading={query.isLoading}
      error={query.error?.detail}
      onRetry={query.reload}
      isEmpty={rows.length === 0}
      empty={{
        icon: BookOpen,
        title: "Nothing mapped yet",
        description: "Choose an approved run above to list the payslip lines it posts.",
      }}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Payslip line</TableHead>
            <TableHead>Posts as</TableHead>
            <TableHead>Debit ledger</TableHead>
            <TableHead>Credit ledger</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const value = draft[row.line_code] ?? { debit: "", credit: "" };
            const needsDebit = row.nature === "earning" || row.nature === "employer_contribution";
            const needsCredit = row.nature !== "earning";
            return (
              <TableRow key={row.line_code}>
                <TableCell>
                  <span className="font-medium text-foreground">{row.name || row.line_code}</span>
                  <span className="block font-mono text-xs text-muted-foreground">
                    {row.line_code}
                  </span>
                  {row.used_by_run && !row.complete && (
                    <Badge variant="warning" className="mt-1">
                      Unmapped
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {NATURE_LABEL[row.nature]}
                </TableCell>
                <TableCell>
                  {needsDebit ? (
                    <Input
                      aria-label={`Debit ledger for ${row.line_code}`}
                      value={value.debit}
                      maxLength={160}
                      placeholder="e.g. Salaries & wages"
                      onChange={(event) => set(row.line_code, "debit", event.target.value)}
                    />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {needsCredit ? (
                    <Input
                      aria-label={`Credit ledger for ${row.line_code}`}
                      value={value.credit}
                      maxLength={160}
                      placeholder="e.g. PF payable"
                      onChange={(event) => set(row.line_code, "credit", event.target.value)}
                    />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </DataPanel>
  );
}
