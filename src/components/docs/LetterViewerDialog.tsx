"use client";

import { BadgeCheck, Download, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { ErrorState } from "@/components/common/ErrorState";
import { FormField } from "@/components/common/FormField";
import { letterFileName } from "@/components/docs/letterLabels";
import { SandboxedHtml } from "@/components/docs/SandboxedHtml";
import { apiMessage } from "@/components/people/labels";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { downloadFile, post } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import type { IssuedLetter, LetterContent } from "@/lib/types/docs";

/** An issued letter, read-only, in a sandboxed frame — with its integrity check. */
export function LetterViewerDialog({
  letter,
  onOpenChange,
  onAcknowledged,
}: {
  letter: IssuedLetter | null;
  onOpenChange: (open: boolean) => void;
  /** Called after the employee accepts the letter in the portal. */
  onAcknowledged?: (letter: IssuedLetter) => void;
}) {
  const { data, error, isLoading, reload } = useApiQuery<LetterContent>(
    letter ? `/letters/${letter.id}/content` : null,
  );

  const download = async (signed: boolean) => {
    if (!letter) return;
    try {
      await downloadFile(
        `/letters/${letter.id}/pdf${signed ? "?signed=true" : ""}`,
        letterFileName(letter.reference_number, signed),
      );
    } catch (caught) {
      toast.error(apiMessage(caught, "The PDF could not be downloaded."));
    }
  };

  return (
    <Dialog open={letter !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{letter?.reference_number}</DialogTitle>
          <DialogDescription>
            {letter?.template_name} v{letter?.template_version} · {letter?.recipient_name}
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <Skeleton className="h-[60vh] w-full" />
        ) : error ? (
          <ErrorState message={error.detail} onRetry={reload} />
        ) : data ? (
          <div className="grid gap-3">
            {data.intact ? (
              <Alert variant="success">
                <ShieldCheck />
                <AlertTitle>Content verified</AlertTitle>
                <AlertDescription>
                  This text matches the hash recorded when the letter was issued.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <ShieldAlert />
                <AlertTitle>Content does not match its record</AlertTitle>
                <AlertDescription>
                  The stored text has changed since issuance. Do not distribute this letter.
                </AlertDescription>
              </Alert>
            )}
            <SandboxedHtml html={data.merged_html} title={`Letter ${data.reference_number}`} />
            {letter?.acknowledged_at ? (
              <Alert variant="success">
                <BadgeCheck />
                <AlertTitle>Acknowledged</AlertTitle>
                <AlertDescription>
                  Accepted {formatDateTime(letter.acknowledged_at)}
                  {letter.acknowledged_name ? ` as “${letter.acknowledged_name}”` : ""}.
                </AlertDescription>
              </Alert>
            ) : (
              letter?.can_acknowledge &&
              data.intact && (
                <AcknowledgeForm key={letter.id} letter={letter} onAcknowledged={onAcknowledged} />
              )
            )}
          </div>
        ) : null}
        <DialogFooter>
          {letter?.has_signed_pdf && (
            <Button variant="outline" onClick={() => void download(true)}>
              <Download /> Signed PDF
            </Button>
          )}
          <Button onClick={() => void download(false)} disabled={!data?.intact}>
            <Download /> Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The employee's in-portal acceptance: tick, type your name, accept. Separate
 * from e-signature; the server records the time, the address and the letter's
 * content hash with it.
 */
function AcknowledgeForm({
  letter,
  onAcknowledged,
}: {
  letter: IssuedLetter;
  onAcknowledged?: (letter: IssuedLetter) => void;
}) {
  const { user } = useAuth();
  const [agreed, setAgreed] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      const updated = await post<IssuedLetter>(`/letters/${letter.id}/acknowledge`, {
        typed_name: typed.trim(),
        accept: agreed,
      });
      toast.success(`${letter.reference_number} acknowledged`);
      onAcknowledged?.(updated);
    } catch (caught) {
      setError(apiMessage(caught, "The letter could not be acknowledged."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-3 rounded-lg border border-border bg-muted/40 p-4">
      <div>
        <p className="text-sm font-medium text-foreground">Accept & acknowledge</p>
        <p className="text-xs text-muted-foreground">
          {letter.acknowledgement_requested_at
            ? "HR has asked you to read and accept this letter. "
            : ""}
          Your acceptance is recorded with the time and a fingerprint of this exact text.
        </p>
      </div>
      <div className="flex items-start gap-2">
        <Checkbox
          id={`ack-agree-${letter.id}`}
          checked={agreed}
          onCheckedChange={(value) => setAgreed(value === true)}
        />
        <Label htmlFor={`ack-agree-${letter.id}`} className="text-sm font-normal leading-snug">
          I have read this letter and I accept it.
        </Label>
      </div>
      <FormField
        htmlFor={`ack-name-${letter.id}`}
        label="Type your full name"
        hint={user?.full_name ? `As on your record, for example “${user.full_name}”.` : undefined}
        error={error}
      >
        <Input
          id={`ack-name-${letter.id}`}
          autoComplete="name"
          maxLength={255}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
        />
      </FormField>
      <div>
        <Button disabled={!agreed || !typed.trim() || busy} onClick={() => void accept()}>
          {busy ? <Loader2 className="animate-spin" /> : <BadgeCheck />} Accept & acknowledge
        </Button>
      </div>
    </div>
  );
}
