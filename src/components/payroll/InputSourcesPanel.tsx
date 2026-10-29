import { Inbox } from "lucide-react";
import React from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { Badge } from "@/components/ui/badge";
import type { InputSourceStatus, PayrollRun } from "@/lib/types/payroll";

const STATUS: Record<
  InputSourceStatus,
  { label: string; variant: "success" | "muted" | "warning" | "destructive" }
> = {
  included: { label: "Included", variant: "success" },
  nothing_due: { label: "Nothing due", variant: "muted" },
  not_available: { label: "Not available yet", variant: "warning" },
  blocked: { label: "Held back", variant: "destructive" },
};

/** What each other module contributed to this run, as recorded at compute. */
export function InputSourcesPanel({ run }: { run: PayrollRun }) {
  // People left out for having no salary, and people another open run also
  // pays in full, have their own warnings at the top of the run.
  const notices = run.input_notices.filter(
    (notice) => notice.key !== "no_salary" && notice.key !== "whole_month_elsewhere",
  );
  return (
    <DataPanel
      title="Other sources"
      description="Loans, reimbursements, arrears, encashment, bonus, perquisites, referral bonuses and advance recoveries."
      isEmpty={run.input_sources.length === 0}
      empty={{
        icon: Inbox,
        title: "Not computed yet",
        description: "Sources are checked when the run is computed.",
      }}
    >
      <ul className="divide-y divide-border">
        {run.input_sources.map((source) => {
          const meta = STATUS[source.status] ?? STATUS.nothing_due;
          return (
            <li key={source.key} className="flex flex-wrap items-start justify-between gap-2 px-5 py-3">
              <div className="min-w-0 max-w-2xl">
                <p className="text-sm font-medium text-foreground">{source.label}</p>
                <p className="text-xs text-muted-foreground">{source.message}</p>
              </div>
              <Badge variant={meta.variant}>{meta.label}</Badge>
            </li>
          );
        })}
      </ul>
      {notices.length > 0 && (
        <div className="border-t border-border px-5 py-3">
          <p className="mb-1 text-xs font-medium text-foreground">Left unprocessed, and why</p>
          <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
            {notices.map((notice, index) => (
              <li key={`${notice.key}-${index}`}>
                {notice.label}: {notice.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </DataPanel>
  );
}
