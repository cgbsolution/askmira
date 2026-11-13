"use client";

import { KeyRound, Loader2, MessageSquarePlus, RotateCcw, ShieldCheck, Sparkles } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AskMiraMark } from "@/components/brand/AskMiraLogo";
import { CHAT_TIMEOUTS, Thread, type ChatTransport } from "@/components/companion/CompanionScreen";
import type {
  CompanionMessage,
  CompanionProposal,
  CompanionStatus,
  OfferDecision,
  Turn,
} from "@/components/companion/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, get, post } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

import type { ShowcaseChat, ShowcaseDescription } from "./types";

type Phase = "loading" | "pin" | "chat" | "closed" | "missing" | "error";

const PUBLIC = { skipAuthRedirect: true } as const;

// ── The visitor's chat, kept in this browser only ───────────────────────────

const storeKey = (code: string) => `askmira.showcase.${code}`;

function recall(code: string): { runId: string; key: string } | null {
  try {
    const raw = window.localStorage.getItem(storeKey(code));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { runId?: unknown; key?: unknown };
    return typeof parsed.runId === "string" && typeof parsed.key === "string"
      ? { runId: parsed.runId, key: parsed.key }
      : null;
  } catch {
    return null;
  }
}

function remember(code: string, runId: string, key: string): void {
  try {
    window.localStorage.setItem(storeKey(code), JSON.stringify({ runId, key }));
  } catch {
    // Private windows and blocked storage: the chat still works, it just won't survive a reload.
  }
}

function forget(code: string): void {
  try {
    window.localStorage.removeItem(storeKey(code));
  } catch {
    // nothing kept, nothing to forget
  }
}

