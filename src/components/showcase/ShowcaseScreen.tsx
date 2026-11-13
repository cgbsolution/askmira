"use client";

import {
  ArrowUp,
  Check,
  Clock,
  Loader2,
  Pause,
  Play,
  QrCode,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AskMiraMark } from "@/components/brand/AskMiraLogo";
import { CompanionCardView } from "@/components/companion/CompanionCards";
import { ChatText } from "@/components/companion/CompanionExtras";
import type { CompanionProposal } from "@/components/companion/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError, get, post } from "@/lib/api";
import { cn, formatDateTime } from "@/lib/utils";

import { ShowcaseBoardView } from "./ShowcaseBoard";
import { SystemBadge, SystemDot } from "./SystemBadge";
import type { ShowcaseChapter, ShowcaseDescription, ShowcaseMessage, ShowcaseRun } from "./types";

type Phase = "loading" | "ready" | "closed" | "missing" | "error";

const PUBLIC = { skipAuthRedirect: true } as const;
/** Pauses that make autoplay readable on a booth screen. */
const AUTOPLAY_READ = 2600;
const AUTOPLAY_CONFIRM = 2200;
const AUTOPLAY_RESTART = 25_000;
/** A reply never lands faster than this: Miraa "typing" reads better than a flash. */
const MIN_REPLY = 650;

// ── The visitor's story, kept in this browser only ──────────────────────────

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
    // Private windows and blocked storage: the story still runs, it just won't survive a reload.
  }
}

