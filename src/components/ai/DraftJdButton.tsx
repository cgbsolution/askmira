"use client";

import { Loader2, Sparkles } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ApiError, post } from "@/lib/api";

import { aiAvailable, useAiStatus } from "./aiStatus";

/**
 * "Draft with AI" beside a requisition's job description (ATS-11).
 *
 * Sends the role's details — title, department, location, experience, skills —
 * and any notes in the box. No candidate data. The draft replaces the box's
 * text for the recruiter to edit; the published JD records it began as a draft.
 */
export function DraftJdButton({
  requisitionId,
  notes,
  onDraft,
}: {
  requisitionId: string;
  notes: string;
  onDraft: (draft: string) => void;
}) {
  const status = useAiStatus();
  const [busy, setBusy] = useState(false);

  if (!aiAvailable(status.data, "hiring_drafts")) return null;

  const draft = async () => {
    setBusy(true);
    try {
      const result = await post<{ draft: string }>(`/hiring/requisitions/${requisitionId}/jd-draft`, {
        notes: notes.trim().slice(0, 4000),
      });
      onDraft(result.draft);
      toast.success("Draft ready. Read and edit it before saving.");
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "Could not draft.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button type="button" variant="outline" size="sm" onClick={draft} disabled={busy}>
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
      Draft with AI
    </Button>
  );
}
