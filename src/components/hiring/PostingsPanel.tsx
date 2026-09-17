"use client";

import { Loader2, Megaphone, RefreshCw, XCircle } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataPanel } from "@/components/common/DataPanel";
import { boardName } from "@/components/hiring/BoardStatusPanel";
import { formatDateTime, POSTING_STATUS, StatusBadge } from "@/components/hiring/labels";
import { ALL, PostingRequisitionSelect } from "@/components/hiring/PostingRequisitionSelect";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, post } from "@/lib/api";
import type { Posting, PostingStatus, RequisitionSummary } from "@/lib/types/hiring";

const CLOSABLE = new Set<PostingStatus>(["draft", "publishing", "live", "parked"]);

/** Refresh and Close for one posting. Close asks first: it takes the job down from the board. */
function PostingActions({ posting, onChanged }: { posting: Posting; onChanged: () => void }) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const name = boardName(posting.board);

  const refresh = async () => {
    setIsRefreshing(true);
    try {
      const result = await post<{ status?: PostingStatus; reason?: string | null }>(
        `/job-boards/postings/${posting.id}/refresh`,
      );
      const label = result?.status ? (POSTING_STATUS[result.status]?.[0] ?? result.status) : null;
      const notify = !result?.status || result.status === "live" ? toast.success : toast.warning;
      notify(`${name} refresh: ${label ?? "done"}`, { description: result?.reason ?? undefined });
      onChanged();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.detail : "Could not refresh the posting.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const close = async () => {
    try {
      const result = await post<{ status?: PostingStatus; reason?: string | null }>(
        `/job-boards/postings/${posting.id}/close`,
      );
      if (!result?.status || result.status === "closed") {
        toast.success(`${name} posting closed`);
      } else {
        toast.warning(
          `${name} did not confirm the close: ${POSTING_STATUS[result.status]?.[0] ?? result.status}`,
          { description: result.reason ?? undefined },
        );
      }
      onChanged();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.detail : "Could not close the posting.");
      throw error;
    }
  };

  if (!CLOSABLE.has(posting.status)) return null;
  // The API refreshes only a live posting the board has given an id to.
  const canRefresh = posting.status === "live" && Boolean(posting.external_job_id);
  return (
    <div className="flex justify-end gap-1.5">
      {canRefresh && (
        <Button size="sm" variant="outline" disabled={isRefreshing} onClick={() => void refresh()}>
          {isRefreshing ? <Loader2 className="animate-spin" /> : <RefreshCw />} Refresh
        </Button>
      )}
      <Button size="sm" variant="ghost" onClick={() => setConfirmClose(true)}>
        <XCircle /> Close
      </Button>
      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title={`Close the ${name} posting?`}
        description={`${posting.requisition_code} · ${posting.requisition_title}. If it is on the board, the board is asked to take it down.`}
        confirmLabel="Close posting"
        destructive
        onConfirm={close}
      />
    </div>
  );
}

/** Every posting, filterable by requisition, with its board state, errors and warnings. */
export function PostingsPanel({
  requisitions,
  actions,
  onChanged,
  refreshSignal = 0,
}: {
  requisitions: RequisitionSummary[];
  actions?: React.ReactNode;
  /** Called after a refresh or close; the page bumps `refreshSignal` in response. */
  onChanged: () => void;
  /** Bump to make the panel reload (after a new posting, say). */
  refreshSignal?: number;
}) {
  const [requisitionId, setRequisitionId] = useState(ALL);
  const { data, error, isLoading, reload } = useApiQuery<Posting[]>(
    requisitionId === ALL
      ? "/job-boards/postings"
      : `/job-boards/postings?requisition_id=${encodeURIComponent(requisitionId)}`,
  );
  useEffect(() => {
    if (refreshSignal > 0) reload();
  }, [refreshSignal, reload]);
  const rows = data ?? [];

  return (
    <DataPanel
      title="Postings"
      actions={actions}
      toolbar={
        <PostingRequisitionSelect
          id="postings-filter"
          requisitions={requisitions}
          value={requisitionId}
          onChange={setRequisitionId}
          allLabel="All requisitions"
          placeholder="Filter by requisition"
          className="sm:w-80"
        />
      }
      isLoading={isLoading && !data}
      error={error?.detail}
      onRetry={reload}
      isEmpty={rows.length === 0}
      empty={{
        icon: Megaphone,
        title: requisitionId === ALL ? "Nothing posted yet" : "This requisition has not been posted",
        description: "Post an open requisition to a board to see it here.",
      }}
    >
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Requisition</TableHead>
              <TableHead>Board</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead className="text-right">Attempts</TableHead>
              <TableHead>Problems</TableHead>
              <TableHead className="text-right">Views</TableHead>
              <TableHead className="text-right">Applications</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} className="align-top">
                <TableCell>
                  <p className="font-medium text-foreground">{row.requisition_code}</p>
                  <p className="text-xs text-muted-foreground">{row.requisition_title}</p>
                </TableCell>
                <TableCell>
                  <p>{boardName(row.board)}</p>
                  {row.external_job_id && (
                    <p className="text-xs text-muted-foreground">ID {row.external_job_id}</p>
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge map={POSTING_STATUS} value={row.status} />
                  {row.next_attempt_at && row.status === "publishing" && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Next try {formatDateTime(row.next_attempt_at)}
                    </p>
                  )}
                </TableCell>
                <TableCell className="text-xs tabular-nums text-muted-foreground">
                  <p>Published {formatDateTime(row.published_at)}</p>
                  <p>Expires {formatDateTime(row.expires_at)}</p>
                  <p>Next refresh {formatDateTime(row.next_refresh_at)}</p>
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.attempt_count}</TableCell>
                <TableCell className="max-w-72 whitespace-normal text-xs">
                  {row.last_error && <p className="text-destructive">{row.last_error}</p>}
                  {row.warnings.length > 0 && (
                    <ul className="list-disc space-y-0.5 pl-4 text-mustard-900 dark:text-mustard-100">
                      {row.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  )}
                  {!row.last_error && row.warnings.length === 0 && (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.view_count}</TableCell>
                <TableCell className="text-right tabular-nums">{row.application_count}</TableCell>
                <TableCell className="text-right">
                  <PostingActions posting={row} onChanged={onChanged} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </DataPanel>
  );
}
