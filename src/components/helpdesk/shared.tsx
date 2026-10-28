"use client";

import { FileText, Loader2, Lock, Paperclip, X } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiError, downloadFile } from "@/lib/api";
import type {
  RequestKind,
  SlaState,
  TicketAttachment,
  TicketPriority,
  TicketStatus,
} from "@/lib/types/helpdesk";
import { FileInput } from "@/components/ui/file-input";

/**
 * Shared presentation for the helpdesk screens: the status vocabulary, the SLA
 * badge, attachments and the file picker. Every figure and state shown comes
 * from the API; nothing here computes a status.
 */

type Variant = "warning" | "success" | "destructive" | "muted" | "secondary" | "outline" | "accent";

export const STATUS_LABEL: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  waiting_on_employee: "Waiting on employee",
  resolved: "Resolved",
  closed: "Closed",
  cancelled: "Cancelled",
};

/** The same statuses as the employee reads them: it is waiting on *them*. */
export const MY_STATUS_LABEL: Record<TicketStatus, string> = {
  ...STATUS_LABEL,
  waiting_on_employee: "Waiting on you",
};

const STATUS_VARIANT: Record<TicketStatus, Variant> = {
  open: "outline",
  in_progress: "secondary",
  waiting_on_employee: "warning",
  resolved: "success",
  closed: "muted",
  cancelled: "muted",
};

export const PRIORITY_LABEL: Record<TicketPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

const PRIORITY_VARIANT: Record<TicketPriority, Variant> = {
  low: "muted",
  medium: "outline",
  high: "warning",
  urgent: "destructive",
};

export const REQUEST_KIND_LABEL: Record<RequestKind, string> = {
  general: "General",
  letter: "Letter",
  id_card: "ID card",
  asset: "Asset",
  it: "IT",
  payroll: "Payroll",
  policy: "Policy",
  grievance: "Grievance",
};

export const PRIORITIES: TicketPriority[] = ["low", "medium", "high", "urgent"];

export function TicketStatusBadge({
  status,
  forRequester = false,
}: {
  status: TicketStatus;
  forRequester?: boolean;
}) {
  return (
    <Badge variant={STATUS_VARIANT[status]}>
      {(forRequester ? MY_STATUS_LABEL : STATUS_LABEL)[status]}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return <Badge variant={PRIORITY_VARIANT[priority]}>{PRIORITY_LABEL[priority]}</Badge>;
}

const SLA: Record<Exclude<SlaState, "none">, [Variant, string]> = {
  on_track: ["outline", "On track"],
  due_soon: ["warning", "Due soon"],
  overdue: ["destructive", "Overdue"],
  met: ["success", "SLA met"],
  breached: ["destructive", "SLA missed"],
};

/** Where a ticket stands against its deadline, as the server computed it. */
export function SlaBadge({ state }: { state: SlaState }) {
  if (state === "none") return null;
  const [variant, label] = SLA[state];
  return <Badge variant={variant}>{label}</Badge>;
}

export function ConfidentialBadge() {
  return (
    <Badge variant="secondary">
      <Lock /> Confidential
    </Badge>
  );
}

/** The API's own words for a failure, or a fallback when there are none. */
export function errorDetail(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.detail : fallback;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** "3.5 h", or "—" when there is nothing to average. */
export function formatHours(hours: number | null): string {
  if (hours === null) return "—";
  if (hours >= 48) return `${(hours / 24).toFixed(1)} days`;
  return `${hours.toFixed(1)} h`;
}

/** "in 5 h" / "3 h ago", for a deadline. Rounded, never a countdown. */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const diff = new Date(iso).getTime() - now;
  const abs = Math.abs(diff);
  const hours = Math.round(abs / 3_600_000);
  const text =
    abs < 3_600_000
      ? `${Math.max(1, Math.round(abs / 60_000))} min`
      : hours < 48
        ? `${hours} h`
        : `${Math.round(hours / 24)} days`;
  return diff >= 0 ? `in ${text}` : `${text} ago`;
}

/** Download a ticket's file through the API (never a direct link). */
export function AttachmentChip({ attachment }: { attachment: TicketAttachment }) {
  const [isBusy, setIsBusy] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="max-w-full"
      disabled={isBusy}
      onClick={() => {
        setIsBusy(true);
        downloadFile(`/helpdesk/attachments/${attachment.id}`, attachment.file_name)
          .catch((caught) => toast.error(errorDetail(caught, "Could not download the file.")))
          .finally(() => setIsBusy(false));
      }}
    >
      {isBusy ? <Loader2 className="animate-spin" /> : <Paperclip />}
      <span className="truncate">{attachment.file_name}</span>
      <span className="text-xs text-muted-foreground tabular-nums">
        {formatBytes(attachment.size_bytes)}
      </span>
    </Button>
  );
}

const ACCEPT = ".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg";

/** Why a file will be refused, checked before it is sent. The server checks the bytes again. */
function fileProblem(file: File): string | null {
  const name = file.name.toLowerCase();
  if (![".pdf", ".png", ".jpg", ".jpeg"].some((ext) => name.endsWith(ext))) {
    return "Attach a PDF, PNG or JPEG.";
  }
  return null;
}

/** One optional attachment: a PDF, PNG or JPEG. */
export function AttachmentPicker({
  id,
  file,
  onChange,
  disabled,
}: {
  id: string;
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}) {
  // Remounting the input is the only way to clear a file input's selection.
  const [inputKey, setInputKey] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);

  if (file) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
        <span className="flex min-w-0 items-center gap-2">
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{file.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {formatBytes(file.size)}
          </span>
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Remove attachment"
          disabled={disabled}
          onClick={() => {
            onChange(null);
            setInputKey((current) => current + 1);
          }}
        >
          <X />
        </Button>
      </div>
    );
  }
  return (
    <div className="grid gap-1">
      <FileInput
        key={inputKey}
        id={id}
        accept={ACCEPT}
        disabled={disabled}
        onChange={(event) => {
          const chosen = event.target.files?.[0] ?? null;
          const reason = chosen ? fileProblem(chosen) : null;
          setProblem(reason);
          if (reason) {
            setInputKey((current) => current + 1);
            onChange(null);
          } else {
            onChange(chosen);
          }
        }}
      />
      {problem && <p className="text-xs text-destructive">{problem}</p>}
    </div>
  );
}

/** A refusal inside a form or sheet, in the server's words. */
export function InlineError({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
    >
      {children}
    </div>
  );
}
