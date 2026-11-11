"use client";

import { FileSignature, Loader2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ApiError, get, post } from "@/lib/api";
import type { OnboardingTask } from "@/lib/types/onboarding";

/**
 * A FORM task's statutory form: generated from the joiner's profile, then signed
 * on the letter signing page (typed name and signature against the form's
 * content hash), the same page a letter's email opens. Signing completes the task.
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

  const open = async () => {
    setBusy(true);
    try {
      let current = task;
      if (!current.form_letter_id) {
        current = await post<OnboardingTask>(`/onboarding/tasks/${task.id}/form`, {});
        onChanged(current);
      }
      if (!current.form_letter_id) {
        toast.error("The generated form could not be found. Try again.");
        return;
      }
      const { path } = await get<{ path: string }>(`/letters/${current.form_letter_id}/sign-link`);
      window.location.assign(path);
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
    </>
  );
}
