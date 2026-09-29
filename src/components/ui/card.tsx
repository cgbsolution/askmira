import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Card, with the FRD 5.13 tiering built in.
 *
 *   tier="tier1"  payroll, statutory, analytics, admin — flat and precise
 *   tier="tier2"  home, culture, onboarding — soft and warm
 *
 * Pick the tier by the rule of thumb: if a mistake on this screen costs money
 * or triggers a statutory filing, it is Tier 1.
 */
type CardTier = "tier1" | "tier2";

function Card({
  className,
  tier = "tier1",
  ...props
}: React.ComponentProps<"div"> & { tier?: CardTier }) {
  return (
    <div
      data-slot="card"
      data-tier={tier}
      className={cn(
        "flex flex-col gap-6 py-6 text-card-foreground",
        tier === "tier1" ? "card-tier1" : "card-tier2",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "grid auto-rows-min items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto]",
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("text-lg font-semibold leading-tight tracking-tight", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("px-6", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      {...props}
    />
  );
}

export { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
