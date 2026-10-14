import type { LucideIcon } from "lucide-react";
import React from "react";

import { Tr } from "@/lib/i18n/Tr";
import { cn } from "@/lib/utils";

/**
 * The "nothing here yet" state for a list or panel.
 *
 * Says what will appear and, where there is one, the action that makes it
 * appear. Never a placeholder figure standing in for real data.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  tier = "tier1",
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  tier?: "tier1" | "tier2";
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 px-6 py-14 text-center", className)}>
      <span
        className={cn(
          "flex size-12 items-center justify-center",
          tier === "tier2"
            ? "rounded-2xl bg-mint-100 text-brand-600 dark:bg-mint-900/40 dark:text-mint-200"
            : "rounded-lg bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-6" />
      </span>
      <div className="max-w-md">
        <p className="font-medium text-foreground">
          <Tr text={title} />
        </p>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">
            <Tr text={description} />
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
