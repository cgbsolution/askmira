"use client";

import { Loader2, Lock, Send } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { post } from "@/lib/api";
import type { TicketComment, TicketDetail } from "@/lib/types/helpdesk";
import { cn, formatDateTime, initials } from "@/lib/utils";

import { AttachmentChip, AttachmentPicker, InlineError, errorDetail } from "./shared";

/**
 * The conversation on a ticket: the employee's original request, then every
 * reply, note and system line in order.
 *
 * What is in `ticket.comments` is what the caller may see. A requester's copy
 * has no internal notes in it at all — this component does not filter.
 */
export function TicketThread({ ticket }: { ticket: TicketDetail }) {
  return (
    <ol className="space-y-4" aria-label="Conversation">
      <li>
        <Message
          name={ticket.employee_name}
          at={ticket.created_at}
          tone="requester"
          label={ticket.raised_on_behalf ? "Raised by HR on their behalf" : undefined}
        >
          <p className="whitespace-pre-wrap break-words">{ticket.description}</p>
          {ticket.attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {ticket.attachments.map((attachment) => (
                <AttachmentChip key={attachment.id} attachment={attachment} />
              ))}
            </div>
          )}
        </Message>
      </li>
      {ticket.comments.map((comment) => (
        <li key={comment.id}>
          {comment.is_system ? <SystemLine comment={comment} /> : <CommentMessage comment={comment} />}
        </li>
      ))}
    </ol>
  );
}

function SystemLine({ comment }: { comment: TicketComment }) {
  return (
    <p className="text-center text-xs text-muted-foreground">
      {comment.author_name ? `${comment.author_name} · ` : ""}
      {comment.body} <span className="tabular-nums">· {formatDateTime(comment.created_at)}</span>
    </p>
  );
}

function CommentMessage({ comment }: { comment: TicketComment }) {
  return (
    <Message
      name={comment.author_name ?? "AskMira"}
      at={comment.created_at}
      tone={comment.is_internal ? "internal" : comment.is_from_requester ? "requester" : "agent"}
    >
      <p className="whitespace-pre-wrap break-words">{comment.body}</p>
      {comment.attachments.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {comment.attachments.map((attachment) => (
            <AttachmentChip key={attachment.id} attachment={attachment} />
          ))}
        </div>
      )}
    </Message>
  );
}

function Message({
  name,
  at,
  tone,
  label,
  children,
}: {
  name: string;
  at: string;
  tone: "requester" | "agent" | "internal";
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <Avatar className="size-8 shrink-0">
        <AvatarFallback className="text-[10px]">{initials(name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-medium text-foreground">{name}</span>
          {tone === "internal" && (
            <Badge variant="warning">
              <Lock /> Internal note
            </Badge>
          )}
          {label && <span className="text-xs text-muted-foreground">{label}</span>}
          <span className="text-xs text-muted-foreground tabular-nums">{formatDateTime(at)}</span>
        </div>
        <div
          className={cn(
            "mt-1 rounded-lg border px-3 py-2.5 text-sm text-foreground",
            tone === "requester" && "border-border bg-muted/40",
            tone === "agent" && "border-blush-200 bg-blush-50 dark:border-blush-900 dark:bg-blush-900/20",
            tone === "internal" &&
              "border-marigold-200 bg-marigold-50 dark:border-marigold-900/40 dark:bg-marigold-950/20",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * Write a reply — or, for the people working the ticket, an internal note the
 * employee never sees. Posts one message with an optional file and hands the
 * refreshed ticket back.
 */
export function ReplyBox({
  ticket,
  onPosted,
}: {
  ticket: TicketDetail;
  onPosted: (ticket: TicketDetail) => void;
}) {
  const [mode, setMode] = useState<"reply" | "internal">("reply");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    setBody("");
    setFile(null);
    setError(null);
    setMode("reply");
  }, [ticket.id]);

  const internal = mode === "internal" && ticket.can_add_internal_note;

  const send = async () => {
    if (!body.trim()) {
      setError("Write a message first.");
      return;
    }
    setError(null);
    setIsSending(true);
    try {
      const form = new FormData();
      form.append("body", body.trim());
      form.append("is_internal", internal ? "true" : "false");
      if (file) form.append("file", file);
      const updated = await post<TicketDetail>(`/helpdesk/tickets/${ticket.id}/comments`, form);
      toast.success(internal ? "Internal note added" : "Reply sent");
      setBody("");
      setFile(null);
      onPosted(updated);
    } catch (caught) {
      setError(errorDetail(caught, "Could not send the message."));
    } finally {
      setIsSending(false);
    }
  };

  const fieldId = `reply-${ticket.id}`;
  return (
    <form
      className={cn(
        "grid gap-3 rounded-lg border p-3",
        internal ? "border-marigold-200 dark:border-marigold-900/40" : "border-border",
      )}
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      {ticket.can_add_internal_note ? (
        <Tabs value={mode} onValueChange={(next) => setMode(next as "reply" | "internal")}>
          <TabsList>
            <TabsTrigger value="reply">Reply to employee</TabsTrigger>
            <TabsTrigger value="internal">
              <Lock /> Internal note
            </TabsTrigger>
          </TabsList>
        </Tabs>
      ) : (
        <Label htmlFor={fieldId}>Reply</Label>
      )}
      <Textarea
        id={fieldId}
        rows={3}
        maxLength={10_000}
        value={body}
        disabled={isSending}
        onChange={(event) => setBody(event.target.value)}
        placeholder={
          internal
            ? "Only the people working this ticket will see this."
            : ticket.viewer === "requester"
              ? "Add details or answer HR's question."
              : "The employee will be notified of your reply."
        }
      />
      <AttachmentPicker id={`${fieldId}-file`} file={file} onChange={setFile} disabled={isSending} />
      {error && <InlineError>{error}</InlineError>}
      <div className="flex justify-end">
        <Button type="submit" disabled={isSending || !body.trim()}>
          {isSending ? <Loader2 className="animate-spin" /> : internal ? <Lock /> : <Send />}
          {internal ? "Add note" : "Send reply"}
        </Button>
      </div>
    </form>
  );
}
