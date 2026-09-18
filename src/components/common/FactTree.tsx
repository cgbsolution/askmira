import React from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Render a narrative JSON document — a posture statement, a published policy —
 * as readable prose rather than raw JSON.
 *
 * For documents whose shape is owned by the backend and changes as the product
 * grows: keys become labels, lists of strings become bullet lists, booleans
 * become yes/no, and nested objects indent. Depth is capped so a runaway
 * document cannot swallow the page.
 */
export function FactTree({ value, depth = 0, className }: { value: unknown; depth?: number; className?: string }) {
  if (value === null || value === undefined || value === "") return <span className="text-muted-foreground">—</span>;
  if (typeof value === "boolean") return <Badge variant={value ? "success" : "outline"}>{value ? "Yes" : "No"}</Badge>;
  if (typeof value === "number") return <span className="tabular-nums">{value.toLocaleString("en-IN")}</span>;
  if (typeof value === "string") return <span className="whitespace-pre-line">{value}</span>;

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground">None</span>;
    if (value.every((item) => typeof item !== "object" || item === null)) {
      return (
        <ul className={cn("list-disc space-y-1 pl-5", className)}>
          {value.map((item, index) => (
            <li key={index}>
              <FactTree value={item} depth={depth + 1} />
            </li>
          ))}
        </ul>
      );
    }
    if (depth >= 4) return <span className="text-muted-foreground">{value.length} entries</span>;
    return (
      <div className={cn("grid gap-2", className)}>
        {value.map((item, index) => (
          <div key={index} className="rounded-md border border-border p-3">
            <FactTree value={item} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === "object") {
    if (depth >= 4) return <span className="text-muted-foreground">…</span>;
    return (
      <dl className={cn("grid gap-2", className)}>
        {Object.entries(value as Record<string, unknown>).map(([key, item]) => (
          <div key={key} className="grid gap-0.5 sm:grid-cols-[200px_1fr] sm:gap-3">
            <dt className="text-xs font-medium text-muted-foreground capitalize">{key.replaceAll("_", " ")}</dt>
            <dd className="min-w-0 text-sm text-foreground">
              <FactTree value={item} depth={depth + 1} />
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  return <span>{String(value)}</span>;
}
