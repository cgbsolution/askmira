"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError } from "@/lib/api";

/**
 * A small form in a dialog for one hiring action (record a decline, cancel an
 * interview, convert an offer…). Used by the offer and interview screens alike.
 *
 * `validate` runs first and blocks the request with its message; `onSubmit`
 * does the request. The dialog closes only when the request succeeds — a
 * server refusal is shown verbatim and the form stays open with what was typed.
 */
export function ActionDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  destructive = false,
  wide = false,
  validate,
  onSubmit,
  errorFallback = "That could not be saved.",
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  submitLabel: string;
  destructive?: boolean;
  wide?: boolean;
  validate?: () => string | null;
  onSubmit: () => Promise<void>;
  errorFallback?: string;
  children?: React.ReactNode;
}) {
  const [isPending, setIsPending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const submit = async () => {
    const message = validate?.() ?? null;
    setProblem(message);
    if (message) return;
    setIsPending(true);
    try {
      await onSubmit();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.detail : errorFallback);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isPending) return;
        if (!next) setProblem(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className={wide ? "sm:max-w-2xl" : "sm:max-w-lg"}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form
          id={`action-${title.replace(/\W+/g, "-").toLowerCase()}`}
          className="grid max-h-[65vh] gap-4 overflow-y-auto pr-1"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {children}
          {problem && (
            <Alert variant="destructive">
              <AlertTriangle />
              <AlertDescription>{problem}</AlertDescription>
            </Alert>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" disabled={isPending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={isPending}
            onClick={() => void submit()}
          >
            {isPending && <Loader2 className="animate-spin" />}
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
