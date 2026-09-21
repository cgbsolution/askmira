import type { LucideIcon } from "lucide-react";
import React from "react";

import { cn } from "@/lib/utils";

/**
 * One cell of the home dashboard's pulse strip.
 *
 * Deliberately not a card of its own. The strip sits inside the greeting card
 * so the four numbers read as a single instrument panel rather than four
 * widgets competing for the same row; the hairlines between cells come from
 * the parent grid's 1px gap, not from a border here.
 */
export function PulseStat({
  label,
  value,
  icon: Icon,
  hint,
  emphasis = false,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 bg-card px-5 py-4">
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl",
          emphasis
            ? "bg-accent text-accent-foreground"
            : "bg-mint-100 text-brand-600 dark:bg-mint-900/40 dark:text-mint-200",
        )}
      >
        <Icon className="size-[18px]" />
      </span>
      <div className="min-w-0">
        <p className="font-display text-[22px] font-semibold leading-none tracking-tight text-foreground">
          {value}
        </p>
        <p className="mt-1.5 truncate text-[13px] text-muted-foreground">
          {label}
          {hint ? <span className="text-muted-foreground/70"> &middot; {hint}</span> : null}
        </p>
      </div>
    </div>
  );
}
