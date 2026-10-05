"use client";

import { Banknote, Plus } from "lucide-react";
import React, { useMemo, useState } from "react";

import { Money } from "@/components/common/Money";
import { RequireRole } from "@/components/common/RequireRole";
import { InlineProblem } from "@/components/payroll-ops/shared";
import { QueryPanel, useReloadOn } from "@/components/payroll-ops/disbursements/common";
import { runLabel } from "@/components/payroll-ops/disbursements/PrepareBatchDialog";
import { BatchStatusBadge, formatTimestamp } from "@/components/payroll-ops/disbursements/labels";
import { Button } from "@/components/ui/button";
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
import type { DisbursementBatch, PayrollRunSummary } from "@/lib/types/payroll-ops";
import { formatDay } from "@/lib/utils";

/** Every disbursement batch, optionally for one payroll run. */
export function BatchesTab({
  runs,
  runsError,
  version,
  onPrepare,
  onOpen,
}: {
  runs: PayrollRunSummary[];
  runsError: string | null;
  version: number;
  onPrepare: () => void;
  onOpen: (batchId: string) => void;
}) {
  const [runId, setRunId] = useState("any");
  const query = useApiQuery<DisbursementBatch[]>(
    runId === "any"
      ? "/disbursement/batches"
      : `/disbursement/batches?payroll_run_id=${encodeURIComponent(runId)}`,
  );
  useReloadOn(version, query.reload);

  const runName = useMemo(() => {
    const byId = new Map(runs.map((run) => [run.id, run]));
    return (id: string) => {
      const run = byId.get(id);
      return run ? runLabel(run) : "Payroll run";
    };
  }, [runs]);

  return (
    <div className="grid gap-3">
      {runsError && (
        <InlineProblem>
          Payroll runs could not be loaded, so a new file cannot be prepared right now: {runsError}.
          Existing batches are still listed below.
        </InlineProblem>
      )}
      <QueryPanel
        query={query}
        isEmpty={(rows) => rows.length === 0}
        empty={{
          icon: Banknote,
          title: runId === "any" ? "No salary files yet" : "No salary files for this run",
          description:
            "Prepare a file once a payroll run is approved. It is validated first; anything that would bounce at the bank blocks it.",
        }}
        toolbar={
          <>
            <Select value={runId} onValueChange={setRunId}>
              <SelectTrigger size="sm" className="w-80 max-w-full" aria-label="Payroll run">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">All payroll runs</SelectItem>
                {runs.map((run) => (
                  <SelectItem key={run.id} value={run.id}>
                    {runLabel(run)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <RequireRole roles={["admin", "sub_admin"]}>
              <Button
                size="sm"
                className="ml-auto"
                onClick={onPrepare}
                disabled={Boolean(runsError)}
              >
                <Plus /> Prepare salary file
              </Button>
            </RequireRole>
          </>
        }
      >
        {(rows) => (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payroll run</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Employees</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="hidden md:table-cell">Value date</TableHead>
                <TableHead className="hidden lg:table-cell">Prepared</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-foreground">
                    {runName(row.payroll_run_id)}
                    {row.supplements_batch_id && (
                      <span className="block text-xs text-muted-foreground">
                        Supplementary: reissued failed credits
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <BatchStatusBadge status={row.status} />
                    {row.status === "failed" && row.validation_exceptions.length > 0 && (
                      <span className="block text-xs text-muted-foreground tabular-nums">
                        {row.validation_exceptions.length} to fix
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.employee_count}</TableCell>
                  <TableCell className="text-right">
                    <Money value={row.total_amount} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {row.value_date ? formatDay(row.value_date, true) : "—"}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">
                    {row.prepared_by_name ?? "—"}
                    <span className="block text-xs">{formatTimestamp(row.prepared_at)}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => onOpen(row.id)}>
                      Open
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </QueryPanel>
    </div>
  );
}
