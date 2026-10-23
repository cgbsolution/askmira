"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Eye, Loader2, Mail, Send, Undo2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/data-table/DataTable";
import { FormField } from "@/components/common/FormField";
import { formatDateTime } from "@/components/hiring/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, post } from "@/lib/api";
import type { CandidateMessage, CandidateMessageStatus } from "@/lib/types/hiring";

const EVENT_LABEL: Record<string, string> = {
  "hiring.candidate.application_received": "Application received",
  "hiring.candidate.interview_invite": "Pick an interview time",
  "hiring.candidate.interview_scheduled": "Interview booked",
  "hiring.candidate.interview_rescheduled": "Interview moved",
  "hiring.candidate.interview_cancelled": "Interview cancelled",
  "hiring.candidate.rejected": "Decision: not progressing",
  "hiring.candidate.offer_released": "Offer ready",
  "hiring.candidate.portal_link": "Portal link",
  "hiring.candidate.message": "Written message",
};

const STATUS: Record<CandidateMessageStatus, { label: string; variant: "success" | "warning" | "destructive" | "muted" | "secondary" }> = {
  queued: { label: "Queued", variant: "secondary" },
  sent: { label: "Sent", variant: "success" },
  failed: { label: "Failed", variant: "destructive" },
  dead_letter: { label: "Gave up", variant: "destructive" },
  cancelled: { label: "Withdrawn", variant: "muted" },
};

/** "Email · Interview booked · automatic": how it went and why. */
function messageDetail(message: CandidateMessage): string {
  return (
    (message.channel === "whatsapp" ? "WhatsApp · " : "Email · ") +
    (EVENT_LABEL[message.event_key] ?? message.event_key) +
    (message.sent_by ? ` · by ${message.sent_by}` : " · automatic")
  );
}

/** When it went, when a queued one goes, or else when it was made. */
function messageWhen(message: CandidateMessage): string {
  return message.sent_at
    ? `Sent ${formatDateTime(message.sent_at)}`
    : message.status === "queued" && message.scheduled_for
      ? `Goes ${formatDateTime(message.scheduled_for)}`
      : formatDateTime(message.created_at);
}

/**
 * Every email to this candidate — automatic ones on hiring events, and ones a
 * recruiter wrote. A queued message (a rejection held for a day, say) can be
 * withdrawn before it goes. Private links show as a placeholder: the candidate
 * gets the link, the log never holds it.
 */
export function CandidateMessages({ candidateId, email }: { candidateId: string; email: string }) {
  const { data, error, isLoading, reload } = useApiQuery<CandidateMessage[]>(`/hiring/candidates/${candidateId}/messages`);
  const [composing, setComposing] = useState(false);
  const [viewing, setViewing] = useState<CandidateMessage | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const withdraw = async (message: CandidateMessage) => {
    setBusy(message.id);
    try {
      await post(`/hiring/candidate-messages/${message.id}/cancel`);
      toast.success("Withdrawn. It will not be sent.");
      reload();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "It could not be withdrawn.");
    } finally {
      setBusy(null);
    }
  };

  const columns: ColumnDef<CandidateMessage>[] = [
    {
      accessorKey: "subject",
      header: "Message",
      meta: { text: (message) => `${message.subject} ${messageDetail(message)}` },
      cell: ({ row }) => (
        <>
          <div className="font-medium text-foreground">{row.original.subject}</div>
          <div className="text-xs text-muted-foreground">{messageDetail(row.original)}</div>
        </>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      meta: {
        text: (message) =>
          `${STATUS[message.status].label}${message.failure_reason ? ` · ${message.failure_reason}` : ""}`,
      },
      cell: ({ row }) => (
        <>
          <Badge variant={STATUS[row.original.status].variant}>{STATUS[row.original.status].label}</Badge>
          {row.original.failure_reason && (
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">{row.original.failure_reason}</p>
          )}
        </>
      ),
    },
    {
      id: "when",
      header: "When",
      accessorFn: (message) =>
        message.sent_at ??
        (message.status === "queued" && message.scheduled_for ? message.scheduled_for : message.created_at),
      meta: { cellClassName: "text-xs text-muted-foreground", text: messageWhen },
      cell: ({ row }) => messageWhen(row.original),
    },
    {
      id: "actions",
      header: "Actions",
      enableHiding: false,
      meta: { className: "text-right", text: false },
      cell: ({ row }) => {
        const message = row.original;
        return (
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" aria-label={`Read ${message.subject}`} onClick={() => setViewing(message)}>
              <Eye />
            </Button>
            {message.status === "queued" && (
              <Button size="sm" variant="outline" disabled={busy === message.id} onClick={() => void withdraw(message)}>
                {busy === message.id ? <Loader2 className="animate-spin" /> : <Undo2 />} Withdraw
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <>
      <DataTable
        title="Messages"
        description={`Emails to ${email}, automatic and written.`}
        actions={
          <Button size="sm" onClick={() => setComposing(true)}>
            <Mail /> Email candidate
          </Button>
        }
        columns={columns}
        data={data ?? []}
        noun="messages"
        exportName="candidate-messages"
        searchPlaceholder="Search messages"
        isLoading={isLoading}
        error={error?.detail ?? null}
        onRetry={reload}
        empty={{ icon: Mail, title: "Nothing sent yet", description: "Hiring events email the candidate on their own; you can also write to them." }}
      />

      <Dialog open={viewing !== null} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewing?.subject}</DialogTitle>
            <DialogDescription>To {viewing?.to_address}</DialogDescription>
          </DialogHeader>
          <p className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-4 text-sm text-foreground">
            {viewing?.body}
          </p>
        </DialogContent>
      </Dialog>

      <ComposeDialog
        open={composing}
        candidateId={candidateId}
        email={email}
        onOpenChange={setComposing}
        onSent={reload}
      />
    </>
  );
}

function ComposeDialog({
  open,
  candidateId,
  email,
  onOpenChange,
  onSent,
}: {
  open: boolean;
  candidateId: string;
  email: string;
  onOpenChange: (open: boolean) => void;
  onSent: () => void;
}) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [withLink, setWithLink] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const send = async () => {
    setIsSending(true);
    try {
      await post(`/hiring/candidates/${candidateId}/messages`, {
        subject: subject.trim(),
        message: message.trim(),
        include_portal_link: withLink,
      });
      toast.success("Queued. It goes within a few minutes.");
      setSubject("");
      setMessage("");
      setWithLink(false);
      onOpenChange(false);
      onSent();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "The message could not be queued.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isSending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Email the candidate</DialogTitle>
          <DialogDescription>To {email}, through your organisation&apos;s mail settings. It is kept in the message log.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField htmlFor="message-subject" label="Subject">
            <Input id="message-subject" maxLength={300} value={subject} onChange={(event) => setSubject(event.target.value)} />
          </FormField>
          <FormField htmlFor="message-body" label="Message">
            <Textarea id="message-body" rows={7} maxLength={10000} value={message} onChange={(event) => setMessage(event.target.value)} />
          </FormField>
          <div className="flex items-start gap-3">
            <Switch id="message-link" checked={withLink} onCheckedChange={setWithLink} />
            <div className="grid gap-1">
              <Label htmlFor="message-link" className="text-sm font-normal">
                Add a link to their candidate portal
              </Label>
              <p className="text-xs text-muted-foreground">
                A fresh private link, so they can upload documents or follow their application. You will not see it.
              </p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={isSending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={isSending || !subject.trim() || !message.trim()} onClick={() => void send()}>
            {isSending ? <Loader2 className="animate-spin" /> : <Send />} Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
