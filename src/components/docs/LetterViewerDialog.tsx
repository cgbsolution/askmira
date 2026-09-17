"use client";

import { Download, ShieldAlert, ShieldCheck } from "lucide-react";
import React from "react";
import { toast } from "sonner";

import { ErrorState } from "@/components/common/ErrorState";
import { letterFileName } from "@/components/docs/letterLabels";
import { SandboxedHtml } from "@/components/docs/SandboxedHtml";
import { apiMessage } from "@/components/people/labels";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/useApiQuery";
import { downloadFile } from "@/lib/api";
import type { IssuedLetter, LetterContent } from "@/lib/types/docs";

/** An issued letter, read-only, in a sandboxed frame — with its integrity check. */
export function LetterViewerDialog({
  letter,
  onOpenChange,
}: {
  letter: IssuedLetter | null;
  onOpenChange: (open: boolean) => void;
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
