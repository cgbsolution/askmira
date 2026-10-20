"use client";

import {
  ArrowLeft,
  ChevronRight,
  CircleHelp,
  LifeBuoy,
  Lightbulb,
  ListChecks,
  Search,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/context/AuthContext";
import { NAV, decideAccess, resolvePage, roleAllows } from "@/lib/access";
import { GUIDES, guideFor, type PageGuide } from "@/lib/help";

/** The page's own name, from the navigation map, for a guide key or a path. */
function pageName(path: string): string {
  const concrete = path.replace(/\[[^\]]+\]/g, "x");
  return resolvePage(concrete)?.page.name ?? "This page";
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

/**
 * The Help button in the top bar and the guide it opens.
 *
 * Opens on the guide for the page in view. "All help topics" lists every guide
 * the person can use (only pages they can open), with a search, and reads any
 * of them in place. Press "?" anywhere outside a text field to open it.
 */
export function HelpButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "?" && !event.metaKey && !event.ctrlKey && !isTyping(event.target)) {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className={className}
        onClick={() => setOpen(true)}
        aria-label="Help for this page"
        title="Help for this page (?)"
      >
        <CircleHelp />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-lg">
          {open ? <HelpBody onNavigate={() => setOpen(false)} /> : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

function HelpBody({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const { user, tenant } = useAuth();
  const here = guideFor(pathname);
  const [viewing, setViewing] = useState<string | null>(null);
  const [browsing, setBrowsing] = useState(!here);

  const shown = viewing ? { key: viewing, guide: GUIDES[viewing] } : here;
  const title = viewing ? pageName(viewing) : pageName(pathname);
  const canOpen = (path: string) => decideAccess(path, user, tenant) === "allowed";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SheetHeader className="border-b px-6 py-5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          <CircleHelp className="size-4" /> Help
        </div>
        <SheetTitle className="text-lg">
          {browsing ? "All help topics" : title}
        </SheetTitle>
        <SheetDescription>
          {browsing
            ? "Guides for every page you can open. Pick one to read it here."
            : shown
              ? shown.guide.summary
              : "There is no guide for this page yet. Browse all topics, or ask below."}
        </SheetDescription>
      </SheetHeader>

      <ScrollArea className="min-h-0 flex-1">
        <div className="grid gap-6 px-6 py-5">
          {browsing ? (
            <TopicIndex
              canOpen={canOpen}
              onPick={(key) => {
                setViewing(key === here?.key ? null : key);
                setBrowsing(false);
              }}
            />
          ) : (
            <>
              {viewing ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setViewing(null)}>
                    <ArrowLeft /> Back to this page&apos;s help
                  </Button>
                  {canOpen(viewing) && !viewing.includes("[") ? (
                    <Button asChild size="sm" variant="outline" onClick={onNavigate}>
                      <Link href={viewing}>Go to {pageName(viewing)}</Link>
                    </Button>
                  ) : null}
                </div>
              ) : null}
              {shown ? <GuideView guide={shown.guide} canOpen={canOpen} onNavigate={onNavigate} /> : null}
            </>
          )}
        </div>
      </ScrollArea>

      <div className="grid gap-3 border-t px-6 py-4">
        <Button variant="outline" className="justify-start" onClick={() => setBrowsing((b) => !b)}>
          {browsing ? <ArrowLeft /> : <Search />}
          {browsing ? "Back to the guide" : "All help topics"}
        </Button>
        <div className="grid grid-cols-2 gap-2">
          {canOpen("/ask-mira") ? (
            <Button asChild variant="secondary" onClick={onNavigate}>
              <Link href="/ask-mira">
                <Sparkles /> Ask Mira
              </Link>
            </Button>
          ) : null}
          {canOpen("/helpdesk") ? (
            <Button asChild variant="secondary" onClick={onNavigate}>
              <Link href="/helpdesk">
                <LifeBuoy /> Raise a ticket
              </Link>
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">Tip: press ? on any page to open its help.</p>
      </div>
    </div>
  );
}

function GuideView({
  guide,
  canOpen,
  onNavigate,
}: {
  guide: PageGuide;
  canOpen: (path: string) => boolean;
  onNavigate: () => void;
}) {
  const { user } = useAuth();
  const tasks = guide.tasks.filter((task) => !task.roles || roleAllows(user, task.roles));
  const related = (guide.related ?? []).filter((link) => canOpen(link.href));

  return (
    <>
      {tasks.length > 0 ? (
        <section className="grid gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <ListChecks className="size-4 text-primary" /> How to
          </h3>
          <div className="grid gap-2">
            {tasks.map((task, index) => (
              <Collapsible key={task.title} defaultOpen={index === 0} className="rounded-lg border bg-card">
                <CollapsibleTrigger className="group flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium">
                  {task.title}
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ol className="grid list-decimal gap-1.5 pr-4 pb-4 pl-9 text-sm text-muted-foreground marker:text-primary">
                    {task.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </section>
      ) : null}

      {guide.tips?.length ? (
        <section className="grid gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Lightbulb className="size-4 text-accent-foreground" /> Good to know
          </h3>
          <ul className="grid list-disc gap-1.5 pl-5 text-sm text-muted-foreground">
            {guide.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {related.length ? (
        <section className="grid gap-2">
          <Separator />
          <h3 className="text-sm font-semibold">Related pages</h3>
          <div className="flex flex-wrap gap-2">
            {related.map((link) => (
              <Button key={link.href} asChild size="sm" variant="outline" onClick={onNavigate}>
                <Link href={link.href}>{link.label}</Link>
              </Button>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

/** Every guide the person can use, grouped by section, with a search. */
function TopicIndex({
  canOpen,
  onPick,
}: {
  canOpen: (path: string) => boolean;
  onPick: (key: string) => void;
}) {
  const [term, setTerm] = useState("");
  const groups = useMemo(() => {
    const query = term.trim().toLowerCase();
    return NAV.map((section) => ({
      name: section.name,
      pages: section.pages.filter((page) => {
        const guide = GUIDES[page.path];
        if (!guide || !canOpen(page.path)) return false;
        if (!query) return true;
        const text = [
          page.name,
          section.name,
          guide.summary,
          ...guide.tasks.flatMap((t) => [t.title, ...t.steps]),
          ...(guide.tips ?? []),
        ]
          .join(" ")
          .toLowerCase();
        return text.includes(query);
      }),
    })).filter((group) => group.pages.length > 0);
  }, [term, canOpen]);

  return (
    <div className="grid gap-4">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search help, e.g. leave, payslip, approve"
          aria-label="Search help topics"
          className="pl-9"
          autoFocus
        />
      </div>
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing matches “{term}”. Try another word.</p>
      ) : null}
      {groups.map((group) => (
        <div key={group.name} className="grid gap-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.name}</p>
          {group.pages.map((page) => (
            <Button
              key={page.path}
              variant="ghost"
              onClick={() => onPick(page.path)}
              className="h-auto justify-between px-2 py-2 font-normal"
            >
              <span>{page.name}</span>
              <Badge variant="outline">
                {GUIDES[page.path].tasks.length} {GUIDES[page.path].tasks.length === 1 ? "how-to" : "how-tos"}
              </Badge>
            </Button>
          ))}
        </div>
      ))}
    </div>
  );
}
