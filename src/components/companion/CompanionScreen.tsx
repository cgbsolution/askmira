"use client";

import { Loader2, MessageSquarePlus, SendHorizontal, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ErrorState } from "@/components/common/ErrorState";
import { PageShell } from "@/components/common/PageShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, del, get, post } from "@/lib/api";
import { cn, formatDate, initials } from "@/lib/utils";

import { CompanionCardView } from "./CompanionCards";
import type {
  CompanionMessage,
  CompanionStatus,
  Conversation,
  ConversationDetail,
  Turn,
} from "./types";

/**
 * Ask Mira — the workspace's AI companion, one conversation at a time.
 *
 * It answers as the person signed in: every lookup runs with their own access,
 * and what it finds is shown here, never sent to the model. Conversations are
 * private to the person who had them.
 */
export function CompanionScreen() {
  const status = useApiQuery<CompanionStatus>("/companion/status");
  const name = status.data?.name ?? "Mira";

  return (
    <PageShell
      title={`Ask ${name}`}
      description="Your company's AI companion. It answers as you, with your own access, and shows you where each answer came from."
      icon={Sparkles}
      tier="tier2"
    >
      {/* Only the first load shows a placeholder. The status is reloaded after every
          message (for the daily count); swapping the chat out for a placeholder
          then would throw away the open conversation. */}
      {status.isLoading && !status.data ? (
        <Skeleton className="h-96 w-full" />
      ) : status.error && !status.data ? (
        <ErrorState message={status.error.detail} onRetry={status.reload} />
      ) : status.data ? (
        <Gate status={status.data} onChange={status.reload} />
      ) : null}
    </PageShell>
  );
}

function Gate({ status, onChange }: { status: CompanionStatus; onChange: () => void }) {
  return (
    <div className="grid gap-4">
      {status.mode === "direct" ? <DirectModeNote status={status} /> : null}
      <Chat status={status} onSent={onChange} />
    </div>
  );
}

