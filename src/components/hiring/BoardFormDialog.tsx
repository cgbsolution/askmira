"use client";

import { Loader2 } from "lucide-react";
import React, { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * The form dialog frame shared by the job-board, referral, analytics and
 * careers-site screens: trigger, title, fields, Cancel / submit.
 *
 * `onSubmit` runs the caller's validation and request. It returns `true` when
 * the dialog should close; anything else keeps it open (a validation miss or a
 * refused request the caller has already reported). The submit button is
 * disabled with a spinner while it runs.
 */
export function BoardFormDialog({
  trigger,
  title,
  description,
  submitLabel,
  submitVariant = "default",
  onSubmit,
  onClosed,
  className,
  children,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  submitLabel: string;
  submitVariant?: "default" | "destructive" | "accent";
  onSubmit: () => Promise<boolean>;
  /** Called after the dialog closes, to reset the form. */
  onClosed?: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const change = (next: boolean) => {
    if (isPending) return;
    setOpen(next);
    if (!next) onClosed?.();
  };

  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setIsPending(true);
    let done = false;
    try {
      done = await onSubmit();
    } finally {
      setIsPending(false);
    }
    if (done) {
      setOpen(false);
      onClosed?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className={cn("max-h-[90vh] overflow-y-auto sm:max-w-lg", className)}>
        <form onSubmit={(event) => void submit(event)} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <div className="grid gap-4">{children}</div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isPending} onClick={() => change(false)}>
              Cancel
            </Button>
            <Button type="submit" variant={submitVariant} disabled={isPending}>
              {isPending && <Loader2 className="animate-spin" />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
