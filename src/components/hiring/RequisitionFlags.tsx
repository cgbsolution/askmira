import { AlertTriangle, Info } from "lucide-react";
import React from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import type { BudgetFlag } from "@/lib/types/hiring";
import { cn } from "@/lib/utils";

/**
 * Budget flags on a requisition or offer, most serious first.
 *
 * A `blocking_attention` flag is shown as a destructive alert so an approver
 * cannot sign past it without seeing it; anything else is informational.
 */
export function RequisitionFlags({
  flags,
  compact = false,
  className,
}: {
  flags: BudgetFlag[];
  compact?: boolean;
  className?: string;
}) {
  if (flags.length === 0) return null;
  const ordered = [...flags].sort(
    (a, b) => Number(b.severity === "blocking_attention") - Number(a.severity === "blocking_attention"),
  );

  if (compact) {
    return (
      <ul className={cn("space-y-1", className)}>
        {ordered.map((flag, index) => {
          const blocking = flag.severity === "blocking_attention";
          return (
            <li
              key={`${flag.kind}-${index}`}
              className={cn(
                "flex items-start gap-1.5 text-xs",
                blocking ? "font-medium text-destructive" : "text-muted-foreground",
              )}
            >
              {blocking ? (
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              ) : (
                <Info className="mt-0.5 size-3.5 shrink-0" />
              )}
              {flag.message}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {ordered.map((flag, index) => {
        const blocking = flag.severity === "blocking_attention";
        return (
          <Alert
            key={`${flag.kind}-${index}`}
            variant={blocking ? "destructive" : "default"}
            className={cn(blocking && "border-destructive/40 bg-destructive/5")}
          >
            {blocking ? <AlertTriangle /> : <Info />}
            <AlertDescription className={cn(blocking && "font-medium")}>
              {flag.message}
            </AlertDescription>
          </Alert>
        );
      })}
    </div>
  );
}
