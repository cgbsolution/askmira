"use client";

import { Inbox } from "lucide-react";
import React from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { ApprovalDecisionButtons } from "@/components/hiring/ApprovalDecisionButtons";
import { formatDateTime } from "@/components/hiring/labels";
import { RequisitionFlags } from "@/components/hiring/RequisitionFlags";
import { Badge } from "@/components/ui/badge";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { PendingDecision } from "@/lib/types/hiring";
import { humanizeRole } from "@/lib/utils";

/**
 * "Waiting on you": requisitions and offers at a step the viewer may sign.
 *
 * Only rendered for managers and HR (the API refuses everyone else).
 * `onDecided` lets the page refresh the requisition list after a decision.
 */
export function ApprovalQueue({ onDecided }: { onDecided?: () => void }) {
  const { data, error, isLoading, reload } = useApiQuery<PendingDecision[]>("/hiring/approvals");
  const items = data ?? [];

  return (
    <DataPanel
      title="Waiting on you"
      description="Requisitions and offers at an approval step you can sign."
      isLoading={isLoading && !data}
      error={error?.detail}
      onRetry={reload}
      isEmpty={items.length === 0}
      loadingRows={2}
      empty={{
        icon: Inbox,
        title: "Nothing is waiting on you",
        description: "A requisition or offer appears here when it reaches a step your role signs.",
      }}
    >
      <ul className="divide-y divide-border">
        {items.map((item) => (
          <li
            key={`${item.kind}-${item.id}`}
            className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-start md:justify-between"
          >
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={item.kind === "offer" ? "accent" : "secondary"}>
                  {item.kind === "offer" ? "Offer" : "Requisition"}
                </Badge>
                <span className="font-mono text-xs text-muted-foreground">{item.code}</span>
                <span className="font-medium text-foreground">{item.title}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Step <span className="tabular-nums">{item.step}</span> ·{" "}
                {humanizeRole(item.step_role)}
                {item.step_reason ? ` · ${item.step_reason}` : ""}
                {item.submitted_at ? ` · submitted ${formatDateTime(item.submitted_at)}` : ""}
              </p>
              <RequisitionFlags flags={item.flags} compact />
            </div>
            <ApprovalDecisionButtons
              kind={item.kind}
              id={item.id}
              code={item.code}
              onDecided={() => {
                reload();
                onDecided?.();
              }}
            />
          </li>
        ))}
      </ul>
    </DataPanel>
  );
}
