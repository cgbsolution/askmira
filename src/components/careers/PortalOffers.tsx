"use client";

import { CheckCircle2, FileSignature, Loader2, XCircle } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { usePublicQuery } from "@/components/careers/usePublicQuery";
import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import { SandboxedHtml } from "@/components/docs/SandboxedHtml";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, post } from "@/lib/api";
import { formatDay } from "@/lib/utils";

interface PortalOffer {
  id: string;
  code: string;
  designation: string;
  ctc_annual: string;
  currency: string;
  joining_date: string;
  valid_until: string | null;
  status: "released" | "accepted" | "declined";
  has_letter: boolean;
  can_respond: boolean;
  responded_at: string | null;
}

interface PortalLetter {
  reference_number: string;
  html: string;
  content_hash: string;
}

/** The candidate's offers: read the letter, then accept by typing their name, or decline. */
export function PortalOffers({ token, candidateName }: { token: string; candidateName: string }) {
  const base = `/public/candidate/${encodeURIComponent(token)}/offers`;
  const offers = usePublicQuery<PortalOffer[]>(base);
  const [open, setOpen] = useState<PortalOffer | null>(null);

  const rows = offers.data ?? [];
  if (rows.length === 0) return null;

  return (
    <Card tier="tier2">
      <CardHeader>
        <CardTitle>Your offer</CardTitle>
        <CardDescription>
          Read the letter, then accept it by typing your name, or decline it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {rows.map((offer) => (
            <li key={offer.id} className="space-y-2 rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-foreground">{offer.designation}</p>
                {offer.status === "accepted" && (
                  <Badge variant="success">
                    <CheckCircle2 /> Accepted
                  </Badge>
                )}
                {offer.status === "declined" && <Badge variant="muted">Declined</Badge>}
                {offer.status === "released" && !offer.can_respond && (
                  <Badge variant="warning">Lapsed</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                <Money value={offer.ctc_annual} /> a year · joining {formatDay(offer.joining_date, true)}
                {offer.valid_until && offer.status === "released"
                  ? ` · answer by ${formatDay(offer.valid_until, true)}`
                  : ""}
              </p>
              {offer.has_letter && (
                <Button size="sm" variant={offer.can_respond ? "default" : "outline"} onClick={() => setOpen(offer)}>
                  <FileSignature />
                  {offer.can_respond ? "Read and respond" : "Read the letter"}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
      <OfferDialog
        base={base}
        offer={open}
        candidateName={candidateName}
        onClose={() => setOpen(null)}
        onAnswered={offers.reload}
      />
    </Card>
  );
}

function OfferDialog({
  base,
  offer,
  candidateName,
  onClose,
  onAnswered,
}: {
  base: string;
  offer: PortalOffer | null;
  candidateName: string;
  onClose: () => void;
  onAnswered: () => void;
}) {
  const letter = usePublicQuery<PortalLetter>(offer ? `${base}/${offer.id}/letter` : null);
  const [typed, setTyped] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const respond = async (accept: boolean) => {
    if (!offer) return;
    if (accept && typed.trim().length < 2) return setError("Type your full name to accept.");
    if (!accept && reason.trim().length < 3) return setError("Tell us why, so we can learn from it.");
    setBusy(accept ? "accept" : "decline");
    setError(null);
    try {
      await post(
        `${base}/${offer.id}/respond`,
        { accept, typed_name: accept ? typed.trim() : null, reason: accept ? null : reason.trim() },
        { skipAuthRedirect: true },
      );
      toast.success(accept ? "Offer accepted. Welcome aboard!" : "Your answer has been recorded.");
      onAnswered();
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.detail : "Your answer could not be recorded.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={offer !== null} onOpenChange={(next) => !next && busy === null && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{offer?.designation}</DialogTitle>
          <DialogDescription>
            {letter.data ? `Letter ${letter.data.reference_number}` : "Loading the letter…"}
          </DialogDescription>
        </DialogHeader>
        {letter.data && <SandboxedHtml html={letter.data.html} title="Offer letter" />}
        {letter.error && <p className="text-sm text-destructive">{letter.error.detail}</p>}
        {offer?.can_respond && (
          <Tabs defaultValue="accept">
            <TabsList>
              <TabsTrigger value="accept">Accept</TabsTrigger>
              <TabsTrigger value="decline">Decline</TabsTrigger>
            </TabsList>
            <TabsContent value="accept" className="mt-3 grid gap-3">
              <FormField
                htmlFor="offer-name"
                label="Type your full name to accept"
                hint={`As on the offer: ${candidateName}. This records your acceptance of this exact letter.`}
              >
                <Input id="offer-name" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
              </FormField>
              <DialogFooter>
                <Button disabled={busy !== null} onClick={() => void respond(true)}>
                  {busy === "accept" ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                  Accept the offer
                </Button>
              </DialogFooter>
            </TabsContent>
            <TabsContent value="decline" className="mt-3 grid gap-3">
              <FormField htmlFor="offer-reason" label="Why are you declining?">
                <Textarea id="offer-reason" rows={2} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} />
              </FormField>
              <DialogFooter>
                <Button variant="outline" disabled={busy !== null} onClick={() => void respond(false)}>
                  {busy === "decline" ? <Loader2 className="animate-spin" /> : <XCircle />}
                  Decline the offer
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
