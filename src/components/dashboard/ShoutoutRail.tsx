import { Heart } from "lucide-react";
import Link from "next/link";
import React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Culture rail (Tier 2) — the one saturated surface on the dashboard.
 *
 * It borrows the sidebar's token family rather than the card's, because like
 * the nav rail it stays deep teal in both themes instead of inverting with the
 * page. That is what lets it sit beside the flat Tier 1 payroll and compliance
 * cards without either one looking like a mistake (FRD 5.13).
 */
export function ShoutoutRail({ count, isLoading }: { count?: number; isLoading: boolean }) {
  return (
    <Card
      tier="tier2"
      className="relative isolate min-h-[320px] overflow-hidden border-transparent bg-gradient-to-b from-brand-500 to-brand-700 text-sidebar-foreground"
    >
      {/* Concentric rings, purely decorative — they give the flat gradient a
          focal point without introducing an image asset. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -right-20 size-72 rounded-full border border-sidebar-foreground/15"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-6 -right-2 size-40 rounded-full border border-sidebar-foreground/10"
      />

      <CardHeader className="relative">
        <CardTitle className="font-display text-lg">Shoutouts</CardTitle>
        <CardDescription className="text-sidebar-muted">
          Recognition from across the company.
        </CardDescription>
      </CardHeader>

      <CardContent className="relative flex flex-1 flex-col items-center justify-center gap-3 pb-8 text-center">
        {isLoading ? (
          <>
            <Skeleton className="size-14 rounded-full bg-sidebar-foreground/15" />
            <Skeleton className="h-4 w-44 bg-sidebar-foreground/15" />
            <Skeleton className="h-3 w-52 bg-sidebar-foreground/10" />
          </>
        ) : (
          <>
            <span className="flex size-14 items-center justify-center rounded-full bg-sidebar-foreground/15">
              <Heart className="size-6" />
            </span>
            <div>
              <p className="font-display text-base font-semibold">
                {count
                  ? `${count} shoutout${count === 1 ? "" : "s"} this week`
                  : "No shoutouts yet this week"}
              </p>
              <p className="mx-auto mt-1 max-w-[220px] text-sm text-sidebar-muted">
                {count
                  ? "See who was thanked, and add your own."
                  : "Thank someone for their work — it shows on the Culture feed."}
              </p>
            </div>
            <Button variant="secondary" size="sm" className="mt-1" asChild>
              <Link href="/culture">Open Culture</Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
