"use client";

import { Check, Loader2, X } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, post } from "@/lib/api";

interface DecisionResult {
  status?: string;
  remaining_steps?: number;
}

/**
 * Approve or reject one approval step on a requisition or an offer.
 *
 * Rejecting always asks for a note, because the person who raised it needs to
 * know what to change. A refusal from the API (the caller raised it, or cannot
 * sign this step) is shown verbatim.
 */
export function ApprovalDecisionButtons({
  kind,
  id,
  code,
  onDecided,
  size = "sm",
}: {
  kind: "requisition" | "offer";
  id: string;
  code: string;
  onDecided: () => void;
  size?: "sm" | "default";
}) {
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);

  const path = kind === "requisition" ? `/hiring/requisitions/${id}/decide` : `/offers/${id}/decide`;
  const rejectWord = kind === "offer" ? "Send back" : "Reject";

  const decide = async (approve: boolean) => {
    if (!approve && !note.trim()) {
      setNoteError("Say why, so the person who raised it knows what to change.");
      return;
    }
    setBusy(approve ? "approve" : "reject");
    try {
      const result = await post<DecisionResult>(path, {
        approve,
        note: note.trim() || undefined,
      });
      const remaining = result?.remaining_steps;
      toast.success(approve ? `${code} approved` : `${code} ${kind === "offer" ? "sent back" : "rejected"}`, {
        description:
          approve && typeof remaining === "number"
            ? remaining > 0
              ? `${remaining} more approval step${remaining === 1 ? "" : "s"} to go.`
              : "That was the last approval step."
            : undefined,
      });
      setRejectOpen(false);
      setNote("");
      onDecided();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.detail : "The decision could not be recorded.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button size={size} disabled={busy !== null} onClick={() => void decide(true)}>
          {busy === "approve" ? <Loader2 className="animate-spin" /> : <Check />}
          Approve
        </Button>
        <Button
          size={size}
          variant="outline"
          disabled={busy !== null}
          onClick={() => {
            setNoteError(null);
            setRejectOpen(true);
          }}
        >
          <X /> {rejectWord}
        </Button>
      </div>

      <Dialog open={rejectOpen} onOpenChange={(next) => busy === null && setRejectOpen(next)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {rejectWord} {code}
            </DialogTitle>
            <DialogDescription>
              The note is recorded with your decision and shown to the person who raised it.
            </DialogDescription>
          </DialogHeader>
          <FormField htmlFor={`decide-note-${id}`} label="Note" error={noteError}>
            <Textarea
              id={`decide-note-${id}`}
              rows={4}
              maxLength={2000}
              value={note}
              onChange={(event) => {
                setNote(event.target.value);
                if (noteError) setNoteError(null);
              }}
            />
          </FormField>
          <DialogFooter>
            <Button variant="outline" disabled={busy !== null} onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={busy !== null} onClick={() => void decide(false)}>
              {busy === "reject" && <Loader2 className="animate-spin" />}
              {rejectWord}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
