"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { CheckCircle2 } from "lucide-react";
import React, { useEffect } from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { boardName } from "@/components/hiring/BoardStatusPanel";
import { Badge } from "@/components/ui/badge";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { PostingAttention, RequisitionSummary } from "@/lib/types/hiring";

type ParkedPosting = PostingAttention["parked"][number];

/**
 * Postings that will not become live on their own (parked), plus how many are
 * due a retry or a refresh.
 */
export function BoardAttentionPanel({
  requisitions,
  refreshSignal = 0,
}: {
  requisitions: RequisitionSummary[];
  /** Bump to make the panel reload after a posting changes. */
  refreshSignal?: number;
}) {
  const { data, error, isLoading, reload } = useApiQuery<PostingAttention>("/job-boards/attention");
  useEffect(() => {
    if (refreshSignal > 0) reload();
  }, [refreshSignal, reload]);
  const parked = data?.parked ?? [];
  const requisitionLabel = (id: string) => {
    const found = requisitions.find((item) => item.id === id);
    return found ? `${found.code} · ${found.title}` : "Requisition not found";
  };

  const columns: ColumnDef<ParkedPosting>[] = [
    { id: "requisition", header: "Requisition", accessorFn: (row) => requisitionLabel(row.requisition_id) },
    { id: "board", header: "Board", accessorFn: (row) => boardName(row.board) },
    {
      id: "reason",
      header: "Reason",
      accessorFn: (row) => row.reason ?? "No reason recorded",
      meta: { cellClassName: "max-w-96 whitespace-normal text-sm text-destructive" },
    },
    { accessorKey: "attempts", header: "Attempts", meta: { className: "text-right", cellClassName: "tabular-nums" } },
  ];

  return (
    <DataTable
      title="Needs attention"
      description={
        data ? (
          <span className="flex flex-wrap gap-2">
            <Badge variant={data.retry_due.length ? "warning" : "muted"}>
              {data.retry_due.length} due a retry
            </Badge>
            <Badge variant={data.refresh_due.length ? "warning" : "muted"}>
              {data.refresh_due.length} due a refresh
            </Badge>
          </span>
        ) : undefined
      }
      columns={columns}
      data={parked}
      getRowId={(row) => row.posting_id}
      noun="parked postings"
      exportName="parked-postings"
      searchPlaceholder="Search parked postings"
      isLoading={isLoading && !data}
      error={error?.detail}
      onRetry={reload}
      empty={{
        icon: CheckCircle2,
        title: "No parked postings",
        description: "A posting is parked when retries are used up or the board refused it.",
      }}
    />
  );
}
