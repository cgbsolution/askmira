"use client";

import { Copy, KeyRound, Loader2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { formatDateTime } from "@/components/hiring/labels";
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
import { Input } from "@/components/ui/input";
import { ApiError, post } from "@/lib/api";

interface PortalLink {
  token: string;
  expires_at: string;
  note: string;
}

/**
 * HR: issue a candidate portal link. The link is shown once, in this dialog
 * only, and is gone when the dialog closes — it is never stored in the page.
 */
export function CandidatePortalLinkDialog({ candidateId }: { candidateId: string }) {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<{ url: string; expires_at: string; note: string } | null>(null);
  const [isIssuing, setIsIssuing] = useState(false);

  const issue = async () => {
    setIsIssuing(true);
    try {
      const result = await post<PortalLink>(`/careers/candidates/${candidateId}/portal-link`);
      setLink({
        url: `${window.location.origin}/candidate/${encodeURIComponent(result.token)}`,
        expires_at: result.expires_at,
        note: result.note,
      });
      setOpen(true);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "The link could not be issued.");
    } finally {
      setIsIssuing(false);
    }
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      toast.success("Link copied");
    } catch {
      toast.error("Copying is blocked in this browser. Select the link and copy it by hand.");
    }
  };

  return (
    <>
      <Button variant="outline" disabled={isIssuing} onClick={() => void issue()}>
        {isIssuing ? <Loader2 className="animate-spin" /> : <KeyRound />}
        Candidate portal link
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setLink(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Candidate portal link</DialogTitle>
            <DialogDescription>
              Shown once. Send it to the candidate now; it cannot be displayed again after you close this.
            </DialogDescription>
          </DialogHeader>
          {link && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input readOnly aria-label="Portal link" value={link.url} onFocus={(event) => event.target.select()} />
                <Button variant="outline" size="icon" aria-label="Copy link" onClick={() => void copy()}>
                  <Copy />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Expires {formatDateTime(link.expires_at)}</p>
              {link.note && (
                <Alert>
                  <AlertDescription>{link.note}</AlertDescription>
                </Alert>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
