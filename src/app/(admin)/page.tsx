"use client";

import {
  CalendarClock,
  CircleDollarSign,
  ListChecks,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import React, { useEffect, useState } from "react";

import { PulseStat } from "@/components/dashboard/PulseStat";
import { ShoutoutRail } from "@/components/dashboard/ShoutoutRail";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { get } from "@/lib/api";
import type { DashboardSummary } from "@/lib/types";
import { initials } from "@/lib/utils";

const STATUTORY_HEADS = ["PF", "ESI", "Professional Tax", "TDS"];

function greetingFor(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * Home dashboard.
 *
 * Deliberately mixes tiers, per FRD 5.13. The greeting card and the culture
 * rail are Tier 2 (soft radius, warm fills); the payroll and compliance cards
 * beside them stay Tier 1 (flat, hairline-bordered). That contrast is the
 * point — the screen where money and statutory filings live should not look
 * like the screen where people thank each other.
 *
 * The greeting banner and the four pulse cards follow the shell every screen
 * shares: banner first, then a row of figures, then the working cards.
 */
export default function HomePage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Resolved after mount on purpose: the hour belongs to the viewer, and
  // rendering it during SSR would hand the client a different string to
  // hydrate.
  const [greeting, setGreeting] = useState("Hello");
  const [today, setToday] = useState("");
  useEffect(() => {
    const now = new Date();
    setGreeting(greetingFor(now.getHours()));
    setToday(now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    get<DashboardSummary>("/dashboard/summary")
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch(() => {
        // The shell stays usable on a failed summary; tiles fall back to em-dashes.
        if (!cancelled) setSummary(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const firstName = summary?.greeting_name ?? user?.full_name?.split(" ")[0] ?? "there";
  const pending = summary?.pending_approvals ?? 0;
  const show = (value: number | undefined) => (isLoading ? "—" : (value ?? 0));

  return (
    <div className="flex flex-col gap-6">
      {/* ── Greeting (Tier 2) ──────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-2xl border border-mint-200 bg-gradient-to-br from-mint-50 via-card to-mustard-50 p-5 sm:p-6 dark:border-mint-900 dark:from-mint-900/30 dark:via-card dark:to-mustard-950/30">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-mint-200/50 blur-3xl dark:bg-mint-800/20"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-20 -left-10 size-48 rounded-full bg-mustard-200/40 blur-3xl dark:bg-mustard-800/10"
        />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar className="size-12 ring-4 ring-card sm:size-14">
              <AvatarFallback className="bg-primary text-sm font-semibold text-primary-foreground sm:text-base">
                {initials(user?.full_name ?? firstName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-muted-foreground">{today}</p>
              <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-brand-800 sm:text-3xl dark:text-mint-100">
                {greeting}, {firstName}
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {isLoading
                  ? "Loading your day…"
                  : pending > 0
                    ? `${pending} request${pending === 1 ? "" : "s"} waiting on you.`
                    : "Nothing needs your approval right now."}
              </p>
            </div>
          </div>
          <Button variant="accent" size="lg" asChild>
            <Link href="/culture">
              <Sparkles /> Give a shoutout
            </Link>
          </Button>
        </div>
      </section>

      {/* ── Pulse ──────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PulseStat label="Headcount" value={show(summary?.headcount)} icon={Users} />
        <PulseStat
          label="New hires"
          value={show(summary?.new_hires_30d)}
          icon={UserPlus}
          hint="Last 30 days"
        />
        <PulseStat
          label="On leave today"
          value={show(summary?.on_leave_today)}
          icon={CalendarClock}
        />
        <PulseStat
          label="Awaiting approval"
          value={show(summary?.pending_approvals)}
          icon={ListChecks}
          emphasis={pending > 0}
        />
      </div>

      {/* ── Operations left, culture right ─────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <div className="flex flex-col gap-6">
          {/* Payroll (Tier 1 — flat, on the same warm screen) */}
          <Card tier="tier1" className="flex-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CircleDollarSign className="size-4 text-brand-600 dark:text-brand-300" />
                Payroll
              </CardTitle>
              <CardDescription>Current cycle status.</CardDescription>
              <CardAction>
                <Badge variant="muted">No run yet</Badge>
              </CardAction>
            </CardHeader>
            <CardContent>
              <p className="rounded-md bg-muted/60 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                The computation engine ships in V1 step 4. Nothing here is estimated — a payroll
                figure appears only once a real run has been computed and signed off.
              </p>
            </CardContent>
          </Card>

          {/* Compliance (Tier 1) */}
          <Card tier="tier1" className="flex-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="size-4 text-brand-600 dark:text-brand-300" />
                Compliance
              </CardTitle>
              <CardDescription>
                Statutory rule sets require Compliance SME sign-off before payroll can use them.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2">
                {STATUTORY_HEADS.map((head) => (
                  <div
                    key={head}
                    className="flex items-center justify-between gap-2 rounded-md bg-muted/60 px-3 py-2.5"
                  >
                    <span className="text-sm text-foreground">{head}</span>
                    <Badge variant="warning">Awaiting</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <ShoutoutRail count={summary?.shoutouts_this_week} isLoading={isLoading} />
      </div>
    </div>
  );
}
