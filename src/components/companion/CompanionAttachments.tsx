"use client";

import { CheckCircle2, FileText, ImageIcon, Loader2, Plug, RefreshCw, Settings2, X } from "lucide-react";
import Link from "next/link";
import React, { useCallback, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useUploadLimit } from "@/hooks/useUploadLimit";
import { ApiError, post } from "@/lib/api";
import { shrinkPhoto, sizeLabel } from "@/lib/uploads";
import { cn } from "@/lib/utils";

import type { CompanionAttachmentCard, CompanionConnectCard } from "./types";

/** Files on one message: the server holds the same limit. */
export const MAX_FILES = 3;
/** What Ask Miraa reads: pictures and PDFs. */
export const FILE_TYPES = ["image/png", "image/jpeg", "application/pdf"];
export const FILE_ACCEPT = FILE_TYPES.join(",");

/** Each product's own name, for what is said once it is connected. */
export const PRODUCT_BRANDS: Record<string, string> = {
  interview: "AnytimeHire",
  expense: "ExpenseGenie",
  helpdesk: "CGB Helpdesk",
  saleinx: "Saleinx",
  procurement: "ProcureFlow",
  finance: "Finance",
};

function typeOf(file: File): string {
  if (file.type) return file.type === "image/jpg" ? "image/jpeg" : file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  return "";
}

/**
 * The files waiting to go with the next message: picked, pasted or dropped.
 * Each is checked as it comes (type, the workspace's size limit, at most three),
 * and a photo is shrunk first; a refused file is said at once and never kept.
 */
export function useDraftFiles() {
  const limit = useUploadLimit();
  const [files, setFiles] = useState<File[]>([]);
  const [preparing, setPreparing] = useState(false);

  const add = useCallback(
    async (incoming: File[]) => {
      if (incoming.length === 0) return;
      const room = MAX_FILES - files.length;
      if (room <= 0) {
        toast.error(`Attach up to ${MAX_FILES} files to one message.`);
        return;
      }
      const wanted = incoming.filter((file) => {
        if (FILE_TYPES.includes(typeOf(file))) return true;
        toast.error(`“${file.name}” can't be read here. Attach a picture (PNG or JPEG) or a PDF.`);
        return false;
      });
      if (wanted.length > room) {
        toast.error(`Attach up to ${MAX_FILES} files to one message. The first ${room} were kept.`);
      }
      setPreparing(true);
      try {
        const ready: File[] = [];
        for (const original of wanted.slice(0, room)) {
          // A pasted screenshot arrives as "image.png": give it a name worth showing.
          const named =
            original.name === "image.png" || !original.name
              ? new File([original], `screenshot-${new Date().toISOString().slice(11, 19).replace(/:/g, "")}.png`, {
                  type: typeOf(original) || "image/png",
                })
              : original;
          const shrunk = await shrinkPhoto(named);
          const problem = limit.check(shrunk);
          if (problem) {
            toast.error(problem);
            continue;
          }
          ready.push(shrunk);
        }
        if (ready.length > 0) setFiles((current) => [...current, ...ready].slice(0, MAX_FILES));
      } finally {
        setPreparing(false);
      }
    },
    [files.length, limit],
  );

  const remove = useCallback((index: number) => {
    setFiles((current) => current.filter((_, i) => i !== index));
  }, []);

  const clear = useCallback(() => setFiles([]), []);

  return { files, setFiles, add, remove, clear, preparing, limitLabel: limit.label };
}

/** A file about to be sent, with a button to take it off the message. */
export function DraftFileChip({
  file,
  onRemove,
  disabled = false,
}: {
  file: File;
  onRemove?: () => void;
  disabled?: boolean;
}) {
  const pdf = typeOf(file) === "application/pdf";
  const Icon = pdf ? FileText : ImageIcon;
  return (
    <span className="inline-flex max-w-full items-center gap-2 rounded-lg border bg-card py-1 pr-1 pl-2.5 text-xs">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 truncate font-medium">{file.name}</span>
      <span className="shrink-0 text-muted-foreground">{sizeLabel(file.size)}</span>
      {onRemove ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6 shrink-0"
          aria-label={`Remove ${file.name}`}
          disabled={disabled}
          onClick={onRemove}
        >
          <X className="size-3.5" />
        </Button>
      ) : null}
    </span>
  );
}

/** A file on the person's own message: its name, what it was read as, and any note. */
export function AttachmentChip({ card }: { card: CompanionAttachmentCard }) {
  const Icon = card.media === "pdf" ? FileText : ImageIcon;
  return (
    <span className="grid max-w-full gap-0.5 rounded-lg border bg-card px-2.5 py-1.5 text-xs">
      <span className="flex min-w-0 items-center gap-2">
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 truncate font-medium">{card.name}</span>
        <span className={cn("shrink-0", card.read === "none" ? "text-destructive" : "text-muted-foreground")}>
          {card.label}
          {card.media === "pdf" && card.pages > 1 ? ` · ${card.pages} pages` : ""}
        </span>
      </span>
      {card.note ? <span className="text-muted-foreground">{card.note}</span> : null}
    </span>
  );
}

/**
 * A product that isn't ready for the person yet, and what to do. An admin
 * connects it from here (the product's own Allow page, then straight back to
 * this conversation) or syncs people after a member was invited there.
 */
export function ConnectCard({
  card,
  conversationId,
}: {
  card: CompanionConnectCard;
  conversationId?: string | null;
}) {
  const [busy, setBusy] = useState<"connect" | "sync" | null>(null);

  const connect = async () => {
    setBusy("connect");
    try {
      const back = conversationId ? `/ask-mira?c=${conversationId}` : "/ask-mira";
      // The product sends the admin back to Connectors' callback, which returns them here.
      const { authorize_url } = await post<{ authorize_url: string }>(`/connectors/${card.product}/start`, {
        back,
      });
      window.location.assign(authorize_url);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "Could not start connecting.");
      setBusy(null);
    }
  };

  const sync = async () => {
    setBusy("sync");
    try {
      const result = await post<{ last_error: string | null }>(`/connectors/${card.product}/sync`);
      if (result.last_error) toast.warning(`People sync failed: ${result.last_error}`);
      else toast.success(`People synced with ${card.brand}. Ask me again to carry on.`);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "Could not sync.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-3 rounded-lg border bg-card p-3">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          {card.state === "ready" ? (
            <CheckCircle2 className="size-4 text-muted-foreground" />
          ) : (
            <Plug className="size-4 text-muted-foreground" />
          )}
        </span>
        <div className="grid min-w-0 gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{card.title}</p>
            <Badge variant="outline">{card.brand}</Badge>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">{card.text}</p>
        </div>
      </div>
      {card.action ? (
        <div className="flex flex-wrap gap-2">
          {card.action === "connect" ? (
            <Button onClick={() => void connect()} disabled={busy !== null}>
              {busy === "connect" ? <Loader2 className="animate-spin" /> : <Plug />} Connect {card.brand}
            </Button>
          ) : (
            <Button onClick={() => void sync()} disabled={busy !== null}>
              {busy === "sync" ? <Loader2 className="animate-spin" /> : <RefreshCw />} Sync people
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href="/settings/connectors">
              <Settings2 /> Open Connectors
            </Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
