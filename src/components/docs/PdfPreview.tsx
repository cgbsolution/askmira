"use client";

import { FileText, Loader2 } from "lucide-react";
import React, { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * A PDF shown exactly as it will print, in the browser's own viewer.
 *
 * `blob` is the file the API returned; the object URL is made here and revoked
 * when the PDF changes or the frame goes away, so a letter does not stay
 * addressable after it is closed.
 */
export function PdfPreview({
  blob,
  isLoading = false,
  title,
  empty = "Press Preview to see the letter as it will print.",
  className,
}: {
  blob: Blob | null;
  isLoading?: boolean;
  title: string;
  empty?: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);

  return (
    <div
      className={cn(
        "relative flex min-h-[28rem] overflow-hidden rounded-lg border border-border bg-muted/40",
        className,
      )}
    >
      {url ? (
        <iframe
          src={`${url}#toolbar=1&navpanes=0&view=FitH`}
          title={title}
          className="h-full min-h-[28rem] w-full flex-1 bg-background"
        />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
          <FileText className="size-8" aria-hidden />
          <p>{empty}</p>
        </div>
      )}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60">
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Rendering" />
        </div>
      )}
    </div>
  );
}
