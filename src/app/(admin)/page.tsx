"use client";

import {
  CalendarClock,
  CircleDollarSign,
  Heart,
  ListChecks,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import React, { useEffect, useState } from "react";

import { StatTile } from "@/components/dashboard/StatTile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { get } from "@/lib/api";
import type { DashboardSummary } from "@/lib/types";

/**
 * Home dashboard.
 *
 * Deliberately mixes tiers, per FRD 5.13: the greeting, pulse tiles and
 * culture feed are Tier 2 (warm, soft-cornered); the payroll and compliance
 * widgets on the same screen stay Tier 1 (flat, precise). That contrast is the
 * point — the screen where money and statutory filings live should not look
 * like the screen where people thank each other.
 */
export default function HomePage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
  const show = (value: number | undefined) => (isLoading ? "—" : (value ?? 0));

  return (
    <div className="flex flex-col gap-6">
      {/* ── Greeting (Tier 2) ─────────────────────────────────────────── */}
      <div className="panel-mint flex flex-wrap items-center justify-between gap-4 px-6 py-5">
        <div>
          <h1 className="font-display text-[28px] font-semibold tracking-tight text-brand-800">
            Hi {firstName}
          </h1>
          <p className="mt-1 text-sm text-brand-700/80">
            {isLoading
              ? "Loading your day…"
              : summary && summary.pending_approvals > 0
                ? `${summary.pending_approvals} request${summary.pending_approvals === 1 ? "" : "s"} waiting on you.`
                : "Nothing needs your approval right now."}
          </p>
        </div>
        <Button variant="accent" asChild>
          <Link href="/culture">
            <Sparkles /> Give a shoutout
          </Link>
        </Button>
      </div>

      {/* ── Pulse row ─────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Headcount" value={show(summary?.headcount)} icon={Users} />
        <StatTile
          label="New hires"
          value={show(summary?.new_hires_30d)}
          icon={UserPlus}
          hint="Last 30 days"
        />
        <StatTile
          label="On leave today"
          value={show(summary?.on_leave_today)}
          icon={CalendarClock}
        />
        <StatTile
          label="Awaiting approval"
          value={show(summary?.pending_approvals)}
          icon={ListChecks}
          emphasis={Boolean(summary?.pending_approvals)}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Culture feed (Tier 2, prominent) ────────────────────────── */}
        <Card tier="tier2" className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-display text-lg">Shoutouts</CardTitle>
            <CardDescription>Recognition from across the company.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 rounded-2xl bg-mint-50 px-6 py-10 text-center dark:bg-mint-900/20">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-mint-200 text-brand-700">
                  <Heart className="size-5" />
                </span>
                <div>
                  <p className="font-medium text-foreground">
                    {summary?.shoutouts_this_week
                      ? `${summary.shoutouts_this_week} shoutouts this week`
                      : "No shoutouts yet this week"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    The feed lands with the Culture module in V1.
                  </p>
                </div>
                <Button variant="secondary" size="sm" asChild>
                  <Link href="/culture">Open Culture</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Payroll (Tier 1 — flat, on the same warm screen) ─────────── */}
        <div className="flex flex-col gap-6">
          <Card tier="tier1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CircleDollarSign className="size-4 text-brand-600" />
                Payroll
              </CardTitle>
              <CardDescription>Current cycle status.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
                <span className="text-sm text-muted-foreground">This cycle</span>
                <Badge variant="muted">No run yet</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                The computation engine ships in V1 step 4. Nothing here is estimated — a payroll
                figure appears only once a real run has been computed and signed off.
              </p>
            </CardContent>
          </Card>

          <Card tier="tier1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="size-4 text-brand-600" />
                Compliance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {["PF", "ESI", "Professional Tax", "TDS"].map((item) => (
                <div key={item} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{item}</span>
                  <Badge variant="outline">Awaiting rule set</Badge>
                </div>
              ))}
              <p className="pt-1 text-xs text-muted-foreground">
                Rule sets require Compliance SME sign-off before payroll can use them.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