function forget(code: string): void {
  try {
    window.localStorage.removeItem(storeKey(code));
  } catch {
    // nothing kept, nothing to forget
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Whether the screen is wide enough for the chat and the board side by side. */
function useWide(): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setWide(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return wide;
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

// ── Screen ──────────────────────────────────────────────────────────────────

/**
 * What an exhibition QR code opens: one order from signature to day one, told
 * by Ask Miraa across Saleinx, the HRMS, AnytimeHire, ProcureFlow, CGB
 * Helpdesk and Expense Genie, with a live board of the figures. A sandbox: no
 * sign-in, and nothing here touches a real workspace.
 */
export function ShowcaseScreen({ code }: { code: string }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [described, setDescribed] = useState<ShowcaseDescription | null>(null);
  const [run, setRun] = useState<ShowcaseRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [autoplay, setAutoplay] = useState(false);
  const [tab, setTab] = useState("chat");
  const wide = useWide();
  const keyRef = useRef<string | null>(null);
  const busyRef = useRef(false);
  const autoplayRef = useRef(false);
  autoplayRef.current = autoplay;

  const closeWith = useCallback(
    async (fallback?: string) => {
      setAutoplay(false);
      try {
        const next = await get<ShowcaseDescription>(`/public/showcase/${code}`, PUBLIC);
        setDescribed(next);
      } catch {
        setDescribed((current) =>
          current ? { ...current, status: "off", message: fallback ?? "This showcase isn't open now." } : current,
        );
      }
      setPhase("closed");
    },
    [code],
  );

  const fresh = useCallback(async () => {
    const started = await post<ShowcaseRun>(`/public/showcase/${code}/runs`, undefined, PUBLIC);
    if (started.key) {
      keyRef.current = started.key;
      remember(code, started.run_id, started.key);
    }
    setRun(started);
    setPhase("ready");
  }, [code]);

  const open = useCallback(async () => {
    setPhase("loading");
    try {
      const about = await get<ShowcaseDescription>(`/public/showcase/${code}`, PUBLIC);
      setDescribed(about);
      if (about.status !== "live") {
        setPhase("closed");
        return;
      }
      const saved = recall(code);
      if (saved) {
        try {
          const kept = await get<ShowcaseRun>(`/public/showcase/${code}/runs/${saved.runId}`, {
            ...PUBLIC,
            headers: { "X-Showcase-Key": saved.key },
          });
          keyRef.current = saved.key;
          setRun(kept);
          setPhase("ready");
          return;
        } catch {
          forget(code);
        }
      }
      await fresh();
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 404) setPhase("missing");
      else if (caught instanceof ApiError && caught.status === 410) await closeWith(caught.message);
      else setPhase("error");
    }
  }, [closeWith, code, fresh]);

  useEffect(() => {
    void open();
  }, [open]);

  const step = useCallback(
    async (path: "say" | "decide", body: Record<string, unknown>, shown: string | null) => {
      if (!run || !keyRef.current || busyRef.current) return false;
      busyRef.current = true;
      setBusy(true);
      setSending(shown);
      const started = Date.now();
      try {
        const next = await post<ShowcaseRun>(`/public/showcase/${code}/runs/${run.run_id}/${path}`, body, {
          ...PUBLIC,
          headers: { "X-Showcase-Key": keyRef.current },
        });
        await sleep(Math.max(0, MIN_REPLY - (Date.now() - started)));
        setRun(next);
        return true;
      } catch (caught) {
        setAutoplay(false);
        if (caught instanceof ApiError && caught.status === 410) {
          await closeWith(caught.message);
        } else if (caught instanceof ApiError && caught.status === 404) {
          forget(code);
          toast.error("That story had gone, so a fresh one has started.");
          await fresh().catch(() => setPhase("error"));
        } else {
          toast.error(caught instanceof ApiError ? caught.message : "Could not reach Miraa. Check your connection.");
        }
        return false;
      } finally {
        busyRef.current = false;
        setBusy(false);
        setSending(null);
      }
    },
    [closeWith, code, fresh, run],
  );

  const say = useCallback(
    async (text: string, fromAutoplay = false) => {
      const clean = text.trim();
      if (!clean) return;
      if (!fromAutoplay) setAutoplay(false);
      if (await step("say", { text: clean.slice(0, 500) }, clean)) setDraft("");
    },
    [step],
  );

  const decide = useCallback(
    async (actionId: string, confirm: boolean, fromAutoplay = false) => {
      if (!fromAutoplay) setAutoplay(false);
      await step("decide", { action_id: actionId, confirm }, confirm ? "Yes." : "Cancel.");
    },
    [step],
  );

  const restart = useCallback(async () => {
    if (busyRef.current) return;
    forget(code);
    keyRef.current = null;
    setDraft("");
    setTab("chat");
    busyRef.current = true;
    setBusy(true);
    try {
      await fresh();
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 410) await closeWith(caught.message);
      else toast.error(caught instanceof ApiError ? caught.message : "Could not start again. Try once more.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [closeWith, code, fresh]);

  // Autoplay: the booth screen takes the story's own next step, typing it out first.
  useEffect(() => {
    if (!autoplay || phase !== "ready" || !run || busy) return;
    const next = run.autoplay;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (!next) {
      timers.push(setTimeout(() => !cancelled && void restart(), AUTOPLAY_RESTART));
    } else if ("say" in next) {
      timers.push(
        setTimeout(async () => {
          if (!prefersReducedMotion()) {
            for (let shown = 2; shown < next.say.length; shown += 2) {
              if (cancelled || !autoplayRef.current) return;
              setDraft(next.say.slice(0, shown));
              await sleep(22);
            }
          }
          if (cancelled || !autoplayRef.current) return;
          setDraft(next.say);
          await sleep(350);
          if (!cancelled && autoplayRef.current) void say(next.say, true);
        }, AUTOPLAY_READ),
      );
    } else {
      timers.push(setTimeout(() => !cancelled && void decide(next.decide, next.confirm, true), AUTOPLAY_CONFIRM));
    }
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [autoplay, busy, decide, phase, restart, run, say]);

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
  if (phase === "closed" || !run) {
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
            : "Ask the team at the stand to show you the story, or for a live demo with your own numbers."
        }
      />
    );
  }

  const current = run.chapters.find((chapter) => chapter.state === "current") ?? null;
  const doneCount = run.chapters.filter((chapter) => chapter.state === "done").length;
  const chat = (progressClass?: string) => (
    <Chat
      run={run}
      busy={busy}
      sending={sending}
      draft={draft}
      onDraft={(value) => {
        setAutoplay(false);
        setDraft(value);
      }}
      onSay={(text) => void say(text)}
      onDecide={(card, confirm) => void decide(card.action_id, confirm)}
      onRestart={() => void restart()}
      progress={
        <StoryProgress current={current} done={doneCount} total={run.chapters.length} className={progressClass} />
      }
    />
  );

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <Header
        run={run}
        autoplay={autoplay}
        busy={busy}
        onAutoplay={() => setAutoplay((on) => !on)}
        onRestart={() => void restart()}
      />
      {wide ? (
        // Laptops and booth screens: the chapters, the chat and the board side by side.
        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-72 shrink-0 overflow-y-auto border-r bg-card/40 p-4 min-[1600px]:block">
            <StoryRail chapters={run.chapters} busy={busy} onAsk={(chapter) => void say(chapter.prompt)} />
          </aside>
          <main className="flex min-w-0 flex-1">{chat("min-[1600px]:hidden")}</main>
          <aside className="w-[24rem] shrink-0 overflow-y-auto border-l bg-muted/30 p-3">
            <ShowcaseBoardView run={run} />
          </aside>
        </div>
      ) : (
        // Phones and tablets: one at a time.
        <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col gap-0">
          <div className="border-b px-3 py-2">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="chat">Chat</TabsTrigger>
              <TabsTrigger value="board">
                Live board
                <MarginChip run={run} />
              </TabsTrigger>
              <TabsTrigger value="story">
                Story {doneCount}/{run.chapters.length}
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="chat" className="flex min-h-0 flex-1">
            {chat()}
          </TabsContent>
          <TabsContent value="board" className="min-h-0 flex-1 overflow-y-auto p-3">
            <ShowcaseBoardView run={run} />
          </TabsContent>
          <TabsContent value="story" className="min-h-0 flex-1 overflow-y-auto p-4">
            <StoryRail
              chapters={run.chapters}
              busy={busy}
              onAsk={(chapter) => {
                setTab("chat");
                void say(chapter.prompt);
              }}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ── Pieces ──────────────────────────────────────────────────────────────────

function Brand({ company, logo }: { company: string | null; logo: string | null }) {
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
        <p className="truncate text-xs text-muted-foreground">with Ask Miraa</p>
      </div>
    </div>
  );
}

function Header({
  run,
  autoplay,
  busy,
  onAutoplay,
  onRestart,
}: {
  run: ShowcaseRun;
  autoplay: boolean;
  busy: boolean;
  onAutoplay: () => void;
  onRestart: () => void;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b bg-card px-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-3">
        <Brand company={run.company} logo={run.logo_url} />
        <Badge variant="warning" className="hidden shrink-0 sm:inline-flex">
          Sample story
        </Badge>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          size="sm"
          variant={autoplay ? "default" : "outline"}
          onClick={onAutoplay}
          aria-pressed={autoplay}
          title="Play the story by itself, for a booth screen"
        >
          {autoplay ? <Pause /> : <Play />}
          <span className="hidden sm:inline">{autoplay ? "Pause" : "Autoplay"}</span>
        </Button>
        <Button size="sm" variant="ghost" onClick={onRestart} disabled={busy} aria-label="Start over">
          <RotateCcw />
          <span className="hidden sm:inline">Start over</span>
        </Button>
      </div>
    </header>
  );
}

function MarginChip({ run }: { run: ShowcaseRun }) {
  if (run.board.margin.basis === "budget") return null;
  const under = Number.parseFloat(run.board.margin.now) < Number.parseFloat(run.board.margin.floor) - 0.0001;
  return (
    <span className={cn("ml-1 text-[11px] tabular-nums", under ? "text-warning" : "text-success")}>
      {run.board.margin.now}%
    </span>
  );
}

function StoryProgress({
  current,
  done,
  total,
  className,
}: {
  current: ShowcaseChapter | null;
  done: number;
  total: number;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-1.5 border-b bg-card/60 px-4 py-2.5", className)}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="truncate font-medium">
          {current ? `Step ${done + 1} of ${total}: ${current.title}` : "The whole story is done"}
        </span>
        {current ? (
          <span className="flex shrink-0 gap-1">
            {current.systems.map((system) => (
              <SystemDot key={system} system={system} />
            ))}
          </span>
        ) : null}
      </div>
      <Progress value={Math.round((done / total) * 100)} aria-label="Story progress" />
    </div>
  );
}

function StoryRail({
  chapters,
  busy,
  onAsk,
}: {
  chapters: ShowcaseChapter[];
  busy: boolean;
  onAsk: (chapter: ShowcaseChapter) => void;
}) {
  return (
    <div className="grid gap-3">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">The story</p>
        <p className="mt-1 text-sm text-muted-foreground">One signed order, from signature to day one, in one chat.</p>
      </div>
      <ol className="grid gap-1">
        {chapters.map((chapter, index) => {
          const isCurrent = chapter.state === "current";
          const isDone = chapter.state === "done";
          return (
            <li
              key={chapter.key}
              className={cn(
                "grid grid-cols-[1.75rem_minmax(0,1fr)] gap-2.5 rounded-xl p-2",
                isCurrent && "bg-card shadow-sm ring-1 ring-accent",
              )}
            >
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full text-xs font-semibold",
                  isDone && "bg-success text-primary-foreground",
                  isCurrent && "bg-accent text-accent-foreground",
                  !isDone && !isCurrent && "bg-muted text-muted-foreground",
                )}
                aria-hidden
              >
                {isDone ? <Check className="size-3.5" /> : index + 1}
              </span>
              <div className="min-w-0">
                <p className={cn("text-sm font-medium", !isDone && !isCurrent && "text-muted-foreground")}>
                  {chapter.title}
                  <span className="sr-only">{isDone ? " (done)" : isCurrent ? " (next)" : ""}</span>
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {chapter.systems.map((system) => (
                    <SystemBadge key={system} system={system} className="px-1.5 py-0 text-[10px]" />
                  ))}
                </div>
                {isCurrent ? (
                  <>
                    <p className="mt-1.5 text-xs text-muted-foreground">{chapter.blurb}</p>
                    <Button size="sm" className="mt-2 h-auto whitespace-normal py-1.5 text-left" disabled={busy} onClick={() => onAsk(chapter)}>
                      <Sparkles /> Ask Miraa
                    </Button>
                  </>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Chat({
  run,
  busy,
  sending,
  draft,
  onDraft,
  onSay,
  onDecide,
  onRestart,
  progress,
}: {
  run: ShowcaseRun;
  busy: boolean;
  sending: string | null;
  draft: string;
  onDraft: (value: string) => void;
  onSay: (text: string) => void;
  onDecide: (card: CompanionProposal, confirm: boolean) => void;
  onRestart: () => void;
  progress: React.ReactNode;
}) {
  const scroller = useRef<HTMLDivElement | null>(null);
  const count = run.messages.length;

  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [count, sending]);

  const suggestions = useMemo(() => run.suggestions.slice(0, 5), [run.suggestions]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {progress}
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6" aria-live="polite">
        <div className="mx-auto grid max-w-4xl gap-4">
          {run.messages.map((message) => (
            <MessageView key={message.id} message={message} busy={busy} onDecide={onDecide} />
          ))}
          {sending ? (
            <>
              <UserBubble text={sending} />
              <Typing />
            </>
          ) : null}
          {run.finished && !busy ? (
            <Card tier="tier2" className="border-accent/50">
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <QrCode className="size-5 text-accent-foreground" />
                  <p className="text-sm">
                    <span className="font-semibold">See it with your own numbers.</span> Ask the team for a live demo.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={onRestart}>
                  <RotateCcw /> Start over
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
      <div className="shrink-0 border-t bg-card px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-6">
        <div className="mx-auto grid max-w-4xl gap-2">
          {suggestions.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
              {suggestions.map((suggestion, index) => (
                <Button
                  key={suggestion}
                  size="sm"
                  variant={index === 0 ? "secondary" : "outline"}
                  className="h-auto shrink-0 rounded-full px-3 py-1.5 text-left text-xs whitespace-normal sm:max-w-full"
                  disabled={busy}
                  onClick={() => onSay(suggestion)}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          ) : null}
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!busy) onSay(draft);
            }}
          >
            <Input
              value={draft}
              maxLength={500}
              placeholder={run.finished ? "The story is done. Start over to run it again." : "Message Miraa"}
              aria-label="Message Miraa"
              className="h-11 rounded-full px-4"
              onChange={(event) => onDraft(event.target.value)}
            />
            <Button
              type="submit"
              size="icon"
              className="size-11 shrink-0 rounded-full"
              disabled={busy || !draft.trim()}
              aria-label="Send"
            >
              {busy ? <Loader2 className="animate-spin" /> : <ArrowUp />}
            </Button>
          </form>
          {run.turns_left <= 10 ? (
            <p className="text-center text-[11px] text-muted-foreground">
              {run.turns_left} messages left in this story. Start over for a fresh one.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function UserBubble({ text, when }: { text: string; when?: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-foreground px-4 py-2.5 text-sm text-background shadow-sm">
        <p className="whitespace-pre-wrap break-words">{text}</p>
        {when ? <p className="mt-1 text-right text-[10px] opacity-70">{when}</p> : null}
      </div>
    </div>
  );
}

function Elapsed({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-1" role="separator">
      <span className="h-px flex-1 bg-border" />
      <Badge variant="outline" className="gap-1.5 bg-card text-muted-foreground">
        <Clock className="size-3" /> {label}
      </Badge>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function MessageView({
  message,
  busy,
  onDecide,
}: {
  message: ShowcaseMessage;
  busy: boolean;
  onDecide: (card: CompanionProposal, confirm: boolean) => void;
}) {
  const elapsed = message.elapsed ? <Elapsed label={message.elapsed} /> : null;
  if (message.role === "user") {
    return (
      <>
        {elapsed}
        <UserBubble text={message.text} when={message.when} />
      </>
    );
  }
  return (
    <>
      {elapsed}
      <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-2.5">
        <AskMiraMark className="mt-0.5 h-8" />
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold">Miraa</span>
            {message.systems.map((system) => (
              <SystemBadge key={system} system={system} />
            ))}
            <span className="text-[11px] text-muted-foreground">{message.when}</span>
          </div>
          <div className="rounded-2xl rounded-tl-md border bg-card px-4 py-3 shadow-sm">
            <ChatText text={message.text} />
          </div>
          {message.cards.length > 0 ? (
            <div className="mt-2 grid gap-2">
              {message.cards.map((card, index) => (
                <CompanionCardView key={index} card={card} onDecide={onDecide} deciding={busy} />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

function Typing() {
  return (
    <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-2.5" aria-label="Miraa is working">
      <AskMiraMark className="mt-0.5 h-8" />
      <div className="flex w-fit items-center gap-1 rounded-2xl rounded-tl-md border bg-card px-4 py-3">
        {["[animation-delay:0ms]", "[animation-delay:120ms]", "[animation-delay:240ms]"].map((delay) => (
          <span
            key={delay}
            className={cn(
              "size-1.5 animate-bounce rounded-full bg-muted-foreground motion-reduce:animate-none",
              delay,
            )}
          />
        ))}
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="flex h-dvh flex-col bg-background">
      <div className="flex h-14 items-center gap-3 border-b bg-card px-4">
        <Skeleton className="size-8 rounded-lg" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="mx-auto grid w-full max-w-3xl gap-4 p-6">
        <Skeleton className="h-24 w-3/4" />
        <Skeleton className="ml-auto h-12 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
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


