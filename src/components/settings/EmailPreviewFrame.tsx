"use client";

import { Loader2, Monitor, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { post } from "@/lib/api";
import type { EmailDesignInput, EmailPreview } from "@/lib/types/notifications";
import { cn } from "@/lib/utils";

import { errorDetail } from "./settingsShared";

/**
 * The email exactly as the server will send it, with sample values in place of
 * the placeholders. Rendered in a sandboxed frame: no script runs and no link
 * opens from inside the preview.
 */
export function EmailPreviewFrame({
  eventKey,
  subject,
  body,
  branding,
  className,
}: {
  eventKey: string | null;
  subject: string;
  body: string;
  /** Unsaved design choices to preview; omitted, the saved design is used. */
  branding?: EmailDesignInput;
  className?: string;
}) {
  const [preview, setPreview] = useState<EmailPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const brandingKey = JSON.stringify(branding ?? null);

  useEffect(() => {
    if (!body.trim()) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      setBusy(true);
      post<EmailPreview>("/notifications/admin/emails/preview", {
        event_key: eventKey,
        subject,
        body,
        branding: brandingKey === "null" ? null : JSON.parse(brandingKey),
      })
        .then((result) => {
          if (cancelled) return;
          setPreview(result);
          setError(null);
        })
        .catch((caught) => !cancelled && setError(errorDetail(caught, "The preview could not be drawn.")))
        .finally(() => !cancelled && setBusy(false));
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [eventKey, subject, body, brandingKey]);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">
          Preview {busy ? <Loader2 className="ml-1 inline size-3.5 animate-spin text-muted-foreground" /> : null}
        </p>
        <div className="flex gap-1">
          <Button
            type="button"
            size="icon"
            variant={narrow ? "ghost" : "secondary"}
            aria-label="Desktop width"
            onClick={() => setNarrow(false)}
          >
            <Monitor />
          </Button>
          <Button
            type="button"
            size="icon"
            variant={narrow ? "secondary" : "ghost"}
            aria-label="Phone width"
            onClick={() => setNarrow(true)}
          >
            <Smartphone />
          </Button>
        </div>
      </div>
      {preview ? (
        <p className="truncate text-xs text-muted-foreground">
          Subject: <span className="font-medium text-foreground">{preview.subject}</span>
        </p>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex min-h-[420px] flex-1 justify-center overflow-hidden rounded-lg border border-border bg-muted/40">
        {preview ? (
          <iframe
            title="Email preview"
            sandbox=""
            srcDoc={preview.html}
            className={cn("h-[560px] w-full bg-card transition-[max-width]", narrow ? "max-w-[380px]" : "max-w-full")}
          />
        ) : (
          <div className="w-full space-y-3 p-6">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-48 w-full" />
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Sample values stand in for the placeholders. A placeholder the preview does not know shows
        as ‹its name›.
      </p>
    </div>
  );
}
