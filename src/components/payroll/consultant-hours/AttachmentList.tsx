"use client";

import { Download, Paperclip, Trash2 } from "lucide-react";
import React from "react";
import { toast } from "sonner";

import { sizeText } from "@/components/payroll/consultant-hours/labels";
import { apiMessage } from "@/components/payroll/labels";
import { Button } from "@/components/ui/button";
import { downloadFile } from "@/lib/api";
import type { HoursEntry } from "@/lib/types/consultant-hours";

/** The files on an entry, each downloadable; removable too when `onRemove` is given. */
export function AttachmentList({
  entry,
  onRemove,
}: {
  entry: HoursEntry;
  onRemove?: (attachmentId: string) => void;
}) {
  if (entry.attachments.length === 0) {
    return <p className="text-sm text-muted-foreground">No file attached yet.</p>;
  }
  return (
    <ul className="grid gap-2">
      {entry.attachments.map((file) => (
        <li
          key={file.id}
          className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-1.5 text-sm"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Paperclip className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{file.file_name}</span>
            <span className="text-xs text-muted-foreground">{sizeText(file.size_bytes)}</span>
          </span>
          <span className="flex shrink-0 gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Download ${file.file_name}`}
              onClick={() =>
                downloadFile(`/consultant-hours/${entry.id}/attachments/${file.id}`, file.file_name).catch(
                  (caught) => toast.error(apiMessage(caught, "The file could not be downloaded.")),
                )
              }
            >
              <Download />
            </Button>
            {onRemove && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove ${file.file_name}`}
                onClick={() => onRemove(file.id)}
              >
                <Trash2 />
              </Button>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
