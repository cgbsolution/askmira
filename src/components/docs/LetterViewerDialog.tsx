"use client";

import { BadgeCheck, Download, ShieldAlert, ShieldCheck } from "lucide-react";
import React from "react";
import { toast } from "sonner";

import { ErrorState } from "@/components/common/ErrorState";
import { LetterPages } from "@/components/docs/LetterPages";
import { letterFileName } from "@/components/docs/letterLabels";
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
import { formatDateTime } from "@/lib/utils";
import type { IssuedLetter, LetterContent } from "@/lib/types/docs";

/**
 * An issued letter for HR, shown as its PDF prints, with its integrity check.
 * Once accepted, the pages are the signed copy (signature and date printed in).
 * Employees do not open letters here: they read and sign them from the link in
 * the letter's email.
 */
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
        ) : data && letter ? (
          <div className="grid min-w-0 gap-3">
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
            {letter.acknowledged_at ? (
              <Alert variant="success">
                <BadgeCheck />
                <AlertTitle>Signed and accepted</AlertTitle>
                <AlertDescription>
                  Accepted {formatDateTime(letter.acknowledged_at)}
                  {letter.acknowledged_name ? ` as “${letter.acknowledged_name}”` : ""}.
                  {data.showing_signed_copy ? " Showing the signed copy." : ""}
                </AlertDescription>
              </Alert>
            ) : null}
            <LetterPages
              count={data.page_count}
              pagePath={(page) => `/letters/${letter.id}/pages/${page}`}
              title={`Letter ${data.reference_number}`}
              version={data.showing_signed_copy ? 1 : 0}
              className="max-h-[60vh]"
            />
          </div>
        ) : null}
        <DialogFooter>
          {letter?.has_signed_pdf && (
            <Button variant="outline" onClick={() => void download(true)}>
              <Download /> Signed copy
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
