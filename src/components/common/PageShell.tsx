import React from "react";

import { cn } from "@/lib/utils";

/**
 * Standard page frame: title, optional description, actions, then content.
 *
 * `tier` sets the headline treatment per FRD 5.13 — Tier 2 screens (culture,
 * home, onboarding) get the warm slab serif; Tier 1 screens (payroll,
 * statutory, analytics, admin) stay on the grotesque, where precision reads
 * better than personality.
 */
export function PageShell({
  title,
  description,
  actions,
  tier = "tier1",
  className,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  tier?: "tier1" | "tier2";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1
            className={cn(
              "truncate text-2xl font-semibold tracking-tight text-foreground",
              tier === "tier2" && "font-display text-[28px]",
            )}
          >
            {title}
          </h1>
          {description && (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
