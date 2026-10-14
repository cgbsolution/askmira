"use client";

import { Loader2, Sparkles } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ApiError, post } from "@/lib/api";

import { aiAvailable, useAiStatus } from "./aiStatus";

/**
 * "Help me write this" in the shoutout composer (REC-04).
 *
 * Turns the notes already in the box into a draft, in place. Your colleague's
 * name is not sent; AskMira puts it in afterwards. Nothing posts until you do.
 */
export function DraftShoutoutButton({
  toEmployeeId,
  notes,
  valueCode,
  onDraft,
}: {
  toEmployeeId: string | null;
  notes: string;
  valueCode: string | null;
  onDraft: (draft: string) => void;
}) {
  const status = useAiStatus();
  const [busy, setBusy] = useState(false);

  if (!aiAvailable(status.data, "recognition_drafts") || !status.data?.my_consent) return null;

  const draft = async () => {
    if (!toEmployeeId) return;
    setBusy(true);
    try {
      const result = await post<{ draft: string }>("/culture/shoutouts/draft", {
        to_employee_id: toEmployeeId,
        notes: notes.trim(),
        value_code: valueCode,
      });
      onDraft(result.draft);
      toast.success("Draft ready. Edit it before you post.");
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "Could not draft.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={draft}
      disabled={busy || !toEmployeeId || notes.trim().length < 3}
      title="Write a few notes first; the draft replaces them."
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
      Help me write this
    </Button>
  );
}
