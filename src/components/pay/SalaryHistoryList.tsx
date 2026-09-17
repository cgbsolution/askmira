import { History } from "lucide-react";
import React from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { Money } from "@/components/common/Money";
import { Badge } from "@/components/ui/badge";
import type { SalaryRecord } from "@/lib/types/payroll";
import { formatDay } from "@/lib/utils";

/** An effective-dated salary series, newest first. Used by HR and by the employee. */
export function SalaryHistoryList({
  rows,
  isLoading = false,
  error,
  onRetry,
  structureName,
  title = "Salary history",
}: {
  rows: SalaryRecord[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  structureName?: (structureId: string) => string | undefined;
  title?: string;
}) {
  return (
    <DataPanel
      title={title}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={rows.length === 0}
      empty={{ icon: History, title: "No salary recorded", description: "A salary appears here once it is assigned." }}
    >
      <ul className="divide-y divide-border">
        {rows.map((row) => (
          <li key={row.id} className="px-5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-foreground">
                <Money value={row.ctc_annual} /> a year
              </p>
              {row.effective_to ? (
                <Badge variant="muted">
                  {formatDay(row.effective_from, true)} – {formatDay(row.effective_to, true)}
                </Badge>
              ) : (
                <Badge variant="success">Current, from {formatDay(row.effective_from, true)}</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {row.structure_name ?? structureName?.(row.structure_id) ?? "Salary structure"}
              {row.revision_reason ? ` · ${row.revision_reason}` : ""}
            </p>
            <ul className="mt-2 grid gap-x-6 gap-y-0.5 text-xs sm:grid-cols-2">
              {row.components.map((component) => (
                <li key={component.component_code} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{component.component_name}</span>
                  <span>
                    <Money value={component.monthly_amount} /> / month
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </DataPanel>
  );
}