/** Without AI the chat still answers, by matching words to a lookup. Says why, and how to get AI. */
function DirectModeNote({ status }: { status: CompanionStatus }) {
  const why =
    status.reason === "not_configured"
      ? "This server has no AI provider configured"
      : status.reason === "disabled"
        ? "AI is switched off for your workspace"
        : "You have not agreed to the AI assistant";
  return (
    <Alert>
      <ShieldCheck />
      <AlertTitle>Quick lookups, without AI</AlertTitle>
      <AlertDescription>
        <p>
          {why}, so {status.name} matches your words to a lookup instead. Ask short, direct
          questions like the ones below. Nothing you type leaves AskMira.
        </p>
        {status.reason === "disabled" && status.can_configure ? (
          <Button asChild variant="link" className="h-auto p-0">
            <Link href="/settings?tab=ai">Turn on AI under Settings → Company → AI</Link>
          </Button>
        ) : status.reason === "no_consent" ? (
          <Button asChild variant="link" className="h-auto p-0">
            <Link href="/compliance/privacy">Agree to it under My privacy for free-form questions</Link>
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

function Chat({ status, onSent }: { status: CompanionStatus; onSent: () => void }) {
  const conversations = useApiQuery<Conversation[]>("/companion/conversations");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CompanionMessage[]>([]);
  const [opening, setOpening] = useState(false);
  const [deleting, setDeleting] = useState<Conversation | null>(null);

  const open = useCallback(async (conversation: Conversation | null) => {
    setActiveId(conversation?.id ?? null);
    setMessages([]);
    if (!conversation) return;
    setOpening(true);
    try {
      const detail = await get<ConversationDetail>(`/companion/conversations/${conversation.id}`);
      setMessages(detail.messages);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "Could not open that conversation.");
      setActiveId(null);
    } finally {
      setOpening(false);
    }
  }, []);

  const remove = async () => {
    const target = deleting;
    if (!target) return;
    setDeleting(null);
    try {
      await del(`/companion/conversations/${target.id}`);
      if (activeId === target.id) {
        setActiveId(null);
        setMessages([]);
      }
      conversations.reload();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "Could not delete it.");
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <Card tier="tier2" className="h-fit">
        <CardContent className="grid gap-2 p-3">
          <Button variant="outline" className="justify-start" onClick={() => void open(null)}>
            <MessageSquarePlus /> New conversation
          </Button>
          <ScrollArea className="max-h-48 lg:max-h-[60vh]">
            <div className="grid gap-0.5 pr-2">
              {conversations.isLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : (conversations.data ?? []).length === 0 ? (
                <p className="px-2 py-3 text-xs text-muted-foreground">
                  Your conversations stay here, and only you can see them.
                </p>
              ) : (
                (conversations.data ?? []).map((conversation) => (
                  <div key={conversation.id} className="group flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-auto min-w-0 flex-1 justify-start py-2 text-left font-normal",
                        conversation.id === activeId && "bg-accent",
                      )}
                      onClick={() => void open(conversation)}
                    >
                      <span className="grid min-w-0">
                        <span className="truncate text-sm">{conversation.title}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {formatDate(conversation.last_message_at)}
                        </span>
                      </span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0 opacity-60 hover:opacity-100"
                      aria-label={`Delete “${conversation.title}”`}
                      onClick={() => setDeleting(conversation)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Thread
        status={status}
        conversationId={activeId}
        messages={messages}
        loading={opening}
        onTurn={(turn) => {
          setMessages((current) => [...current, ...turn.messages]);
          if (!activeId) {
            setActiveId(turn.conversation.id);
            conversations.reload();
          }
          onSent();
        }}
      />

      <Dialog open={deleting !== null} onOpenChange={(next) => !next && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this conversation?</DialogTitle>
            <DialogDescription>
              “{deleting?.title}” will be removed from your conversations. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Keep it
            </Button>
            <Button variant="destructive" onClick={() => void remove()}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Thread({
  status,
  conversationId,
  messages,
  loading,
  onTurn,
}: {
  status: CompanionStatus;
  conversationId: string | null;
  messages: CompanionMessage[];
  loading: boolean;
  onTurn: (turn: Turn) => void;
}) {
  const { user } = useAuth();
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, pending]);

  const send = async () => {
    const text = draft.trim();
    if (!text || pending) return;
    setDraft("");
    setPending(text);
    try {
      const turn = await post<Turn>("/companion/messages", {
        text,
        conversation_id: conversationId,
      });
      onTurn(turn);
    } catch (caught) {
      setDraft(text);
      toast.error(caught instanceof ApiError ? caught.detail : `${status.name} could not answer.`);
    } finally {
      setPending(null);
    }
  };

  const left = Math.max(0, status.daily_limit - status.sent_today);

  return (
    <Card tier="tier2" className="flex min-h-[60vh] flex-col">
      <CardContent className="flex flex-1 flex-col gap-3 p-0">
        <ScrollArea className="flex-1 px-4 pt-4">
          <div className="grid gap-4 pb-4">
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : messages.length === 0 && !pending ? (
              <Welcome status={status} onPick={(text) => setDraft(text)} />
            ) : (
              messages.map((message) => (
                <Bubble key={message.id} message={message} name={status.name} mine={initials(user?.full_name ?? "")} />
              ))
            )}
            {pending ? (
              <>
                <Bubble
                  message={{ id: "pending", role: "user", text: pending, tool: null, tool_title: null, arguments: null, cards: [], created_at: null }}
                  name={status.name}
                  mine={initials(user?.full_name ?? "")}
                />
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> {status.name} is thinking…
                </div>
              </>
            ) : null}
            <div ref={endRef} />
          </div>
        </ScrollArea>

        <div className="grid gap-2 border-t p-3">
          <Textarea
            value={draft}
            rows={2}
            maxLength={2000}
            placeholder={`Message ${status.name}…`}
            aria-label={`Message ${status.name}`}
            disabled={pending !== null}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Enter sends, Shift+Enter for a new line · {left} of {status.daily_limit} messages left today
            </p>
            <Button onClick={() => void send()} disabled={pending !== null || !draft.trim()}>
              <SendHorizontal /> Send
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Welcome({ status, onPick }: { status: CompanionStatus; onPick: (text: string) => void }) {
  // The server's examples cover every lookup this person has; the two questions
  // only a model answers are added when AI is planning.
  const suggestions = [
    status.tools.some((t) => t.key === "policy_question") ? "What is the work-from-home policy?" : null,
    status.tools.some((t) => t.key === "report_question") ? "How many people joined this year?" : null,
    ...status.examples,
  ]
    .filter((s): s is string => s !== null)
    .slice(0, 8);

  return (
    <div className="grid gap-4 py-6">
      <div className="flex items-start gap-3">
        <Avatar className="size-9">
          <AvatarFallback className="bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </AvatarFallback>
        </Avatar>
        <div className="grid gap-1">
          <p className="text-sm font-medium">{status.name}</p>
          <p className="text-sm leading-6 text-muted-foreground">
            {status.greeting ||
              (status.mode === "ai"
                ? `Hi! I'm ${status.name}, your company's AI companion. Ask me anything about work.`
                : `Hi! I'm ${status.name}. Ask me about leave, people, hiring or expenses — across your linked products.`)}
          </p>
        </div>
      </div>
      {status.tools.length > 0 ? (
        <div className="grid gap-2">
          <p className="text-xs text-muted-foreground">I can help with</p>
          <div className="flex flex-wrap gap-1.5">
            {status.tools.map((tool) => (
              <Badge key={tool.key} variant="outline">
                {tool.title}
              </Badge>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No tools are switched on for you yet, so I can only chat.</p>
      )}
      {suggestions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((text) => (
            <Button key={text} variant="outline" size="sm" onClick={() => onPick(text)}>
              {text}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Bubble({ message, name, mine }: { message: CompanionMessage; name: string; mine: string }) {
  if (message.role === "user") {
    return (
      <div className="flex items-start justify-end gap-3">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm leading-6 text-primary-foreground">
          <p className="whitespace-pre-line">{message.text}</p>
        </div>
        <Avatar className="size-8">
          <AvatarFallback className="text-xs">{mine || "Me"}</AvatarFallback>
        </Avatar>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3">
      <Avatar className="size-8">
        <AvatarFallback className="bg-primary text-primary-foreground">
          <Sparkles className="size-4" />
        </AvatarFallback>
      </Avatar>
      <div className="grid min-w-0 max-w-[85%] gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-medium text-muted-foreground">{name}</p>
          {message.tool_title ? (
            <Badge variant="outline" className="text-[11px]">
              {message.tool_title}
            </Badge>
          ) : null}
        </div>
        {message.text ? <p className="whitespace-pre-line text-sm leading-6">{message.text}</p> : null}
        {message.cards.map((card, index) => (
          <CompanionCardView key={index} card={card} />
        ))}
      </div>
    </div>
  );
}
