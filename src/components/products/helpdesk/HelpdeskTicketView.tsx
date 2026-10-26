"use client";

import { ArrowLeft, ExternalLink, Loader2, Paperclip, RefreshCw, Send } from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";
import { toast } from "sonner";

import { ErrorState } from "@/components/common/ErrorState";
import { FormField } from "@/components/common/FormField";
import { PageShell } from "@/components/common/PageShell";
import { InlineError, errorDetail } from "@/components/helpdesk/shared";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import { cn, formatDateTime, initials } from "@/lib/utils";

import {
  PRIORITY_LABEL,
  TICKET_STATUS_LABEL,
  type HelpdeskMessage,
  type HelpdeskTicket,
  type HelpdeskTicketPage,
} from "./types";

const ACTIVITY_LABEL: Record<string, string> = {
  created: "Raised",
  acquired: "Picked up",
  reassigned: "Reassigned",
  hold: "Put on hold",
  reopened: "Reopened",
  closed: "Closed",
  sla_response_breach: "Not picked up in time",
  sla_resolution_breach: "Not resolved in time",
};

function statusVariant(status: string | null) {
  if (status === "closed") return "success" as const;
  if (status === "hold") return "warning" as const;
  if (status === "new") return "secondary" as const;
  return "outline" as const;
}

/**
 * One CGB Helpdesk ticket in the portal: what was asked, the conversation with
 * IT, and a reply box. Read live from the helpdesk as the person; a reply is
 * written there as them. Changing the status or assigning it happens in the
 * helpdesk, one click away.
 */
