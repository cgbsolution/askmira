"use client";

import React from "react";

import { Badge } from "@/components/ui/badge";
import type { ApprovalStep } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_VARIANT: Record<ApprovalStep["status"], "success" | "warning" | "muted" | "destructive"> = {
  approved: "success",
  pending: "warning",
  skipped: "muted",
  rejected: "destructive",
};

/** One line on where a chained request stands: who it waits on, and the step. */
export function chainSummary(chain: ApprovalStep[] | undefined | null): string | null {
  if (!chain || chain.length === 0) return null;
  const index = chain.findIndex((step) => step.status === "pending");
  if (index < 0) return null;
  const step = chain[index];
  return chain.length > 1
    ? `Step ${index + 1} of ${chain.length}: ${step.approver_name}`
    : `Waiting on ${step.approver_name}`;
}

/** Every approver in order, with who decided each step and what they said. */
export function ApprovalChain({ chain, className }: { chain: ApprovalStep[]; className?: string }) {
  if (chain.length === 0) return null;
  return (
    <ol className={cn("grid gap-2", className)}>
      {chain.map((step, index) => (
        <li key={`${step.step}-${index}`} className="flex flex-wrap items-center gap-2 text-sm">
          <span className="w-14 shrink-0 text-muted-foreground">Step {index + 1}</span>
          <span className="font-medium text-foreground">{step.approver_name}</span>
          <Badge variant={STATUS_VARIANT[step.status]}>{step.status}</Badge>
          {step.decided_by_name && step.decided_by_name !== step.approver_name && (
            <span className="text-xs text-muted-foreground">by {step.decided_by_name}</span>
          )}
          {step.note && <span className="basis-full pl-16 text-xs text-muted-foreground">“{step.note}”</span>}
        </li>
      ))}
    </ol>
  );
}
