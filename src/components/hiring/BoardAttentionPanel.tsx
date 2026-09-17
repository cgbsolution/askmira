"use client";

import { CheckCircle2 } from "lucide-react";
import React, { useEffect } from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { boardName } from "@/components/hiring/BoardStatusPanel";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { PostingAttention, RequisitionSummary } from "@/lib/types/hiring";

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

  return (
    <DataPanel
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
      isLoading={isLoading && !data}
      error={error?.detail}
      onRetry={reload}
      isEmpty={parked.length === 0}
      empty={{
        icon: CheckCircle2,
        title: "No parked postings",
        description: "A posting is parked when retries are used up or the board refused it.",
      }}
    >
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Requisition</TableHead>
              <TableHead>Board</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead className="text-right">Attempts</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parked.map((row) => (
              <TableRow key={row.posting_id}>
                <TableCell>{requisitionLabel(row.requisition_id)}</TableCell>
                <TableCell>{boardName(row.board)}</TableCell>
                <TableCell className="max-w-96 whitespace-normal text-sm text-destructive">
                  {row.reason ?? "No reason recorded"}
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.attempts}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </DataPanel>
  );
}
