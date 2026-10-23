"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { PlugZap } from "lucide-react";
import React from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { RequireRole } from "@/components/common/RequireRole";
import { BoardAccountDialog } from "@/components/hiring/BoardAccountDialog";
import { formatDateTime, humanize, SOURCE_LABEL } from "@/components/hiring/labels";
import { Badge } from "@/components/ui/badge";
import { ADMIN } from "@/lib/access";
import type { BoardStatus } from "@/lib/types/hiring";

export function boardName(board: string): string {
  return SOURCE_LABEL[board] ?? humanize(board);
}

/** The account cell's badges and names as one line, for the search and the CSV. */
function accountText(row: BoardStatus): string {
  return [
    row.account_configured ? "Account configured" : "No account",
    row.account ? (row.account.has_credentials ? "Credentials stored" : "No credentials") : null,
    row.account && !row.account.is_active ? "Inactive" : null,
    row.account?.display_name,
    row.account?.username,
  ]
    .filter(Boolean)
    .join(" · ");
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
        const { account, account_configured } = row.original;
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
              ) : account ? (
                <Badge variant="warning">No credentials</Badge>
              ) : null}
              {account && !account.is_active && <Badge variant="muted">Inactive</Badge>}
            </div>
            {account && (account.display_name || account.username) && (
              <p className="mt-1 text-xs text-muted-foreground">
                {[account.display_name, account.username].filter(Boolean).join(" · ")}
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
      meta: { cellClassName: "tabular-nums", text: (row) => formatDateTime(row.account?.last_polled_at) },
      cell: ({ row }) => formatDateTime(row.original.account?.last_polled_at),
    },
    {
      id: "last_error",
      header: "Last error",
      accessorFn: (row) => row.account?.last_error ?? null,
      meta: { cellClassName: "max-w-64 whitespace-normal text-xs text-destructive" },
      cell: ({ row }) => row.original.account?.last_error ?? <span className="text-muted-foreground">—</span>,
    },
    {
      id: "live_connection",
      header: "Live connection",
      accessorFn: (row) => row.live_connection_verified,
      meta: {
        cellClassName: "max-w-72 whitespace-normal",
        text: (row) => `${row.live_connection_verified ? "Verified" : "Not verified"} · ${row.message}`,
      },
      cell: ({ row }) => (
        <>
          {row.original.live_connection_verified ? (
            <Badge variant="success">Verified</Badge>
          ) : (
            <Badge variant="muted">Not verified</Badge>
          )}
          <p className="mt-1 text-xs text-muted-foreground">{row.original.message}</p>
        </>
      ),
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
      empty={{ icon: PlugZap, title: "No job boards are supported in this deployment" }}
    />
  );
}
