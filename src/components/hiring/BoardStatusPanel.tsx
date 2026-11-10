"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Check, Copy, PlugZap } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/data-table/DataTable";
import { RequireRole } from "@/components/common/RequireRole";
import { BoardAccountDialog } from "@/components/hiring/BoardAccountDialog";
import {
  formatDateTime,
  humanize,
  SOURCE_LABEL,
} from "@/components/hiring/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ADMIN } from "@/lib/access";
import type { BoardStatus } from "@/lib/types/hiring";

export function boardName(board: string): string {
  return SOURCE_LABEL[board] ?? humanize(board);
}

/** The account cell's badges and names as one line, for the search and the CSV. */
function accountText(row: BoardStatus): string {
  return [
    row.account_configured ? "Account configured" : "No account",
    row.account && row.needs_secret
      ? row.account.has_credentials
        ? "Credentials stored"
        : "No credentials"
      : null,
    row.account && !row.account.is_active ? "Inactive" : null,
    row.account?.display_name,
    row.account?.username,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** The feed's full address on this portal, and a button that copies it. */
function FeedLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const url =
    typeof window === "undefined" ? path : `${window.location.origin}${path}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Feed link copied");
    } catch {
      toast.error("Could not copy. Select the link and copy it by hand.");
    }
  };
  return (
    <div className="mt-2 flex items-center gap-2">
      <code
        className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 text-xs"
        title={url}
      >
        {url}
      </code>
      <Button
        size="sm"
        variant="outline"
        onClick={copy}
        aria-label="Copy feed link"
      >
        {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

/**
 * Each supported board: whether an account and credentials are stored, when
 * it was last polled, the last error, and — plainly — that no live connection
 * has been verified.
 */
export function BoardStatusPanel({
  boards,
  isLoading,
  error,
  onRetry,
}: {
  boards: BoardStatus[];
  isLoading: boolean;
  error?: string | null;
  onRetry: () => void;
}) {
  const columns: ColumnDef<BoardStatus>[] = [
    {
      id: "board",
      header: "Board",
      accessorFn: (row) => boardName(row.board),
      meta: { cellClassName: "font-medium text-foreground" },
    },
    {
      id: "account",
      header: "Account",
      accessorFn: (row) => row.account_configured,
      meta: { cellClassName: "whitespace-normal", text: accountText },
      cell: ({ row }) => {
        const { account, account_configured, needs_secret } = row.original;
        return (
          <>
            <div className="flex flex-wrap gap-1">
              {account_configured ? (
                <Badge variant="secondary">Account configured</Badge>
              ) : (
                <Badge variant="muted">No account</Badge>
              )}
              {account?.has_credentials ? (
                <Badge variant="secondary">Credentials stored</Badge>
              ) : account && needs_secret ? (
                <Badge variant="warning">No credentials</Badge>
              ) : null}
              {account && !account.is_active && (
                <Badge variant="muted">Inactive</Badge>
              )}
            </div>
            {account && (account.display_name || account.username) && (
              <p className="mt-1 text-xs text-muted-foreground">
                {[account.display_name, account.username]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </>
        );
      },
    },
    {
      id: "last_polled_at",
      header: "Last polled",
      accessorFn: (row) => row.account?.last_polled_at ?? null,
      meta: {
        cellClassName: "tabular-nums",
        text: (row) => formatDateTime(row.account?.last_polled_at),
      },
      cell: ({ row }) => formatDateTime(row.original.account?.last_polled_at),
    },
    {
      id: "last_error",
      header: "Last error",
      accessorFn: (row) => row.account?.last_error ?? null,
      meta: {
        cellClassName: "max-w-64 whitespace-normal text-xs text-destructive",
      },
      cell: ({ row }) =>
        row.original.account?.last_error ?? (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "live_connection",
      header: "Connection",
      accessorFn: (row) => row.live_connection_verified,
      meta: {
        cellClassName: "max-w-96 whitespace-normal",
        text: (row) =>
          row.reads_feed
            ? `Job feed · ${row.connection_note}`
            : `${row.live_connection_verified ? "Verified" : "Not verified"} · ${row.connection_note} ${row.message}`,
      },
      cell: ({ row }) => {
        const board = row.original;
        if (board.reads_feed) {
          return (
            <>
              <Badge variant="secondary">Job feed</Badge>
              <p className="mt-1 text-xs text-muted-foreground">
                {board.connection_note}
              </p>
              {board.feed_path ? (
                <FeedLink path={board.feed_path} />
              ) : (
                <p className="mt-1 text-xs text-warning">
                  Publish your careers page to get the feed link.
                </p>
              )}
            </>
          );
        }
        return (
          <>
            {board.live_connection_verified ? (
              <Badge variant="success">Verified</Badge>
            ) : (
              <Badge variant="muted">Not verified</Badge>
            )}
            {/* The page's banner already says no live connection is verified. */}
            <p className="mt-1 text-xs text-muted-foreground">
              {board.connection_note || board.message}
            </p>
          </>
        );
      },
    },
    {
      id: "actions",
      header: "Action",
      enableHiding: false,
      meta: { className: "text-right", text: false },
      cell: ({ row }) => (
        <RequireRole roles={ADMIN}>
          <BoardAccountDialog
            board={row.original.board}
            boardName={boardName(row.original.board)}
            hasAccount={row.original.account_configured}
            needsSecret={row.original.needs_secret}
            note={row.original.connection_note}
            onSaved={onRetry}
          />
        </RequireRole>
      ),
    },
  ];

  return (
    <DataTable
      title="Boards"
      columns={columns}
      data={boards}
      getRowId={(row) => row.board}
      noun="boards"
      exportName="job-boards"
      searchPlaceholder="Search boards"
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      rowClassName={() => "align-top"}
      empty={{
        icon: PlugZap,
        title: "No job boards are supported in this deployment",
      }}
    />
  );
}
