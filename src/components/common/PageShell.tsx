"use client";

import type { LucideIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import React from "react";

import { GROUP_LABEL, resolvePage } from "@/lib/access";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Standard page frame: a header banner, then the page.
 *
 * Every screen opens the same way — the section's icon, an eyebrow saying
 * where you are, the title, one line on what the page is for, and the page's
 * actions on the right. Icon and eyebrow come from `lib/access.ts`, the map
 * the navigation is built from, unless a page passes its own.
 *
 * `tier` sets the treatment per FRD 5.13 — Tier 2 screens (culture, home,
 * onboarding) get the warm wash and the slab serif; Tier 1 screens (payroll,
 * statutory, analytics, admin) stay on a near-flat card and the grotesque,
 * where precision reads better than personality.
 */
export function PageShell({
  title,
  description,
  actions,
  icon,
  eyebrow,
  tier = "tier1",
  className,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  icon?: LucideIcon;
  eyebrow?: string;
  tier?: "tier1" | "tier2";
  className?: string;
  children: React.ReactNode;
}) {
  const t = useT();
  const resolved = resolvePage(usePathname());
  const section = resolved?.section;
  const Icon = icon ?? resolved?.page.icon ?? section?.icon;
  // The section names the place, unless the page is the section's own front
  // page ("People" on People) — then the group it sits in does.
  const label =
    eyebrow ??
    (section ? (section.name === title ? GROUP_LABEL[section.group] : section.name) : undefined);

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <header
        className={cn(
          "relative overflow-hidden rounded-2xl border p-5 sm:p-6",
          tier === "tier2"
            ? "border-mint-200 bg-gradient-to-br from-mint-50 via-card to-mustard-50 dark:border-mint-900 dark:from-mint-900/30 dark:via-card dark:to-mustard-950/30"
            : "border-border bg-gradient-to-br from-mint-25 via-card to-card dark:from-mint-950/40",
        )}
      >
        {tier === "tier2" && (
          <>
            <span
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-mint-200/50 blur-3xl dark:bg-mint-800/20"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute -bottom-20 -left-10 size-48 rounded-full bg-mustard-200/40 blur-3xl dark:bg-mustard-800/10"
            />
          </>
        )}

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            {Icon && (
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-card text-primary shadow-sm ring-1 ring-border">
                <Icon className="size-5" />
              </span>
            )}
            <div className="min-w-0">
              {label && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-card/80 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary shadow-sm ring-1 ring-mint-200 dark:ring-mint-800">
                  <span aria-hidden className="size-1.5 rounded-full bg-accent" />
                  {t(label)}
                </span>
              )}
              <h1
                className={cn(
                  "mt-1 text-xl font-bold tracking-tight text-foreground sm:text-2xl",
                  tier === "tier2" && "font-display font-semibold sm:text-[28px]",
                )}
              >
                {t(title)}
              </h1>
              {description && (
                <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{t(description)}</p>
              )}
            </div>
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
      </header>
      {children}
    </div>
  );
}
