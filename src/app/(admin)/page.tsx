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
 * The four pulse numbers live inside the greeting card rather than in four
 * standalone tiles, so the top of the screen reads as one panel.
 */
export default function HomePage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Resolved after mount on purpose: the hour belongs to the viewer, and
  // rendering it during SSR would hand the client a different string to
  // hydrate.
  const [greeting, setGreeting] = useState("Hello");
  useEffect(() => setGreeting(greetingFor(new Date().getHours())), []);

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
    <div className="flex flex-col gap-5">
      {/* ── Greeting + pulse strip (Tier 2, one panel) ─────────────────── */}
      <Card tier="tier2" className="gap-0 overflow-hidden py-0">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-6">
          <div className="min-w-0">
            <h1 className="font-display text-[26px] font-semibold tracking-tight text-brand-800 sm:text-[30px] dark:text-mint-100">
              {greeting}, {firstName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isLoading
                ? "Loading your day…"
                : pending > 0
                  ? `${pending} request${pending === 1 ? "" : "s"} waiting on you.`
                  : "Nothing needs your approval right now."}
            </p>
          </div>
          <Button variant="accent" asChild>
            <Link href="/culture">
              <Sparkles /> Give a shoutout
            </Link>
          </Button>
        </div>

        {/* The 1px gap over a border-coloured parent draws the hairlines
            between cells, and re-flows on its own when the grid wraps. */}
        <div className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-4">
          <PulseStat label="Headcount" value={show(summary?.headcount)} icon={Users} />
          <PulseStat
            label="New hires"
            value={show(summary?.new_hires_30d)}
            icon={UserPlus}
            hint="30 days"
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
      </Card>

      {/* ── Operations left, culture right ─────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <div className="flex flex-col gap-5">
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
