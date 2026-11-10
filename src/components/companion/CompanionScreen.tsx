"use client";

import { Loader2, MessageSquarePlus, Paperclip, SendHorizontal, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ErrorState } from "@/components/common/ErrorState";
import { PageShell } from "@/components/common/PageShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AskMiraMark } from "@/components/brand/AskMiraLogo";
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
import { HiddenFileInput } from "@/components/ui/file-input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, del, get, post } from "@/lib/api";
import { cn, formatDate, initials } from "@/lib/utils";

import {
  AttachmentChip,
  DraftFileChip,
  FILE_ACCEPT,
  MAX_FILES,
  PRODUCT_BRANDS,
  useDraftFiles,
} from "./CompanionAttachments";
import { CompanionCardView } from "./CompanionCards";
import { ChatText } from "./CompanionExtras";
import type {
  CompanionAttachmentCard,
  CompanionMessage,
  CompanionPick,
  CompanionProposal,
  CompanionStatus,
  Conversation,
  ConversationDetail,
  OfferDecision,
  Turn,
} from "./types";

/** How long the screen waits for a turn or a confirmation (the server stops at 75 s). */
const TURN_TIMEOUT_MS = 150_000;
/** Extra time when files come with the message: each picture is read first. */
const FILE_READ_MS = 120_000;

/**
 * Ask Miraa — the workspace's AI companion, one conversation at a time.
 *
 * It answers as the person signed in: every lookup runs with their own access,
 * and what it finds is shown here under its reply. It works a question out in
 * several steps and can offer to do things (apply for leave, approve a
 * request); an offer does nothing until the person confirms it. Conversations
 * are private to the person who had them.
 */
