"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { History, Lock } from "lucide-react";
import React, { useState } from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { Money } from "@/components/common/Money";
import { useEntityName, useReloadOn } from "@/components/payroll-ops/disbursements/common";
import {
  ARREAR_STATUS_LABEL,
  ArrearStatusBadge,
  displayPeriod,
  formatTimestamp,
} from "@/components/payroll-ops/arrears/labels";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { ArrearBatch, ArrearStatus, LegalEntity } from "@/lib/types/payroll-ops";

function periodsLabel(row: ArrearBatch): string {
  return row.from_period === row.to_period
    ? displayPeriod(row.from_period)
    : `${displayPeriod(row.from_period)} – ${displayPeriod(row.to_period)}`;
}

/** Arrear batches: computed, awaiting approval, approved, and paid in a payroll run. */
export function ArrearBatchesTab({
  entities,
  version,
  onOpen,
}: {
  entities: LegalEntity[];
  version: number;
  onOpen: (batchId: string) => void;
}) {
  const [status, setStatus] = useState<ArrearStatus | "any">("any");
  const query = useApiQuery<ArrearBatch[]>(
    status === "any" ? "/arrears/batches" : `/arrears/batches?batch_status=${status}`,
  );
  useReloadOn(version, query.reload);
  const entityName = useEntityName(entities);
  // A refusal for this role reads as no access, not as a failed load.
  const forbidden = query.error?.status === 403;

  const columns: ColumnDef<ArrearBatch>[] = [
    {
      id: "periods",
      header: "Periods",
      accessorFn: (row) => row.from_period,
      meta: { cellClassName: "text-foreground", text: periodsLabel },
      cell: ({ row }) => (
        <>
          {periodsLabel(row.original)}
          {row.original.affected_filings.length > 0 && (
            <span className="block text-xs text-muted-foreground tabular-nums">
              Touches {row.original.affected_filings.length} filed{" "}
              {row.original.affected_filings.length === 1 ? "return" : "returns"}
            </span>
          )}
        </>
      ),
    },
    {
      id: "entity",
      header: "Entity",
      accessorFn: (row) => entityName(row.legal_entity_id),
      meta: { className: "hidden md:table-cell", cellClassName: "text-muted-foreground" },
    },
    {
      accessorKey: "status",
      header: "Status",
      meta: { text: (row) => ARREAR_STATUS_LABEL[row.status] },
      cell: ({ row }) => (
        <>
          <ArrearStatusBadge status={row.original.status} />
          {row.original.awaiting_additional_approval && (
            <span className="block text-xs text-muted-foreground">Needs a second approver</span>
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
      accessorKey: "total_net_payable",
      header: "Net payable",
      meta: { className: "text-right" },
      cell: ({ row }) => <Money value={row.original.total_net_payable} className="font-medium" />,
    },
    {
      accessorKey: "total_employer_contribution_arrear",
      header: "Employer contributions",
      meta: { className: "hidden text-right lg:table-cell" },
      cell: ({ row }) => (
        <Money
          value={row.original.total_employer_contribution_arrear}
          className="text-muted-foreground"
        />
      ),
    },
    {
      accessorKey: "computed_at",
      header: "Computed",
      meta: {
        className: "hidden lg:table-cell",
        cellClassName: "text-muted-foreground",
        text: (row) => formatTimestamp(row.computed_at),
      },
      cell: ({ row }) => formatTimestamp(row.original.computed_at),
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      meta: { className: "w-20 text-right", text: false },
      cell: ({ row }) => (
        <Button size="sm" variant="ghost" onClick={() => onOpen(row.original.id)}>
          Open
        </Button>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={forbidden ? [] : (query.data ?? [])}
      noun="batches"
      exportName="arrear-batches"
      searchPlaceholder="Search batches"
      filters={
        <Select value={status} onValueChange={(value) => setStatus(value as ArrearStatus | "any")}>
          <SelectTrigger className="h-9 w-56" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any status</SelectItem>
            {(Object.keys(ARREAR_STATUS_LABEL) as ArrearStatus[]).map((value) => (
              <SelectItem key={value} value={value}>
                {ARREAR_STATUS_LABEL[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
      filtered={status !== "any" && !forbidden}
      isLoading={query.isLoading && query.data === null}
      error={forbidden ? null : query.error?.detail}
      onRetry={query.reload}
      empty={
        forbidden
          ? { icon: Lock, title: "You don't have access to this", description: query.error?.detail }
          : {
              icon: History,
              title: "No arrear batches yet",
              description:
                "A batch is computed when an admin commits a salary revision that reaches back into closed payroll periods.",
            }
      }
      emptyMessage={status === "any" ? undefined : "No batches with this status."}
    />
  );
}
