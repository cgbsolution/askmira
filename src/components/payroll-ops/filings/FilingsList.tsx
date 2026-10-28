"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { FileText, Lock, X } from "lucide-react";
import React, { useState } from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { Money } from "@/components/common/Money";
import { useEntityName, useReloadOn } from "@/components/payroll-ops/disbursements/common";
import {
  displayPeriod,
  FilingStatusBadge,
  formatTimestamp,
  RETURN_LABEL,
  STATUS_LABEL,
} from "@/components/payroll-ops/filings/labels";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApiQuery } from "@/hooks/useApiQuery";
import type {
  FilingRecord,
  FilingStatus,
  LegalEntity,
  ReturnType,
} from "@/lib/types/payroll-ops";
import { MonthPicker } from "@/components/common/MonthPicker";

/** Every generated, blocked, filed and rejected return, newest first. */
export function FilingsList({
  entities,
  version,
  onOpen,
}: {
  entities: LegalEntity[];
  version: number;
  onOpen: (recordId: string) => void;
}) {
  const [returnType, setReturnType] = useState<ReturnType | "any">("any");
  const [status, setStatus] = useState<FilingStatus | "any">("any");
  const [period, setPeriod] = useState("");

  const params = new URLSearchParams();
  if (returnType !== "any") params.set("return_type", returnType);
  if (status !== "any") params.set("status", status);
  if (period) params.set("period", period);
  const qs = params.toString();
  const query = useApiQuery<FilingRecord[]>(`/filings${qs ? `?${qs}` : ""}`);
  useReloadOn(version, query.reload);
  const entityName = useEntityName(entities);

  const filtered = returnType !== "any" || status !== "any" || period !== "";
  // A 403 reads as "no access", not as a failed load.
  const forbidden = query.error?.status === 403;

  const columns: ColumnDef<FilingRecord>[] = [
    {
      id: "return",
      header: "Return",
      accessorFn: (row) => RETURN_LABEL[row.return_type],
      meta: {
        cellClassName: "font-medium text-foreground",
        text: (row) =>
          row.jurisdiction
            ? `${RETURN_LABEL[row.return_type]} · ${row.jurisdiction}`
            : RETURN_LABEL[row.return_type],
      },
      cell: ({ row }) => (
        <>
          {RETURN_LABEL[row.original.return_type]}
          {row.original.jurisdiction && (
            <span className="block text-xs font-normal text-muted-foreground">
              {row.original.jurisdiction}
            </span>
          )}
        </>
      ),
    },
    {
      accessorKey: "period",
      header: "Period",
      meta: { text: (row) => displayPeriod(row.period) },
      cell: ({ row }) => displayPeriod(row.original.period),
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
      meta: { text: (row) => STATUS_LABEL[row.status] },
      cell: ({ row }) => (
        <>
          <FilingStatusBadge status={row.original.status} />
          {row.original.status === "blocked" && (
            <span className="block text-xs text-muted-foreground tabular-nums">
              {row.original.validation_exceptions.length}{" "}
              {row.original.validation_exceptions.length === 1 ? "finding" : "findings"}
            </span>
          )}
        </>
      ),
    },
    {
      accessorKey: "record_count",
      header: "Records",
      meta: { className: "text-right", cellClassName: "tabular-nums" },
    },
    {
      accessorKey: "total_amount",
      header: "Amount",
      sortingFn: "alphanumeric",
      meta: { className: "text-right" },
      cell: ({ row }) => <Money value={row.original.total_amount} />,
    },
    {
      id: "generated",
      header: "Generated",
      accessorFn: (row) => row.generated_at ?? row.created_at,
      meta: {
        className: "hidden lg:table-cell",
        cellClassName: "text-muted-foreground",
        text: (row) => formatTimestamp(row.generated_at ?? row.created_at),
      },
      cell: ({ row }) => formatTimestamp(row.original.generated_at ?? row.original.created_at),
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
    <DataTable
      columns={columns}
      data={forbidden ? [] : (query.data ?? [])}
      noun="returns"
      exportName="returns"
      searchPlaceholder="Search returns"
      isLoading={query.isLoading && query.data === null}
      error={forbidden ? null : (query.error?.detail ?? null)}
      onRetry={query.reload}
      filtered={!forbidden && filtered}
      empty={
        forbidden
          ? { icon: Lock, title: "You don't have access to this", description: query.error?.detail }
          : {
              icon: FileText,
              title: "No returns generated yet",
              description:
                "Generate a return above. Blocked attempts are kept here with their findings, so nothing is lost between fixing and retrying.",
            }
      }
      emptyMessage="No returns match these filters. Clear the filters to see every return."
      filters={
        <>
          <Select
            value={returnType}
            onValueChange={(value) => setReturnType(value as ReturnType | "any")}
          >
            <SelectTrigger className="h-9 w-52" aria-label="Return">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">All returns</SelectItem>
              {(Object.keys(RETURN_LABEL) as ReturnType[]).map((type) => (
                <SelectItem key={type} value={type}>
                  {RETURN_LABEL[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(value) => setStatus(value as FilingStatus | "any")}>
            <SelectTrigger className="h-9 w-52" aria-label="Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any status</SelectItem>
              {(Object.keys(STATUS_LABEL) as FilingStatus[]).map((value) => (
                <SelectItem key={value} value={value}>
                  {STATUS_LABEL[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <MonthPicker
            aria-label="Period"
            value={period}
            onChange={setPeriod}
            className="h-9 w-44"
          />
          {filtered && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setReturnType("any");
                setStatus("any");
                setPeriod("");
              }}
            >
              <X /> Clear filters
            </Button>
          )}
        </>
      }
    />
  );
}