export function CompanionScreen() {
  const status = useApiQuery<CompanionStatus>("/companion/status");
  const name = status.data?.name ?? "Miraa";

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
          questions like the ones below. Nothing you type leaves AskMiraa.
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
  // Said for the person once an admin is back from connecting a product here.
  const [carryOn, setCarryOn] = useState<string | null>(null);
  const resumed = useRef(false);

  const open = useCallback(async (conversation: Conversation | null): Promise<boolean> => {
    setActiveId(conversation?.id ?? null);
    setMessages([]);
    if (!conversation) return true;
    setOpening(true);
    try {
      const detail = await get<ConversationDetail>(`/companion/conversations/${conversation.id}`);
      setMessages(detail.messages);
      return true;
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "Could not open that conversation.");
      setActiveId(null);
      return false;
    } finally {
      setOpening(false);
    }
  }, []);

  // Back from Connect (Settings → Connectors' callback): reopen the conversation the
  // admin pressed it in and carry on with what they asked, now the product is there.
  useEffect(() => {
    if (resumed.current) return;
    resumed.current = true;
    const params = new URLSearchParams(window.location.search);
    const id = params.get("c");
    const product = params.get("connected");
    if (!id && !product) return;
    window.history.replaceState(null, "", window.location.pathname);
    const brand = product ? PRODUCT_BRANDS[product] : undefined;
    if (brand) toast.success(`${brand} is connected.`);
    if (!id || !/^[0-9a-f-]{36}$/.test(id)) return;
    void open({ id, title: "", last_message_at: "", created_at: null }).then((ok) => {
      if (ok && brand && status.mode === "ai") setCarryOn(`I've connected ${brand} now. Please carry on.`);
    });
  }, [open, status.mode]);

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
        autoSend={carryOn}
        onAutoSent={() => setCarryOn(null)}
        onDecided={(decision) =>
          setMessages((current) => [
            ...current.map((message) => ({
              ...message,
              cards: message.cards.map((card) =>
                card.type === "proposal" && card.action_id === decision.action.action_id ? decision.action : card,
              ),
            })),
            decision.message,
          ])
        }
        onTurn={(turn) => {
          // An offer decided by a "yes" in this turn: the card it came on shows that too.
          const latest = new Map<string, CompanionProposal>();
          for (const card of turn.messages[1].cards) {
            if (card.type === "proposal") latest.set(card.action_id, card);
          }
          setMessages((current) => [
            ...current.map((message) =>
              latest.size === 0
                ? message
                : {
                    ...message,
                    cards: message.cards.map((card) =>
                      card.type === "proposal" ? (latest.get(card.action_id) ?? card) : card,
                    ),
                  },
            ),
            ...turn.messages,
          ]);
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
  onDecided,
  autoSend = null,
  onAutoSent,
}: {
  status: CompanionStatus;
  conversationId: string | null;
  messages: CompanionMessage[];
  loading: boolean;
  onTurn: (turn: Turn) => void;
  onDecided: (decision: OfferDecision) => void;
  /** Words to send as the person once the conversation is open (back from Connect). */
  autoSend?: string | null;
  onAutoSent?: () => void;
}) {
  const { user } = useAuth();
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<string | null>(null);
  // Pictures and PDFs for the next message: picked, pasted (a screenshot) or dropped.
  const drafts = useDraftFiles();
  const [sendingFiles, setSendingFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const canAttach = status.mode === "ai";

  // Confirm or Cancel on an offer: the module's own service runs (or not), as the person.
  const decide = async (card: CompanionProposal, confirm: boolean) => {
    if (deciding || pending) return;
    setDeciding(card.action_id);
    try {
      const decision = await post<OfferDecision>(
        `/companion/actions/${card.action_id}/${confirm ? "confirm" : "cancel"}`,
        undefined,
        // An order win opens several positions and writes the P&L: give it time.
        { timeout: TURN_TIMEOUT_MS },
      );
      onDecided(decision);
      if (decision.action.status === "done") toast.success(decision.message.text || "Done.");
      else if (decision.action.status === "failed") toast.error(decision.message.text);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "That could not be done.");
    } finally {
      setDeciding(null);
    }
  };
  const endRef = useRef<HTMLDivElement>(null);
  // The id of a send that got no answer: sending the same words again reuses it,
  // so the server returns the first answer instead of running the turn twice.
  const unanswered = useRef<{ text: string; ref: string } | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, pending]);

  // A typed message (with any attached files), a choice clicked on an earlier answer
  // (a person from a list), or words sent for the person (`said`, back from Connect).
  const send = async (picked?: CompanionPick, said?: string) => {
    const fromComposer = !picked && said === undefined;
    const text = picked ? picked.text : (said ?? draft.trim());
    const files = fromComposer ? drafts.files : [];
    if ((!text && files.length === 0) || pending !== null || drafts.preparing) return;
    if (fromComposer) {
      setDraft("");
      drafts.clear();
    }
    setPending(text);
    setSendingFiles(files);
    const key = [text, ...files.map((file) => `${file.name}:${file.size}`)].join("|");
    const ref = unanswered.current?.text === key ? unanswered.current.ref : crypto.randomUUID();
    unanswered.current = { text: key, ref };
    try {
      let turn: Turn;
      if (files.length > 0) {
        const form = new FormData();
        form.append("text", text);
        if (conversationId) form.append("conversation_id", conversationId);
        form.append("client_ref", ref);
        files.forEach((file) => form.append("files", file, file.name));
        // Reading a picture comes first, then the turn itself.
        turn = await post<Turn>("/companion/messages/files", form, { timeout: TURN_TIMEOUT_MS + FILE_READ_MS });
      } else {
        turn = await post<Turn>(
          "/companion/messages",
          {
            text,
            conversation_id: conversationId,
            // A retry of this same send gets the first answer back, never a second turn.
            client_ref: ref,
            ...(picked ? { pick: { tool: picked.tool, inputs: picked.inputs } } : {}),
          },
          // A turn may take several lookups (the server allows 75 s): wait for it.
          { timeout: TURN_TIMEOUT_MS },
        );
      }
      unanswered.current = null;
      onTurn(turn);
    } catch (caught) {
      if (fromComposer) {
        setDraft(text);
        drafts.setFiles(files);
      }
      toast.error(caught instanceof ApiError ? caught.detail : `${status.name} could not answer.`);
    } finally {
      setPending(null);
      setSendingFiles([]);
    }
  };

  // Back from Connect: carry on in this conversation once it is open, once.
  const sendRef = useRef(send);
  sendRef.current = send;
  useEffect(() => {
    if (!autoSend || loading || pending !== null) return;
    onAutoSent?.();
    void sendRef.current(undefined, autoSend);
  }, [autoSend, loading, pending, onAutoSent]);

  const attach = (incoming: File[]) => {
    if (!canAttach || pending !== null) return;
    void drafts.add(incoming);
  };

  const left = Math.max(0, status.daily_limit - status.sent_today);
  const waiting = pending !== null;
  const reading = sendingFiles.map((file) => file.name).join(", ");

  return (
    <Card
      tier="tier2"
      className={cn("flex min-h-[60vh] flex-col", dragging && "ring-2 ring-ring")}
      onDragOver={(event) => {
        if (!canAttach || !event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(event) => {
        if (!canAttach) return;
        event.preventDefault();
        setDragging(false);
        attach(Array.from(event.dataTransfer.files));
      }}
    >
      <CardContent className="flex flex-1 flex-col gap-3 p-0">
        <ScrollArea className="flex-1 px-4 pt-4">
          <div className="grid gap-4 pb-4">
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : messages.length === 0 && !waiting ? (
              <Welcome status={status} />
            ) : (
              messages.map((message) => (
                <Bubble
                  key={message.id}
                  message={message}
                  name={status.name}
                  mine={initials(user?.full_name ?? "")}
                  onPick={(picked) => void send(picked)}
                  picking={waiting}
                  onDecide={(card, confirm) => void decide(card, confirm)}
                  deciding={deciding}
                  conversationId={conversationId}
                />
              ))
            )}
            {waiting ? (
              <>
                <Bubble
                  message={{ id: "pending", role: "user", text: pending ?? "", tool: null, tool_title: null, arguments: null, cards: [], created_at: null }}
                  name={status.name}
                  mine={initials(user?.full_name ?? "")}
                  sendingFiles={sendingFiles}
                />
                <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
                  <Loader2 className="size-4 animate-spin" />
                  {reading
                    ? `${status.name} is reading ${reading}…`
                    : status.mode === "ai"
                      ? `${status.name} is looking into it…`
                      : `${status.name} is thinking…`}
                </div>
              </>
            ) : null}
            <div ref={endRef} />
          </div>
        </ScrollArea>

        <div className="grid gap-2 border-t p-3">
          {drafts.files.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {drafts.files.map((file, index) => (
                <DraftFileChip
                  key={`${file.name}-${file.size}-${index}`}
                  file={file}
                  onRemove={() => drafts.remove(index)}
                  disabled={waiting}
                />
              ))}
            </div>
          ) : null}
          <Textarea
            value={draft}
            rows={2}
            maxLength={2000}
            placeholder={
              dragging
                ? "Drop the picture or PDF to attach it"
                : canAttach
                  ? `Message ${status.name}, or paste a screenshot…`
                  : `Message ${status.name}…`
            }
            aria-label={`Message ${status.name}`}
            disabled={waiting}
            onChange={(event) => setDraft(event.target.value)}
            onPaste={(event) => {
              const pasted = Array.from(event.clipboardData.files);
              if (pasted.length === 0 || !canAttach) return;
              // A screenshot alone: attach it. Copied text and a picture together: both.
              if (!event.clipboardData.getData("text")) event.preventDefault();
              attach(pasted);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
          />
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-1.5">
              {canAttach ? (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    aria-label="Attach a picture or PDF"
                    title={`Attach a picture or PDF (up to ${MAX_FILES}, ${drafts.limitLabel} each)`}
                    disabled={waiting || drafts.preparing || drafts.files.length >= MAX_FILES}
                    onClick={() => fileInput.current?.click()}
                  >
                    {drafts.preparing ? <Loader2 className="animate-spin" /> : <Paperclip />}
                  </Button>
                  <HiddenFileInput
                    ref={fileInput}
                    accept={FILE_ACCEPT}
                    multiple
                    shrink={false}
                    maxBytes={false}
                    aria-label="Choose a picture or PDF"
                    onChange={(event) => {
                      const picked = Array.from(event.target.files ?? []);
                      event.target.value = "";
                      attach(picked);
                    }}
                  />
                </>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Enter sends, Shift+Enter for a new line
                {canAttach ? " · Attach, paste or drop a picture or PDF" : ""} · {left} of {status.daily_limit}{" "}
                messages left today
              </p>
            </div>
            <Button
              onClick={() => void send()}
              disabled={waiting || drafts.preparing || (!draft.trim() && drafts.files.length === 0)}
            >
              <SendHorizontal /> Send
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Welcome({ status }: { status: CompanionStatus }) {
  const { hasRole } = useAuth();
  // The same line the server holds: HR asks about everyone, everybody else
  // about themselves only, in AskMiraa and in every connected product.
  const companyWide = hasRole("admin", "sub_admin");

  return (
    <div className="grid gap-4 py-6">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center">
          <AskMiraMark className="h-9" />
        </span>
        <div className="grid gap-1">
          <p className="text-sm font-medium">{status.name}</p>
          <p className="text-sm leading-6 text-muted-foreground">
            {status.greeting ||
              (status.mode === "ai"
                ? `Hi! I'm ${status.name}, your company's AI companion. Ask me anything about work — I can look things up, compare them, and get things done for you once you confirm.`
                : `Hi! I'm ${status.name}. Ask me about leave, people, hiring or expenses — across your linked products.`)}
          </p>
        </div>
      </div>
      {status.mode === "ai" ? (
        <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
          <Paperclip className="mt-0.5 size-4 shrink-0" />
          You can attach, paste or drop a picture or PDF too: a LinkedIn profile or a visiting card to add
          a lead, an error on screen for an IT ticket, or a document to ask about. I read it; the file
          itself isn&apos;t kept.
        </p>
      ) : null}
      <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        {companyWide
          ? "You can ask about the whole company in AskMiraa, as far as your HR rights reach. Each connected product answers as far as your role there allows."
          : "I answer you about your own records only: your leave, pay, claims, tickets and requests, in AskMiraa and the connected products. Other people's records stay private."}
      </p>
      {status.tools.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tools are switched on for you yet, so I can only chat.</p>
      ) : null}
    </div>
  );
}

function Bubble({
  message,
  name,
  mine,
  onPick,
  picking = false,
  onDecide,
  deciding = null,
  conversationId = null,
  sendingFiles = [],
}: {
  message: CompanionMessage;
  name: string;
  mine: string;
  onPick?: (pick: CompanionPick) => void;
  picking?: boolean;
  onDecide?: (card: CompanionProposal, confirm: boolean) => void;
  deciding?: string | null;
  conversationId?: string | null;
  /** Files on a message still being sent (not read yet). */
  sendingFiles?: File[];
}) {
  if (message.role === "user") {
    const files = message.cards.filter((card): card is CompanionAttachmentCard => card.type === "attachment");
    return (
      <div className="flex items-start justify-end gap-3">
        <div className="grid max-w-[85%] justify-items-end gap-1.5">
          {files.length > 0 || sendingFiles.length > 0 ? (
            <div className="flex flex-wrap justify-end gap-1.5">
              {files.map((card, index) => (
                <AttachmentChip key={`${card.name}-${index}`} card={card} />
              ))}
              {sendingFiles.map((file, index) => (
                <DraftFileChip key={`${file.name}-${index}`} file={file} />
              ))}
            </div>
          ) : null}
          {message.text ? (
            <div className="rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm leading-6 text-primary-foreground">
              <p className="whitespace-pre-line">{message.text}</p>
            </div>
          ) : null}
        </div>
        <Avatar className="size-8">
          <AvatarFallback className="text-xs">{mine || "Me"}</AvatarFallback>
        </Avatar>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center">
        <AskMiraMark className="h-8" />
      </span>
      <div className="grid min-w-0 max-w-[85%] gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-medium text-muted-foreground">{name}</p>
          {(message.steps && message.steps.length > 0
            ? [...new Set(message.steps.map((step) => step.title))]
            : message.tool_title
              ? [message.tool_title]
              : []
          ).map((title) => (
            <Badge key={title} variant="outline" className="text-[11px]">
              {title}
            </Badge>
          ))}
        </div>
        {message.text ? <ChatText text={message.text} /> : null}
        {message.cards.map((card, index) => (
          <CompanionCardView
            key={card.type === "proposal" ? card.action_id : index}
            card={card}
            onPick={onPick}
            picking={picking}
            onDecide={onDecide}
            deciding={card.type === "proposal" && deciding === card.action_id}
            conversationId={conversationId}
          />
        ))}
      </div>
    </div>
  );
}
