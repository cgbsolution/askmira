"use client";

import { AlertTriangle, ArrowRightLeft, ChevronDown, Loader2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { CANDIDATE_STAGE } from "@/components/hiring/labels";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, post } from "@/lib/api";
import type { CandidateStage, StageMoveResult } from "@/lib/types/hiring";

const CLOSED: CandidateStage[] = ["rejected", "withdrawn"];

function stageLabel(stage: CandidateStage): string {
  return CANDIDATE_STAGE[stage]?.[0] ?? stage;
}

/** Whether the API will insist on a reason for this move. */
export function moveNeedsReason(from: CandidateStage, to: CandidateStage): boolean {
  return CLOSED.includes(to) || CLOSED.includes(from);
}

/**
 * Confirm one pipeline move. A reason is required for rejecting, withdrawing
 * or reopening. A refusal (outstanding interview feedback, a disallowed move)
 * is shown in the dialog exactly as the API worded it.
 */
export function CandidateStageMoveDialog({
  candidate,
  target,
  onOpenChange,
  onMoved,
}: {
  candidate: { id: string; full_name: string; stage: CandidateStage };
  /** The stage to move to; `null` keeps the dialog closed. */
  target: CandidateStage | null;
  onOpenChange: (open: boolean) => void;
  onMoved: (result: StageMoveResult) => void;
}) {
  const [reason, setReason] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (target) {
      setReason("");
      setFieldError(null);
      setApiError(null);
    }
  }, [target]);

  const needsReason = target ? moveNeedsReason(candidate.stage, target) : false;

  const save = async () => {
    if (!target) return;
    if (needsReason && !reason.trim()) {
      setFieldError("A reason is required for this move; it stays on the candidate's history.");
      return;
    }
    setIsSaving(true);
    setApiError(null);
    try {
      const result = await post<StageMoveResult>(`/hiring/candidates/${candidate.id}/stage`, {
        to_stage: target,
        reason: reason.trim() || undefined,
      });
      toast.success(`${candidate.full_name} moved to ${stageLabel(result.to_stage)}`);
      onOpenChange(false);
      onMoved(result);
    } catch (caught) {
      const message = caught instanceof ApiError ? caught.detail : "The move could not be saved.";
      setApiError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={target !== null} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Move {candidate.full_name} to {target ? stageLabel(target) : ""}
          </DialogTitle>
          <DialogDescription>
            From {stageLabel(candidate.stage)}. The move is recorded in the candidate&apos;s history.
          </DialogDescription>
        </DialogHeader>
        {apiError && (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertDescription>{apiError}</AlertDescription>
          </Alert>
        )}
        <FormField
          htmlFor={`move-reason-${candidate.id}`}
          label="Reason"
          optional={!needsReason}
          error={fieldError}
        >
          <Textarea
            id={`move-reason-${candidate.id}`}
            rows={3}
            maxLength={2000}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              if (fieldError) setFieldError(null);
            }}
          />
        </FormField>
        <DialogFooter>
          <Button variant="outline" disabled={isSaving} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={target && CLOSED.includes(target) ? "destructive" : "default"}
            disabled={isSaving}
            onClick={() => void save()}
          >
            {isSaving && <Loader2 className="animate-spin" />}
            Move
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The "Move" menu for one candidate: only the moves the API listed as allowed,
 * each confirmed in {@link CandidateStageMoveDialog}.
 */
export function CandidateMoveMenu({
  candidate,
  allowedMoves,
  onMoved,
  size = "sm",
  variant = "outline",
}: {
  candidate: { id: string; full_name: string; stage: CandidateStage };
  allowedMoves: CandidateStage[];
  onMoved: (result: StageMoveResult) => void;
  size?: "sm" | "default";
  variant?: "outline" | "default" | "ghost";
}) {
  const [target, setTarget] = useState<CandidateStage | null>(null);
  const forward = allowedMoves.filter((stage) => !CLOSED.includes(stage));
  const closing = allowedMoves.filter((stage) => CLOSED.includes(stage));

  if (allowedMoves.length === 0) {
    return (
      <Button size={size} variant={variant} disabled title="No manual moves from this stage">
        <ArrowRightLeft /> Move
      </Button>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size={size} variant={variant} aria-label={`Move ${candidate.full_name}`}>
            <ArrowRightLeft /> Move <ChevronDown className="size-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Move to</DropdownMenuLabel>
          {forward.map((stage) => (
            <DropdownMenuItem key={stage} onSelect={() => setTarget(stage)}>
              {stageLabel(stage)}
            </DropdownMenuItem>
          ))}
          {forward.length > 0 && closing.length > 0 && <DropdownMenuSeparator />}
          {closing.map((stage) => (
            <DropdownMenuItem
              key={stage}
              variant="destructive"
              onSelect={() => setTarget(stage)}
            >
              {stageLabel(stage)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <CandidateStageMoveDialog
        candidate={candidate}
        target={target}
        onOpenChange={(open) => !open && setTarget(null)}
        onMoved={onMoved}
      />
    </>
  );
}
