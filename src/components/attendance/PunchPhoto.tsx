"use client";

import { Camera, Loader2 } from "lucide-react";
import Image from "next/image";
import React, { useEffect, useState } from "react";

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
import { fetchFile } from "@/lib/api";
import type { Punch } from "@/lib/types/attendance";

import { errorDetail, formatClock } from "./shared";

/**
 * The photo taken with a punch, opened on demand. Fetched only when the dialog
 * opens and released when it closes, so the face is not held in the page.
 * The API serves it to the person, their reporting line and HR only.
 */
export function PunchPhoto({ punch }: { punch: Punch }) {
  if (!punch.has_photo) return null;
  return (
    <PhotoButton
      path={`/attendance/punches/${punch.id}/photo`}
      title={`Punch ${punch.direction} at ${formatClock(punch.punched_at)}`}
      description="Taken on the punch screen. Nothing checks the face; look at it yourself."
      alt={`Photo taken with the ${punch.direction} punch`}
    />
  );
}

/** A "Photo" link that opens a private photo from the API in a dialog. */
export function PhotoButton({
  path,
  title,
  description,
  alt,
  label = "Photo",
}: {
  path: string;
  title: string;
  description: string;
  alt: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    setProblem(null);
    fetchFile(path)
      .then(({ blob }) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((caught) => {
        if (!cancelled) setProblem(errorDetail(caught, "The photo could not be opened."));
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setUrl(null);
    };
  }, [open, path]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="link" className="h-auto p-0 text-xs">
          <Camera className="size-3" /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {problem ? (
          <Alert variant="destructive">
            <AlertDescription>{problem}</AlertDescription>
          </Alert>
        ) : url ? (
          <Image
            src={url}
            alt={alt}
            width={640}
            height={640}
            unoptimized
            className="h-auto max-h-[60vh] w-full rounded-md object-contain"
          />
        ) : (
          <div className="flex h-48 items-center justify-center text-muted-foreground">
            <Loader2 className="animate-spin" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
