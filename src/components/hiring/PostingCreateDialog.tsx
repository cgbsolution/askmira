"use client";

import { Send } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { BoardFormDialog } from "@/components/hiring/BoardFormDialog";
import { boardName } from "@/components/hiring/BoardStatusPanel";
import { POSTING_STATUS } from "@/components/hiring/labels";
import { PostingRequisitionSelect } from "@/components/hiring/PostingRequisitionSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, post } from "@/lib/api";
import type { Page } from "@/lib/types";
import type { PostingStatus, RequisitionSummary } from "@/lib/types/hiring";

type Errors = Partial<Record<"requisition" | "board" | "applyUrl" | "interval", string>>;

/**
 * Post an open requisition to a board. A board failure is not an exception:
 * the API returns a posting that says why, and the toast repeats it.
 */
export function PostingCreateDialog({
  boards,
  onPosted,
}: {
  boards: string[];
  onPosted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [requisitionId, setRequisitionId] = useState("");
  const [board, setBoard] = useState("");
  const [applyUrl, setApplyUrl] = useState("");
  const [intervalDays, setIntervalDays] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  // Loaded when the dialog opens; the trigger toggles `open` via onClick.
  const requisitions = useApiQuery<Page<RequisitionSummary>>(
    open ? "/hiring/requisitions?status=open&page=1&page_size=200" : null,
  );

  const reset = () => {
    setOpen(false);
    setRequisitionId("");
    setBoard("");
    setApplyUrl("");
    setIntervalDays("");
    setErrors({});
  };

  const submit = async (): Promise<boolean> => {
    const next: Errors = {};
    if (!requisitionId) next.requisition = "Choose an open requisition.";
    if (!board) next.board = "Choose a board.";
    const url = applyUrl.trim();
    if (url && !url.startsWith("https://")) next.applyUrl = "The apply link must start with https://.";
    const days = intervalDays.trim();
    if (days && (!/^\d+$/.test(days) || Number(days) < 1 || Number(days) > 90)) {
      next.interval = "Use a whole number of days from 1 to 90.";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return false;
    try {
      const result = await post<{ status: PostingStatus; reason?: string | null }>(
        "/job-boards/postings",
        {
          requisition_id: requisitionId,
          board,
          apply_url: url || null,
          refresh_interval_days: days ? Number(days) : null,
        },
      );
      const label = POSTING_STATUS[result.status]?.[0] ?? result.status;
      const message = `Posting to ${boardName(board)}: ${label}`;
      if (result.status === "live") toast.success(message);
      else toast.warning(message, { description: result.reason ?? undefined });
      onPosted();
      return true;
    } catch (error) {
      toast.error(error instanceof ApiError ? error.detail : "Could not post the requisition.");
      return false;
    }
  };

  const list = requisitions.data?.items ?? [];

  return (
    <BoardFormDialog
      trigger={
        <Button disabled={boards.length === 0} onClick={() => setOpen(true)}>
          <Send /> Post a requisition
        </Button>
      }
      title="Post a requisition to a board"
      description="Only open requisitions can be posted."
      submitLabel="Post"
      onSubmit={submit}
      onClosed={reset}
    >
      <FormField
        htmlFor="posting-requisition"
        label="Requisition"
        error={errors.requisition ?? requisitions.error?.detail}
        hint={!requisitions.isLoading && list.length === 0 ? "There are no open requisitions." : undefined}
      >
        <PostingRequisitionSelect
          id="posting-requisition"
          requisitions={list}
          value={requisitionId}
          onChange={setRequisitionId}
          placeholder={requisitions.isLoading ? "Loading…" : "Choose a requisition"}
          disabled={requisitions.isLoading}
        />
      </FormField>
      <FormField htmlFor="posting-board" label="Board" error={errors.board}>
        <Select value={board} onValueChange={setBoard}>
          <SelectTrigger id="posting-board" className="w-full">
            <SelectValue placeholder="Choose a board" />
          </SelectTrigger>
          <SelectContent>
            {boards.map((item) => (
              <SelectItem key={item} value={item}>
                {boardName(item)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
      <FormField
        htmlFor="posting-apply-url"
        label="Apply link"
        optional
        hint="Where applicants are sent. Must start with https://."
        error={errors.applyUrl}
      >
        <Input
          id="posting-apply-url"
          type="url"
          value={applyUrl}
          maxLength={1024}
          placeholder="https://"
          onChange={(event) => setApplyUrl(event.target.value)}
        />
      </FormField>
      <FormField
        htmlFor="posting-interval"
        label="Refresh every (days)"
        optional
        hint="1 to 90."
        error={errors.interval}
      >
        <Input
          id="posting-interval"
          type="number"
          min={1}
          max={90}
          className="tabular-nums"
          value={intervalDays}
          onChange={(event) => setIntervalDays(event.target.value)}
        />
      </FormField>
    </BoardFormDialog>
  );
}