/** Example questions not to put on a stand's screen as a button: one person's pay. */
const PRIVATE_EXAMPLE = /\b(my|rohan's)\b.*\bsalary\b|\bmy (salary|leaves?)\b/i;

// ── Screen ──────────────────────────────────────────────────────────────────

/**
 * What an exhibition QR code opens: the workspace's own Ask Miraa, answering
 * as the admin the super admin picked, over its real records. Answers, tables
 * and charts appear in the chat itself. The page holds no portal session: it
 * can only chat, in a conversation of this visitor's own, and only while the
 * link is switched on and inside its window.
 */
export function ShowcaseScreen({ code }: { code: string }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [described, setDescribed] = useState<ShowcaseDescription | null>(null);
  const [chat, setChat] = useState<ShowcaseChat | null>(null);
  const [messages, setMessages] = useState<CompanionMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [autoSend, setAutoSend] = useState<string | null>(null);
  const [pinProblem, setPinProblem] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const keyRef = useRef<string | null>(null);

  const closeWith = useCallback(async () => {
    try {
      setDescribed(await get<ShowcaseDescription>(`/public/showcase/${code}`, PUBLIC));
    } catch {
      setDescribed((current) => (current ? { ...current, status: "off" } : current));
    }
    setPhase("closed");
  }, [code]);

  const enter = useCallback(
    (next: ShowcaseChat, key: string) => {
      keyRef.current = key;
      remember(code, next.run_id, key);
      setChat(next);
      setMessages(next.messages ?? []);
      setConversationId(null);
      setPhase("chat");
    },
    [code],
  );

  const start = useCallback(
    async (pin?: string) => {
      setStarting(true);
      setPinProblem(null);
      try {
        const next = await post<ShowcaseChat>(`/public/showcase/${code}/runs`, { pin: pin ?? null }, PUBLIC);
        enter(next, next.key ?? "");
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 403) {
          setPinProblem(caught.detail);
          setPhase("pin");
        } else if (caught instanceof ApiError && caught.status === 410) {
          await closeWith();
        } else if (caught instanceof ApiError && caught.status === 429) {
          setPinProblem("Too many tries. Wait a few minutes, then try again.");
          setPhase("pin");
        } else {
          setPhase("error");
        }
      } finally {
        setStarting(false);
      }
    },
    [closeWith, code, enter],
  );

  const open = useCallback(async () => {
    setPhase("loading");
    let about: ShowcaseDescription;
    try {
      about = await get<ShowcaseDescription>(`/public/showcase/${code}`, PUBLIC);
    } catch (caught) {
      setPhase(caught instanceof ApiError && caught.status === 404 ? "missing" : "error");
      return;
    }
    setDescribed(about);
    if (about.status !== "live") {
      setPhase("closed");
      return;
    }
    // Back on this phone: carry on with the same chat.
    const kept = recall(code);
    if (kept) {
      try {
        const again = await get<ShowcaseChat>(`/public/showcase/${code}/runs/${kept.runId}`, {
          ...PUBLIC,
          headers: { "X-Showcase-Key": kept.key },
        });
        enter(again, kept.key);
        return;
      } catch {
        forget(code);
      }
    }
    if (about.needs_pin) setPhase("pin");
    else await start();
  }, [code, enter, start]);

  useEffect(() => {
    void open();
  }, [open]);

  const newChat = useCallback(() => {
    forget(code);
    keyRef.current = null;
    if (described?.needs_pin) {
      setChat(null);
      setPinProblem(null);
      setPhase("pin");
    } else {
      void start();
    }
  }, [code, described?.needs_pin, start]);

  const transport = useMemo<ChatTransport | null>(() => {
    if (!chat) return null;
    const base = `/public/showcase/${code}/runs/${chat.run_id}`;
    const options = (timeout: number) => ({
      ...PUBLIC,
      timeout,
      headers: { "X-Showcase-Key": keyRef.current ?? "" },
    });
    return {
      // The run names the conversation, never the page: only the words go.
      send: ({ text, client_ref, pick }) =>
        post<Turn>(`${base}/messages`, { text, client_ref, ...(pick ? { pick } : {}) }, options(CHAT_TIMEOUTS.turn)),
      sendFiles: (form) => {
        form.delete("conversation_id");
        return post<Turn>(`${base}/messages/files`, form, options(CHAT_TIMEOUTS.files));
      },
      decide: (actionId, confirm) =>
        post<OfferDecision>(
          `${base}/actions/${actionId}/${confirm ? "confirm" : "cancel"}`,
          undefined,
          options(CHAT_TIMEOUTS.turn),
        ),
      onError: (caught) => {
        if (!(caught instanceof ApiError)) return false;
        if (caught.status === 410) {
          void closeWith();
          return true;
        }
        if (caught.status === 404 && caught.detail.startsWith("This chat has gone")) {
          toast.info("That chat has ended. Here is a fresh one.");
          newChat();
          return true;
        }
        return false;
      },
    };
  }, [chat, closeWith, code, newChat]);

  if (phase === "loading") return <LoadingScreen />;
  if (phase === "missing") {
    return (
      <ClosedScreen
        company={null}
        logo={null}
        title="This code doesn't open a showcase"
        message="Check you scanned the right code, or ask the team at the stand."
      />
    );
  }
  if (phase === "error") {
    return (
      <ClosedScreen
        company={described?.company ?? null}
        logo={described?.logo_url ?? null}
        title="Miraa couldn't be reached"
        message="Check your connection and try again."
        action={
          <Button onClick={() => void open()}>
            <RotateCcw /> Try again
          </Button>
        }
      />
    );
  }
  if (phase === "pin") {
    return (
      <PinScreen
        company={described?.company ?? null}
        logo={described?.logo_url ?? null}
        problem={pinProblem}
        busy={starting}
        onSubmit={(pin) => void start(pin)}
      />
    );
  }
  if (phase === "closed" || !chat || !transport) {
    const status = described?.status ?? "off";
    const title =
      status === "scheduled"
        ? "This showcase isn't open yet"
        : status === "ended"
          ? "This showcase has ended"
          : "This showcase is switched off";
    return (
      <ClosedScreen
        company={described?.company ?? null}
        logo={described?.logo_url ?? null}
        title={title}
        message={
          status === "scheduled" && described?.starts_at
            ? `It opens ${formatDateTime(described.starts_at)}.`
            : "Ask the team at the stand for a live demo."
        }
      />
    );
  }

  const status = chat.status;
  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <header className="flex items-center justify-between gap-3 border-b bg-card px-4 py-2.5">
        <Brand company={chat.company} logo={chat.logo_url} caption={`Ask ${status.name}`} />
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="outline" className="hidden sm:inline-flex">
            <ShieldCheck /> Answers as {chat.acting_name}
          </Badge>
          <Button variant="outline" size="sm" onClick={newChat} aria-label="Start a new chat">
            <MessageSquarePlus />
            <span className="hidden sm:inline">New chat</span>
          </Button>
        </div>
      </header>
      <main className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col p-2 sm:p-4">
        <Thread
          key={chat.run_id}
          className="min-h-0 flex-1"
          status={status}
          conversationId={conversationId}
          messages={messages}
          loading={false}
          transport={transport}
          me={{ name: "Visitor" }}
          autoSend={autoSend}
          onAutoSent={() => setAutoSend(null)}
          welcome={<Welcome company={chat.company} status={status} onAsk={setAutoSend} />}
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
            setConversationId(turn.conversation.id);
            const next = (turn as Turn & { status?: CompanionStatus }).status;
            if (next) setChat((current) => (current ? { ...current, status: next } : current));
          }}
        />
        <p className="pt-2 text-center text-[11px] text-muted-foreground">
          Live {chat.company} records. Nothing is done until you press Confirm. Open until{" "}
          {formatDateTime(chat.ends_at)}.
        </p>
      </main>
    </div>
  );
}

