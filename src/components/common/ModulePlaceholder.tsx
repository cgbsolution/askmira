import { Construction, type LucideIcon } from "lucide-react";
import React from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Placeholder for a module whose screens are scaffolded but not built.
 *
 * States plainly what is coming and which FRD phase it belongs to, rather than
 * showing invented data. A pilot customer clicking through the product should
 * never be unsure whether a number is real.
 */
export function ModulePlaceholder({
  icon: Icon = Construction,
  phase,
  summary,
  scope,
  tier = "tier1",
}: {
  icon?: LucideIcon;
  phase: "V1" | "V2" | "V3" | "V4";
  summary: string;
  scope: string[];
  tier?: "tier1" | "tier2";
}) {
  return (
    <Card tier={tier}>
      <CardContent className="flex flex-col items-start gap-4 py-8 sm:flex-row sm:items-center">
        <span
          className={
            tier === "tier2"
              ? "flex size-12 shrink-0 items-center justify-center rounded-2xl bg-mint-100 text-brand-600"
              : "flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
          }
        >
          <Icon className="size-6" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-2">
            <p className="font-semibold text-foreground">Not built yet</p>
            <Badge variant={phase === "V1" ? "accent" : "muted"}>{phase}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{summary}</p>

          <ul className="mt-3 grid gap-1.5 text-sm text-muted-foreground sm:grid-cols-2">
            {scope.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-300" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
