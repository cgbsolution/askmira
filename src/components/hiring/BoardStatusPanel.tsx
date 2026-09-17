"use client";

import { PlugZap } from "lucide-react";
import React from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { RequireRole } from "@/components/common/RequireRole";
import { BoardAccountDialog } from "@/components/hiring/BoardAccountDialog";
import { formatDateTime, humanize, SOURCE_LABEL } from "@/components/hiring/labels";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ADMIN } from "@/lib/access";
import type { BoardStatus } from "@/lib/types/hiring";

export function boardName(board: string): string {
  return SOURCE_LABEL[board] ?? humanize(board);
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
  return (
    <DataPanel
      title="Boards"
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={boards.length === 0}
      empty={{ icon: PlugZap, title: "No job boards are supported in this deployment" }}
    >
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Board</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Last polled</TableHead>
              <TableHead>Last error</TableHead>
              <TableHead>Live connection</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {boards.map((row) => {
              const name = boardName(row.board);
              return (
                <TableRow key={row.board} className="align-top">
                  <TableCell className="font-medium text-foreground">{name}</TableCell>
                  <TableCell className="whitespace-normal">
                    <div className="flex flex-wrap gap-1">
                      {row.account_configured ? (
                        <Badge variant="secondary">Account configured</Badge>
                      ) : (
                        <Badge variant="muted">No account</Badge>
                      )}
                      {row.account?.has_credentials ? (
                        <Badge variant="secondary">Credentials stored</Badge>
                      ) : row.account ? (
                        <Badge variant="warning">No credentials</Badge>
                      ) : null}
                      {row.account && !row.account.is_active && (
                        <Badge variant="muted">Inactive</Badge>
                      )}
                    </div>
                    {row.account && (row.account.display_name || row.account.username) && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {[row.account.display_name, row.account.username].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatDateTime(row.account?.last_polled_at)}
                  </TableCell>
                  <TableCell className="max-w-64 whitespace-normal text-xs text-destructive">
                    {row.account?.last_error ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="max-w-72 whitespace-normal">
                    {row.live_connection_verified ? (
                      <Badge variant="success">Verified</Badge>
                    ) : (
                      <Badge variant="muted">Not verified</Badge>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">{row.message}</p>
                  </TableCell>
                  <TableCell className="text-right">
                    <RequireRole roles={ADMIN}>
                      <BoardAccountDialog
                        board={row.board}
                        boardName={name}
                        hasAccount={row.account_configured}
                        onSaved={onRetry}
                      />
                    </RequireRole>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </DataPanel>
  );
}
