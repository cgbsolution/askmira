"use client";

import { Download, FileText, Loader2 } from "lucide-react";
import React, { useEffect, useState } from "react";

import { apiMessage } from "@/components/people/labels";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetchFile } from "@/lib/api";

/**
 * A vault document shown in place: PDFs in the browser's viewer, images as
 * they are, anything else with a prompt to download it instead.
 *
 * The object URL is revoked when the dialog closes, so the file does not stay
 * addressable in the page.
 */
export function DocumentViewerDialog({
  document,
  onOpenChange,
  onDownload,
}: {
  document: { id: string | number; title: string } | null;
  onOpenChange: (open: boolean) => void;
  onDownload: () => void;
}) {
  const [file, setFile] = useState<{ url: string; type: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const id = document?.id;

  useEffect(() => {
    if (id === undefined) return;
    let url: string | null = null;
    let cancelled = false;
    setFile(null);
    setError(null);
    fetchFile(`/documents/${id}/download`)
      .then(({ blob }) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setFile({ url, type: blob.type });
      })
      .catch((caught) => {
        if (!cancelled) setError(apiMessage(caught, "The document could not be opened."));
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);

  const isPdf = file?.type === "application/pdf";
  const isImage = file?.type.startsWith("image/") ?? false;

  return (
    <Dialog open={document !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{document?.title}</DialogTitle>
          <DialogDescription>Preview of the uploaded file.</DialogDescription>
        </DialogHeader>
        <div className="flex h-[70vh] overflow-hidden rounded-lg border border-border bg-muted/40">
          {error ? (
            <Message>{error}</Message>
          ) : !file ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Loading" />
            </div>
          ) : isPdf ? (
            <iframe
              src={`${file.url}#toolbar=1&navpanes=0&view=FitH`}
              title={document?.title ?? "Document"}
              className="h-full w-full flex-1 bg-background"
            />
          ) : isImage ? (
            <div className="flex flex-1 items-center justify-center overflow-auto p-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL, not an optimisable asset */}
              <img src={file.url} alt={document?.title ?? "Document"} className="max-h-full max-w-full object-contain" />
            </div>
          ) : (
            <Message>This file type cannot be previewed here. Download it to open it.</Message>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onDownload}>
            <Download /> Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
      <FileText className="size-8" aria-hidden />
      <p>{children}</p>
    </div>
  );
}
