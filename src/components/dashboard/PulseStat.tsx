import type { LucideIcon } from "lucide-react";
import React from "react";

import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * One of the home dashboard's pulse numbers, laid out like shadcn's section
 * cards: label and figure on the left, the icon as the card action, and what
 * the figure counts in the footer. The figure is whatever the API said — an
 * em-dash while it loads, never a placeholder number.
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
    <Card tier="tier1" className="h-full gap-4 py-5">
      <CardHeader className="px-5">
        <CardDescription className="truncate font-medium">{label}</CardDescription>
        <CardTitle className="text-3xl font-semibold tabular-nums">{value}</CardTitle>
        <CardAction>
          <span
            className={cn(
              "flex size-9 items-center justify-center rounded-lg",
              emphasis
                ? "bg-accent text-accent-foreground"
                : "bg-mint-100 text-brand-600 dark:bg-mint-900/40 dark:text-mint-200",
            )}
          >
            <Icon className="size-4" />
          </span>
        </CardAction>
      </CardHeader>
      {hint && (
        <CardFooter className="mt-auto px-5 text-xs text-muted-foreground">{hint}</CardFooter>
      )}
    </Card>
  );
}
