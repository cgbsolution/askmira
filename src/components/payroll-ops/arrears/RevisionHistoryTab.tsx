"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { History, Lock, UserSearch } from "lucide-react";
import React, { useState } from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { FormField } from "@/components/common/FormField";
import { EmployeePicker } from "@/components/payroll-ops/disbursements/EmployeePicker";
import { formatTimestamp, REVISION_TYPE_LABEL } from "@/components/payroll-ops/arrears/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { EmployeeSummary } from "@/lib/types";
import type { SalaryRevision } from "@/lib/types/payroll-ops";
import { formatDay } from "@/lib/utils";

/** One employee's committed salary revisions. */
export function RevisionHistoryTab({ onOpenBatch }: { onOpenBatch: (batchId: string) => void }) {
  const [employee, setEmployee] = useState<EmployeeSummary | null>(null);
  const query = useApiQuery<SalaryRevision[]>(
    employee ? `/arrears/revisions?employee_id=${encodeURIComponent(employee.id)}` : null,
  );
  // A refusal for this role reads as no access, not as a failed load.
  const forbidden = query.error?.status === 403;
  // Nothing asked for yet: no employee chosen.
  const idle = !query.isLoading && !query.error && query.data === null;

  const columns: ColumnDef<SalaryRevision>[] = [
    {
      accessorKey: "effective_from",
      header: "Effective from",
      meta: { text: (row) => formatDay(row.effective_from, true) },
      cell: ({ row }) => formatDay(row.original.effective_from, true),
    },
    {
      accessorKey: "revision_type",
      header: "Kind",
      meta: { text: (row) => REVISION_TYPE_LABEL[row.revision_type] },
      cell: ({ row }) => (
        <Badge variant="muted">{REVISION_TYPE_LABEL[row.original.revision_type]}</Badge>
      ),
    },
    {
      accessorKey: "reason",
      header: "Reason",
      meta: {
        className: "hidden md:table-cell",
        cellClassName: "max-w-80 truncate text-muted-foreground",
      },
      cell: ({ row }) => row.original.reason ?? "—",
    },
    {
      accessorKey: "processed_at",
      header: "Processed",
      meta: {
        cellClassName: "text-muted-foreground",
        text: (row) => (row.processed_at ? formatTimestamp(row.processed_at) : "Not yet"),
      },
      cell: ({ row }) =>
        row.original.processed_at ? formatTimestamp(row.original.processed_at) : "Not yet",
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      meta: { className: "text-right", text: false },
      cell: ({ row }) =>
        row.original.arrear_batch_id && (
          <Button
            size="sm"
            variant="link"
            onClick={() => onOpenBatch(row.original.arrear_batch_id!)}
          >
            Open batch
          </Button>
        ),
    },
  ];

  return (
    <DataTable
      title="Revision history"
      description="Every committed revision for a person, and the batch it produced."
      columns={columns}
      data={forbidden ? [] : (query.data ?? [])}
      noun="revisions"
      exportName="salary-revisions"
      searchPlaceholder="Search revisions"
      tabs={
        <FormField htmlFor="history-employee" label="Employee" className="w-full max-w-md">
          <EmployeePicker id="history-employee" value={employee} onChange={setEmployee} />
        </FormField>
      }
      loadingRows={3}
      isLoading={query.isLoading && query.data === null}
      error={forbidden ? null : query.error?.detail}
      onRetry={query.reload}
      empty={
        forbidden
          ? { icon: Lock, title: "You don't have access to this", description: query.error?.detail }
          : idle
            ? {
                icon: UserSearch,
                title: "Choose an employee",
                description: "Search by name or employee code to see their salary revisions.",
              }
            : {
                icon: History,
                title: "No revisions committed for this employee",
                description: "Revisions appear here once an admin commits one.",
              }
      }
    />
  );
}
