"use client";

import { Check, Copy, Loader2, Share2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { safeHref } from "@/components/hiring/labels";
import {
  ReferralChannelSelect,
  ReferralProgrammeSelect,
} from "@/components/hiring/ReferralChannelSelect";
import { ReferralShareTerms } from "@/components/hiring/ReferralProgrammeTerms";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { ApiError, get } from "@/lib/api";
import type { OpenRole, ReferralProgramme, ShareChannel, ShareLinkResult } from "@/lib/types/hiring";

/** Where the tracked link points: this page on an https origin, else a site-relative path. */
function shareBaseUrl(): string {
  if (typeof window !== "undefined" && window.location.origin.startsWith("https://")) {
    return `${window.location.origin}/hiring/referrals`;
  }
  return "/hiring/referrals";
}

/**
 * A tracked referral link for one role, carrying the viewer's own name, with
 * the programme's terms beside it. Sharing needs an employee record, because
 * the referrer on the link is an employee.
 */
export function ReferralShareDialog({
  role,
  programmes,
}: {
  role: OpenRole;
  programmes: ReferralProgramme[];
}) {
  const { user } = useAuth();
  const employeeId = user?.employee_id ?? null;
  const single = programmes.length === 1 ? programmes[0].id : "";
  const [open, setOpen] = useState(false);
  const [programmeId, setProgrammeId] = useState(single);
  const [channel, setChannel] = useState<ShareChannel>("copy");
  const [result, setResult] = useState<ShareLinkResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !employeeId || !programmeId) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setCopied(false);
    const params = new URLSearchParams({
      programme_id: programmeId,
      requisition_id: role.id,
      referrer_employee_id: employeeId,
      channel,
      base_url: shareBaseUrl(),
    });
    get<ShareLinkResult>(`/recruiting/share-link?${params.toString()}`)
      .then((next) => {
        if (!cancelled) setResult(next);
      })
      .catch((caught) => {
        if (cancelled) return;
        setResult(null);
        setError(caught instanceof ApiError ? caught.detail : "Could not make a share link.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, employeeId, programmeId, channel, role.id]);

  const url = result?.link.url ?? "";
  const absoluteUrl =
    url.startsWith("/") && typeof window !== "undefined" ? `${window.location.origin}${url}` : url;
  const encoded = encodeURIComponent(absoluteUrl);
  const whatsapp = safeHref(`https://wa.me/?text=${encoded}`);
  const linkedin = safeHref(`https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setCopied(true);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy. Select the link and copy it by hand.");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setResult(null);
          setError(null);
          setCopied(false);
          setProgrammeId(single);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Share2 /> Share
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share {role.title}</DialogTitle>
          <DialogDescription>
            The link carries your name, so an application through it counts as your referral.
          </DialogDescription>
        </DialogHeader>

        {!employeeId ? (
          <Alert variant="warning">
            <AlertDescription>
              Sharing needs an employee record linked to your account, and yours has none. Ask HR
              to link your user to your employee profile.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="grid gap-4">
            {programmes.length > 1 && (
              <FormField htmlFor="share-programme" label="Programme">
                <ReferralProgrammeSelect
                  id="share-programme"
                  programmes={programmes}
                  value={programmeId}
                  onChange={setProgrammeId}
                />
              </FormField>
            )}
            <FormField htmlFor="share-channel" label="Where you will share it">
              <ReferralChannelSelect
                id="share-channel"
                value={channel}
                onChange={(next) => next !== "none" && setChannel(next)}
              />
            </FormField>

            {isLoading && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Making your link…
              </p>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {result && !isLoading && (
              <>
                <FormField htmlFor="share-url" label="Your link">
                  <div className="flex gap-2">
                    <Input id="share-url" readOnly value={absoluteUrl} onFocus={(e) => e.target.select()} />
                    <Button type="button" variant="outline" onClick={() => void copy()}>
                      {copied ? <Check /> : <Copy />} Copy
                    </Button>
                  </div>
                </FormField>
                <div className="flex flex-wrap gap-2">
                  {whatsapp && (
                    <Button asChild variant="secondary" size="sm">
                      <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                        Share on WhatsApp
                      </a>
                    </Button>
                  )}
                  {linkedin && (
                    <Button asChild variant="secondary" size="sm">
                      <a href={linkedin} target="_blank" rel="noopener noreferrer">
                        Share on LinkedIn
                      </a>
                    </Button>
                  )}
                </div>
                <ReferralShareTerms terms={result.terms} />
              </>
            )}
            {!programmeId && (
              <p className="text-sm text-muted-foreground">Choose a programme to make a link.</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
