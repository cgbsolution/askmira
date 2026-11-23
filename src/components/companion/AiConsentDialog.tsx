"use client";

import { Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError, get, post } from "@/lib/api";
import type { ConsentView, PurposeState } from "@/lib/types/dpdp";

/** The privacy purpose that lets Ask Miraa use an AI model for this person. */
export const AI_PURPOSE = "ai_assistance";

/**
 * Ask the person, in the chat itself, to agree to the AI assistant purpose.
 *
 * Reading a picture needs the AI model, and DPDP needs the person's own,
 * informed yes before anything about them goes to the AI provider. Rather than
 * hiding attach and paste from everyone who has not agreed yet (most people,
 * since it is opt-in), the chat offers the choice here with the notice's own
 * words, records it exactly as My privacy does, and carries on.
 */
export function AiConsentDialog({
  open,
  onOpenChange,
  onAgreed,
  why,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once the yes is recorded. */
  onAgreed: () => void;
  /** What the person was doing, said first ("To read a picture…"). */
  why?: string;
}) {
  const [purpose, setPurpose] = useState<PurposeState | null>(null);
  const [saving, setSaving] = useState(false);

  // The notice's current words, from the same place My privacy reads them.
  useEffect(() => {
    if (!open || purpose) return;
    let live = true;
    get<ConsentView>("/dpdp/me/consent")
      .then((view) => {
        if (live) setPurpose(view.purposes.find((row) => row.purpose === AI_PURPOSE) ?? null);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [open, purpose]);

  const agree = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await post("/dpdp/me/consent", { purpose_key: AI_PURPOSE, granted: true });
      toast.success(`Recorded: you agreed to "${purpose?.name ?? "AI assistant"}".`);
      onOpenChange(false);
      onAgreed();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "Could not record your choice.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5" /> Turn on the AI assistant?
          </DialogTitle>
          <DialogDescription>
            {why ?? "Free-form questions need the AI assistant."} You have not agreed to it yet.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 text-sm leading-6">
          <p>
            {purpose?.description ??
              "Answering your questions and drafting for you using an AI model. To do that, the parts of your record relevant to your question are sent to our AI provider, which processes them outside India."}
          </p>
          <p className="text-muted-foreground">
            A picture or PDF you attach is read once and not kept. You can withdraw any time under{" "}
            <Link href="/compliance/privacy" className="underline underline-offset-2">
              My privacy
            </Link>
            .
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
            Not now
          </Button>
          <Button disabled={saving} onClick={() => void agree()}>
            {saving ? <Loader2 className="animate-spin" /> : null} I agree
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
