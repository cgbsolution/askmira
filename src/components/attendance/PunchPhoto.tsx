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
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    setProblem(null);
    fetchFile(`/attendance/punches/${punch.id}/photo`)
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
  }, [open, punch.id]);

  if (!punch.has_photo) return null;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="link" className="h-auto p-0 text-xs">
          <Camera className="size-3" /> Photo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Punch {punch.direction} at {formatClock(punch.punched_at)}
          </DialogTitle>
          <DialogDescription>
            Taken on the punch screen. Nothing checks the face; look at it yourself.
          </DialogDescription>
        </DialogHeader>
        {problem ? (
          <Alert variant="destructive">
            <AlertDescription>{problem}</AlertDescription>
          </Alert>
        ) : url ? (
          <Image
            src={url}
            alt={`Photo taken with the ${punch.direction} punch`}
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
