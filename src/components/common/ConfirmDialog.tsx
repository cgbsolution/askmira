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
} from "@/components/ui/dialog";
import { Tr } from "@/lib/i18n/Tr";

/**
 * Confirmation for an action that is hard to take back.
 *
 * `onConfirm` may be async; the dialog stays open and disabled until it
 * settles, and closes only when it succeeds, so a failed action is not
 * mistaken for a done one.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => Promise<void> | void;
  children?: React.ReactNode;
}) {
  const [isBusy, setIsBusy] = useState(false);

  const confirm = async () => {
    setIsBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // The caller reports the failure (usually as a toast); the dialog stays open.
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            <Tr text={title} />
          </DialogTitle>
          {description && (
            <DialogDescription>
              {typeof description === "string" ? <Tr text={description} /> : description}
            </DialogDescription>
          )}
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button variant="outline" disabled={isBusy} onClick={() => onOpenChange(false)}>
            <Tr text={cancelLabel} />
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={isBusy}
            onClick={() => void confirm()}
          >
            {isBusy && <Loader2 className="animate-spin" />}
            <Tr text={confirmLabel} />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
