"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Loader2, Megaphone, RefreshCw, XCircle } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataTable } from "@/components/common/data-table/DataTable";
import { boardName } from "@/components/hiring/BoardStatusPanel";
import { formatDateTime, POSTING_STATUS, StatusBadge } from "@/components/hiring/labels";
import { ALL, PostingRequisitionSelect } from "@/components/hiring/PostingRequisitionSelect";
import { Button } from "@/components/ui/button";
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
  const filtered = requisitionId !== ALL;

  const columns: ColumnDef<Posting>[] = [
    {
      accessorKey: "requisition_code",
      header: "Requisition",
      meta: { text: (row) => `${row.requisition_code} ${row.requisition_title}` },
      cell: ({ row }) => (
        <>
          <p className="font-medium text-foreground">{row.original.requisition_code}</p>
          <p className="text-xs text-muted-foreground">{row.original.requisition_title}</p>
        </>
      ),
    },
    {
      id: "board",
      header: "Board",
      accessorFn: (row) => boardName(row.board),
      meta: {
        text: (row) => (row.external_job_id ? `${boardName(row.board)} ID ${row.external_job_id}` : boardName(row.board)),
      },
      cell: ({ row }) => (
        <>
          <p>{boardName(row.original.board)}</p>
          {row.original.external_job_id && (
            <p className="text-xs text-muted-foreground">ID {row.original.external_job_id}</p>
          )}
        </>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      meta: { text: (row) => POSTING_STATUS[row.status]?.[0] ?? row.status },
      cell: ({ row }) => (
        <>
          <StatusBadge map={POSTING_STATUS} value={row.original.status} />
          {row.original.next_attempt_at && row.original.status === "publishing" && (
            <p className="mt-1 text-xs text-muted-foreground">
              Next try {formatDateTime(row.original.next_attempt_at)}
            </p>
          )}
        </>
      ),
    },
    {
      id: "dates",
      header: "Dates",
      accessorFn: (row) => row.published_at,
      meta: {
        cellClassName: "text-xs tabular-nums text-muted-foreground",
        text: (row) =>
          `Published ${formatDateTime(row.published_at)} · Expires ${formatDateTime(row.expires_at)} · Next refresh ${formatDateTime(row.next_refresh_at)}`,
      },
      cell: ({ row }) => (
        <>
          <p>Published {formatDateTime(row.original.published_at)}</p>
          <p>Expires {formatDateTime(row.original.expires_at)}</p>
          <p>Next refresh {formatDateTime(row.original.next_refresh_at)}</p>
        </>
      ),
    },
    {
      accessorKey: "attempt_count",
      header: "Attempts",
      meta: { className: "text-right", cellClassName: "tabular-nums" },
    },
    {
      id: "problems",
      header: "Problems",
      meta: {
        cellClassName: "max-w-72 whitespace-normal text-xs",
        text: (row) => [row.last_error, ...row.warnings].filter(Boolean).join(" · "),
      },
      cell: ({ row }) => (
        <>
          {row.original.last_error && <p className="text-destructive">{row.original.last_error}</p>}
          {row.original.warnings.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-4 text-marigold-900 dark:text-marigold-100">
              {row.original.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}
          {!row.original.last_error && row.original.warnings.length === 0 && (
            <span className="text-muted-foreground">—</span>
          )}
        </>
      ),
    },
    {
      accessorKey: "view_count",
      header: "Views",
      meta: { className: "text-right", cellClassName: "tabular-nums" },
    },
    {
      accessorKey: "application_count",
      header: "Applications",
      meta: { className: "text-right", cellClassName: "tabular-nums" },
    },
    {
      id: "actions",
      header: "Actions",
      enableHiding: false,
      meta: { className: "text-right", text: false },
      cell: ({ row }) => <PostingActions posting={row.original} onChanged={onChanged} />,
    },
  ];

  return (
    <DataTable
      title="Postings"
      actions={actions}
      columns={columns}
      data={rows}
      noun="postings"
      exportName="job-board-postings"
      searchPlaceholder="Search requisition or board"
      filters={
        <PostingRequisitionSelect
          id="postings-filter"
          requisitions={requisitions}
          value={requisitionId}
          onChange={setRequisitionId}
          allLabel="All requisitions"
          placeholder="Filter by requisition"
          className="h-9 sm:w-80"
        />
      }
      filtered={filtered}
      isLoading={isLoading && !data}
      error={error?.detail}
      onRetry={reload}
      empty={{
        icon: Megaphone,
        title: "Nothing posted yet",
        description: "Post an open requisition to a board to see it here.",
      }}
      emptyMessage={
        filtered && rows.length === 0
          ? "This requisition has not been posted. Post an open requisition to a board to see it here."
          : undefined
      }
      rowClassName={() => "align-top"}
    />
  );
}
