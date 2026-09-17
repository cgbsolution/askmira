"use client";

import { AlertTriangle } from "lucide-react";
import React, { useState } from "react";

import { PageShell } from "@/components/common/PageShell";
import { SectionNav } from "@/components/common/SectionNav";
import { BoardAttentionPanel } from "@/components/hiring/BoardAttentionPanel";
import { BoardStatusPanel } from "@/components/hiring/BoardStatusPanel";
import { PostingCreateDialog } from "@/components/hiring/PostingCreateDialog";
import { PostingsPanel } from "@/components/hiring/PostingsPanel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { Page } from "@/lib/types";
import type { BoardStatus, RequisitionSummary } from "@/lib/types/hiring";

/**
 * Job boards (HR): stored accounts, postings and what needs attention. The
 * page leads with the plain fact that no live board connection has been
 * verified from this deployment, so nobody reads "Live" as proof of reach.
 */
export default function JobBoardsPage() {
  const status = useApiQuery<BoardStatus[]>("/job-boards/status");
  const requisitions = useApiQuery<Page<RequisitionSummary>>("/hiring/requisitions?page=1&page_size=200");
  // Bumped when a posting changes, so the attention and postings panels reload.
  const [signal, setSignal] = useState(0);
  const boards = status.data ?? [];
  const reqList = requisitions.data?.items ?? [];
  const noneVerified = boards.length > 0 && boards.every((board) => !board.live_connection_verified);
  const warning = noneVerified ? boards[0].message : null;

  const postingsChanged = () => {
    setSignal((value) => value + 1);
    status.reload();
  };

  return (
    <PageShell
      title="Job boards"
      description="Post open requisitions to external boards and see where each posting stands."
    >
      <SectionNav section="hiring" />

      {warning && (
        <Alert variant="warning">
          <AlertTriangle />
          <AlertTitle>No live job-board connection has been verified</AlertTitle>
          <AlertDescription>{warning}</AlertDescription>
        </Alert>
      )}

      <BoardStatusPanel
        boards={boards}
        isLoading={status.isLoading && !status.data}
        error={status.error?.detail}
        onRetry={status.reload}
      />

      <BoardAttentionPanel requisitions={reqList} refreshSignal={signal} />

      <PostingsPanel
        requisitions={reqList}
        refreshSignal={signal}
        onChanged={postingsChanged}
        actions={
          <PostingCreateDialog
            boards={boards.map((board) => board.board)}
            onPosted={postingsChanged}
          />
        }
      />
    </PageShell>
  );
}
