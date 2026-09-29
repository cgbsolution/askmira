import type { LucideIcon } from "lucide-react";
import React from "react";

import { cn } from "@/lib/utils";

/**
 * One of the home dashboard's pulse numbers: a small card with the icon and
 * label on top and the figure beneath. The figure is whatever the API said —
 * an em-dash while it loads, never a placeholder number.
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
    <div className="card-tier1 flex h-full flex-col p-5">
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl",
            emphasis
              ? "bg-accent text-accent-foreground"
              : "bg-mint-100 text-brand-600 dark:bg-mint-900/40 dark:text-mint-200",
          )}
        >
          <Icon className="size-4" />
        </span>
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-muted-foreground">{label}</p>
      </div>
      <p className="mt-5 text-3xl leading-none font-bold tracking-tight text-foreground tabular-nums">
        {value}
      </p>
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
