"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Banknote, Lock, Plus } from "lucide-react";
import React, { useMemo, useState } from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { Money } from "@/components/common/Money";
import { RequireRole } from "@/components/common/RequireRole";
import { InlineProblem } from "@/components/payroll-ops/shared";
import { useReloadOn } from "@/components/payroll-ops/disbursements/common";
import { runLabel } from "@/components/payroll-ops/disbursements/PrepareBatchDialog";
import {
  BATCH_STATUS_LABEL,
  BatchStatusBadge,
  formatTimestamp,
} from "@/components/payroll-ops/disbursements/labels";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { DisbursementBatch, PayrollRunSummary } from "@/lib/types/payroll-ops";
import { formatDay } from "@/lib/utils";

const SUPPLEMENTARY = "Supplementary: reissued failed credits";

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
  // A 403 reads as "no access", not as a failed load.
  const forbidden = query.error?.status === 403;

  const runName = useMemo(() => {
    const byId = new Map(runs.map((run) => [run.id, run]));
    return (id: string) => {
      const run = byId.get(id);
      return run ? runLabel(run) : "Payroll run";
    };
  }, [runs]);

  const columns: ColumnDef<DisbursementBatch>[] = [
    {
      id: "payroll_run",
      header: "Payroll run",
      accessorFn: (row) => runName(row.payroll_run_id),
      meta: {
        cellClassName: "text-foreground",
        text: (row) =>
          row.supplements_batch_id
            ? `${runName(row.payroll_run_id)} · ${SUPPLEMENTARY}`
            : runName(row.payroll_run_id),
      },
      cell: ({ row }) => (
        <>
          {runName(row.original.payroll_run_id)}
          {row.original.supplements_batch_id && (
            <span className="block text-xs text-muted-foreground">{SUPPLEMENTARY}</span>
          )}
        </>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      meta: { text: (row) => BATCH_STATUS_LABEL[row.status] },
      cell: ({ row }) => (
        <>
          <BatchStatusBadge status={row.original.status} />
          {row.original.status === "failed" && row.original.validation_exceptions.length > 0 && (
            <span className="block text-xs text-muted-foreground tabular-nums">
              {row.original.validation_exceptions.length} to fix
            </span>
          )}
        </>
      ),
    },
    {
      accessorKey: "employee_count",
      header: "Employees",
      meta: { className: "text-right", cellClassName: "tabular-nums" },
    },
    {
      accessorKey: "total_amount",
      header: "Total",
      sortingFn: "alphanumeric",
      meta: { className: "text-right" },
      cell: ({ row }) => <Money value={row.original.total_amount} />,
    },
    {
      accessorKey: "value_date",
      header: "Value date",
      meta: {
        className: "hidden md:table-cell",
        text: (row) => (row.value_date ? formatDay(row.value_date, true) : null),
      },
      cell: ({ row }) =>
        row.original.value_date ? formatDay(row.original.value_date, true) : "—",
    },
    {
      id: "prepared",
      header: "Prepared",
      accessorFn: (row) => row.prepared_at,
      meta: {
        className: "hidden lg:table-cell",
        cellClassName: "text-muted-foreground",
        text: (row) =>
          [row.prepared_by_name, row.prepared_at ? formatTimestamp(row.prepared_at) : null]
            .filter(Boolean)
            .join(" · "),
      },
      cell: ({ row }) => (
        <>
          {row.original.prepared_by_name ?? "—"}
          <span className="block text-xs">{formatTimestamp(row.original.prepared_at)}</span>
        </>
      ),
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      meta: { className: "text-right", headClassName: "w-20", text: false },
      cell: ({ row }) => (
        <Button size="sm" variant="ghost" onClick={() => onOpen(row.original.id)}>
          Open
        </Button>
      ),
    },
  ];

  return (
    <div className="grid gap-3">
      {runsError && (
        <InlineProblem>
          Payroll runs could not be loaded, so a new file cannot be prepared right now: {runsError}.
          Existing batches are still listed below.
        </InlineProblem>
      )}
      <DataTable
        columns={columns}
        data={forbidden ? [] : (query.data ?? [])}
        noun="salary files"
        exportName="salary-files"
        searchPlaceholder="Search salary files"
        isLoading={query.isLoading && query.data === null}
        error={forbidden ? null : (query.error?.detail ?? null)}
        onRetry={query.reload}
        filtered={!forbidden && runId !== "any"}
        empty={
          forbidden
            ? { icon: Lock, title: "You don't have access to this", description: query.error?.detail }
            : {
                icon: Banknote,
                title: "No salary files yet",
                description:
                  "Prepare a file once a payroll run is approved. It is validated first; anything that would bounce at the bank blocks it.",
              }
        }
        emptyMessage="No salary files for this run. Prepare a file once a payroll run is approved. It is validated first; anything that would bounce at the bank blocks it."
        filters={
          <Select value={runId} onValueChange={setRunId}>
            <SelectTrigger className="h-9 w-80 max-w-full" aria-label="Payroll run">
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
        }
        actions={
          <RequireRole roles={["admin", "sub_admin"]}>
            <Button size="sm" className="h-9" onClick={onPrepare} disabled={Boolean(runsError)}>
              <Plus /> Prepare salary file
            </Button>
          </RequireRole>
        }
      />
    </div>
  );
}