// ── Pieces ──────────────────────────────────────────────────────────────────

function Brand({ company, logo, caption }: { company: string | null; logo: string | null; caption?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {logo && !failed ? (
        <span className="flex h-9 max-w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-logo-plate px-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt={company ?? ""} className="max-h-7 w-auto object-contain" onError={() => setFailed(true)} />
        </span>
      ) : (
        <AskMiraMark className="h-8" />
      )}
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-semibold">{company ?? "AskMiraa"}</p>
        <p className="truncate text-xs text-muted-foreground">{caption ?? "with Ask Miraa"}</p>
      </div>
    </div>
  );
}

function Welcome({
  company,
  status,
  onAsk,
}: {
  company: string;
  status: CompanionStatus;
  onAsk: (text: string) => void;
}) {
  const keys = new Set(status.tools.map((tool) => tool.key));
  const examples = [
    ...(status.mode === "ai" && keys.has("book_order")
      ? ["We won an order from Acme: 6 Java developers for 12 months, ₹50 lakh, hiring budget ₹30 lakh"]
      : []),
    ...status.examples.filter((example) => !PRIVATE_EXAMPLE.test(example)),
  ].slice(0, 8);
  return (
    <div className="grid gap-5 py-6">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center">
          <AskMiraMark className="h-9" />
        </span>
        <div className="grid gap-1">
          <p className="text-sm font-medium">{status.name}</p>
          <p className="text-sm leading-6 text-muted-foreground">
            {status.mode === "ai"
              ? `Hi! I'm ${status.name}, ${company}'s AI companion. Ask me anything about the company: people, payroll, hiring, sales, purchases, expenses and IT. I show where each answer came from, and I can get things done once you press Confirm.`
              : `Hi! I'm ${status.name}, ${company}'s companion. Ask short, direct questions about people, payroll, hiring, expenses and IT, like the ones below.`}
          </p>
        </div>
      </div>
      {examples.length > 0 ? (
        <div className="grid gap-2">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3.5" /> Try asking
          </p>
          <div className="flex flex-wrap gap-2">
            {examples.map((example) => (
              <Button
                key={example}
                variant="outline"
                size="sm"
                className="h-auto max-w-full py-1.5 text-left whitespace-normal"
                onClick={() => onAsk(example)}
              >
                {example}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PinScreen({
  company,
  logo,
  problem,
  busy,
  onSubmit,
}: {
  company: string | null;
  logo: string | null;
  problem: string | null;
  busy: boolean;
  onSubmit: (pin: string) => void;
}) {
  const [pin, setPin] = useState("");
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <Card tier="tier2" className="w-full max-w-sm">
        <CardContent className="grid justify-items-center gap-4 text-center">
          <Brand company={company} logo={logo} />
          <div className="grid gap-1.5">
            <h1 className="font-display text-2xl">Ask the team for the PIN</h1>
            <p className="text-sm text-muted-foreground">
              This chat opens {company ?? "the company"}&apos;s live records, so the team at the stand opens it for
              you.
            </p>
          </div>
          <form
            className="grid w-full gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (pin.length >= 4 && !busy) onSubmit(pin);
            }}
          >
            <Input
              aria-label="PIN"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              type="password"
              maxLength={8}
              value={pin}
              placeholder="PIN"
              className="h-11 text-center text-lg tracking-[0.4em]"
              aria-invalid={Boolean(problem)}
              onChange={(event) => {
                const value = event.target.value.replace(/\D/g, "").slice(0, 8);
                setPin(value);
              }}
            />
            {problem ? (
              <p className="text-sm text-destructive" role="alert">
                {problem}
              </p>
            ) : null}
            <Button type="submit" disabled={pin.length < 4 || busy}>
              {busy ? <Loader2 className="animate-spin" /> : <KeyRound />} Open the chat
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

function LoadingScreen() {
  return (
    <main className="flex min-h-dvh flex-col bg-background">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Skeleton className="size-9 rounded-lg" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="mx-auto grid w-full max-w-4xl gap-3 p-4">
        <Skeleton className="h-16 w-3/4" />
        <Skeleton className="h-24 w-full" />
      </div>
    </main>
  );
}

function ClosedScreen({
  company,
  logo,
  title,
  message,
  action,
}: {
  company: string | null;
  logo: string | null;
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <Card tier="tier2" className="w-full max-w-md">
        <CardContent className="grid justify-items-center gap-4 text-center">
          <Brand company={company} logo={logo} />
          <div className="grid gap-1.5">
            <h1 className="font-display text-2xl">{title}</h1>
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
          {action}
          <p className="text-xs text-muted-foreground">AskMiraa by CGB Solutions</p>
        </CardContent>
      </Card>
    </main>
  );
}