export function HelpdeskTicketView({ ticketId }: { ticketId: string }) {
  const { data, error, isLoading, reload } = useApiQuery<HelpdeskTicketPage>(
    `/products/helpdesk/tickets/${encodeURIComponent(ticketId)}`,
  );
  const ticket = data?.ticket;

  return (
    <PageShell
      title={ticket ? `#${ticket.ref} · ${ticket.subject}` : "Ticket"}
      description={ticket ? `Raised by ${ticket.requester} on ${formatDateTime(ticket.created_at)}` : undefined}
      tier="tier2"
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/linked/helpdesk/tickets">
              <ArrowLeft /> My tickets
            </Link>
          </Button>
          <Button variant="outline" onClick={reload} disabled={isLoading}>
            <RefreshCw /> Refresh
          </Button>
          {data ? (
            <Button asChild>
              <Link href={data.open} target="_blank" rel="noopener">
                <ExternalLink /> Open in {data.source}
              </Link>
            </Button>
          ) : null}
        </div>
      }
    >
      {isLoading && !data ? (
        <Skeleton className="h-96 w-full" />
      ) : error ? (
        <ErrorState message={error.detail} onRetry={reload} />
      ) : data && ticket ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Card tier="tier2">
            <CardHeader>
              <CardTitle>Conversation</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <ol className="space-y-4" aria-label="Conversation">
                <li>
                  <Message name={ticket.requester} at={ticket.created_at} side="requester">
                    <p className="whitespace-pre-wrap break-words">
                      {ticket.description || ticket.subject}
                    </p>
                    {ticket.attachments.length > 0 ? (
                      <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Paperclip className="size-3.5" />
                        {ticket.attachments.map((file) => file.name).join(", ")} — open them in {data.source}
                      </p>
                    ) : null}
                  </Message>
                </li>
                {data.messages.map((message) => (
                  <li key={message.id}>
                    <Message name={message.from} at={message.at} side={message.side}>
                      <p className="whitespace-pre-wrap break-words">{message.text}</p>
                    </Message>
                  </li>
                ))}
              </ol>
              {ticket.can_reply ? (
                <ReplyBox ticketId={ticket.id} onSent={reload} />
              ) : (
                <p className="rounded-md border border-border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
                  This ticket is closed. Reopen it in {data.source} to write on it again.
                </p>
              )}
            </CardContent>
          </Card>
          <div className="grid content-start gap-4">
            <Details ticket={ticket} />
            {data.activity.length > 0 ? (
              <Card tier="tier2">
                <CardHeader>
                  <CardTitle>What happened</CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="grid gap-2 text-sm">
                    {data.activity.map((item, index) => (
                      <li key={index} className="flex flex-col">
                        <span className="text-foreground">
                          {ACTIVITY_LABEL[item.action] ?? item.action.replace(/_/g, " ")}
                          {item.by ? ` · ${item.by}` : ""}
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {formatDateTime(item.at)}
                        </span>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}

function Details({ ticket }: { ticket: HelpdeskTicket }) {
  const rows: [string, React.ReactNode][] = [
    [
      "Status",
      <Badge key="status" variant={statusVariant(ticket.status)}>
        {TICKET_STATUS_LABEL[ticket.status ?? ""] ?? ticket.status ?? "—"}
      </Badge>,
    ],
    ["Priority", PRIORITY_LABEL[ticket.priority ?? ""] ?? ticket.priority ?? "—"],
    ["Category", [ticket.category, ticket.sub_category].filter(Boolean).join(" › ") || "—"],
    ["Assigned to", ticket.assignee ?? "Not yet"],
    ["Device", ticket.asset ? `${ticket.asset.asset_code} · ${ticket.asset.asset_type}` : "—"],
    ["Location", ticket.location ?? "—"],
  ];
  if (ticket.hold_until) rows.push(["On hold until", formatDateTime(ticket.hold_until)]);
  if (ticket.sla_resolution_at) rows.push(["Due by", formatDateTime(ticket.sla_resolution_at)]);
  return (
    <Card tier="tier2">
      <CardHeader>
        <CardTitle>Details</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-2">
          {rows.map(([label, value]) => (
            <React.Fragment key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="break-words text-foreground">{value}</dd>
            </React.Fragment>
          ))}
        </dl>
        {ticket.sla_breached ? <Badge variant="destructive">Past its response or resolution time</Badge> : null}
        {ticket.hold_comment ? (
          <p className="text-muted-foreground">On hold: {ticket.hold_comment}</p>
        ) : null}
        {ticket.closed_comment ? (
          <p className="text-muted-foreground">Closed: {ticket.closed_comment}</p>
        ) : null}
        {ticket.link ? (
          <Button asChild variant="link" className="h-auto justify-start p-0">
            <Link href={ticket.link} target="_blank" rel="noopener noreferrer">
              <ExternalLink /> Reference link
            </Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Message({
  name,
  at,
  side,
  children,
}: {
  name: string;
  at: string;
  side: HelpdeskMessage["side"];
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
          {side === "support" ? <Badge variant="muted">IT support</Badge> : null}
          <span className="text-xs text-muted-foreground tabular-nums">{formatDateTime(at)}</span>
        </div>
        <div
          className={cn(
            "mt-1 rounded-lg border px-3 py-2.5 text-sm text-foreground",
            side === "requester" && "border-border bg-muted/40",
            side === "support" && "border-blush-200 bg-blush-50 dark:border-blush-900 dark:bg-blush-900/20",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function ReplyBox({ ticketId, onSent }: { ticketId: string; onSent: () => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const send = async () => {
    if (!text.trim()) return setError("Write a message first.");
    setError(null);
    setIsSending(true);
    try {
      await post(`/products/helpdesk/tickets/${encodeURIComponent(ticketId)}/replies`, {
        message: text.trim(),
      });
      toast.success("Reply sent");
      setText("");
      onSent();
    } catch (caught) {
      setError(errorDetail(caught, "Could not send the message."));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <form
      className="grid gap-3 rounded-lg border border-border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      <FormField htmlFor={`hd-reply-${ticketId}`} label="Reply">
        <Textarea
          id={`hd-reply-${ticketId}`}
          rows={3}
          maxLength={4000}
          value={text}
          disabled={isSending}
          onChange={(event) => setText(event.target.value)}
          placeholder="Write to the IT team. They see it in CGB Helpdesk and by email."
        />
      </FormField>
      {error && <InlineError>{error}</InlineError>}
      <div className="flex justify-end">
        <Button type="submit" disabled={isSending}>
          {isSending ? <Loader2 className="animate-spin" /> : <Send />} Send
        </Button>
      </div>
    </form>
  );
}
