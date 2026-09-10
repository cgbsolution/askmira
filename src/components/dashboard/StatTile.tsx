import type { LucideIcon } from "lucide-react";
import React from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Compact stat tile for the home dashboard's pulse row.
 *
 * `tier` matters here: a headcount tile is Tier 2 warmth, but a payroll or
 * statutory tile stays Tier 1 even when surrounded by culture widgets — the
 * mixed dashboard is expected, not an inconsistency (FRD 5.13).
 */
export function StatTile({
  label,
  value,
  icon: Icon,
  hint,
  tier = "tier2",
  emphasis = false,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  tier?: "tier1" | "tier2";
  emphasis?: boolean;
}) {
  return (
    <Card tier={tier} className="gap-0 py-4">
      <div className="flex items-start gap-3 px-4">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center",
            tier === "tier2" ? "rounded-xl" : "rounded-md",
            emphasis
              ? "bg-accent text-accent-foreground"
              : "bg-mint-100 text-brand-600 dark:bg-mint-900/40 dark:text-mint-200",
          )}
        >
          <Icon className="size-[18px]" />
        </span>
        <div className="min-w-0">
          <p className="text-2xl font-semibold leading-tight tracking-tight text-foreground">
            {value}
          </p>
          <p className="truncate text-[13px] font-medium text-muted-foreground">{label}</p>
          {hint && <p className="mt-0.5 truncate text-[11px] text-muted-foreground/80">{hint}</p>}
        </div>
      </div>
    </Card>
  );
}
