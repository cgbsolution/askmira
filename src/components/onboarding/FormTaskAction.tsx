"use client";

import { FileSignature, Loader2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { LetterViewerDialog } from "@/components/docs/LetterViewerDialog";
import { Button } from "@/components/ui/button";
import { ApiError, get, post } from "@/lib/api";
import type { IssuedLetter } from "@/lib/types/docs";
import type { OnboardingTask } from "@/lib/types/onboarding";

/**
 * A FORM task's statutory form: generated from the joiner's profile, then signed
 * by acknowledging it (typed name against the form's content hash). Signing
 * completes the task.
 */
export function FormTaskAction({
  task,
  onChanged,
  size = "sm",
}: {
  task: OnboardingTask;
  onChanged: (task: OnboardingTask) => void;
  size?: "sm" | "default";
}) {
  const [busy, setBusy] = useState(false);
  const [letter, setLetter] = useState<IssuedLetter | null>(null);

  const open = async () => {
    setBusy(true);
    try {
      let current = task;
      if (!current.form_letter_id) {
        current = await post<OnboardingTask>(`/onboarding/tasks/${task.id}/form`, {});
        onChanged(current);
      }
      // The joiner's own letter archive (HR gets every letter, which includes it).
      const letters = await get<IssuedLetter[]>("/letters");
      const found = letters.find((row) => row.id === current.form_letter_id) ?? null;
      if (!found) {
        toast.error("The generated form could not be found. Try again.");
        return;
      }
      setLetter(found);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "The form could not be generated.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        size={size}
        variant={task.is_overdue ? "accent" : "default"}
        disabled={busy}
        onClick={(event) => {
          event.stopPropagation();
          void open();
        }}
      >
        {busy ? <Loader2 className="animate-spin" /> : <FileSignature />}
        {task.form_letter_id ? "Review and sign" : "Generate and sign"}
      </Button>
      <LetterViewerDialog
        letter={letter}
        onOpenChange={(next) => !next && setLetter(null)}
        onAcknowledged={() => {
          setLetter(null);
          toast.success("Signed. The task is complete.");
          onChanged({ ...task, status: "done", can_complete: false });
        }}
      />
    </>
  );
}
