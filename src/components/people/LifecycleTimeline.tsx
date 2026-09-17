"use client";

import { FileSignature, History, Lock } from "lucide-react";
import React from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { EmptyState } from "@/components/common/EmptyState";
import { Money } from "@/components/common/Money";
import { EVENT_TYPE, FIELD_LABEL } from "@/components/people/labels";
import { EventStatusBadge } from "@/components/people/StatusBadges";
import { useOrgReference } from "@/components/people/useOrgReference";
import { Badge } from "@/components/ui/badge";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { EmployeeHistory } from "@/lib/types/people";
import { formatDate, formatDay } from "@/lib/utils";

/** Renders an event's before/after value readably: ids become names. */
export function useFieldValue() {
  const org = useOrgReference();
  return (field: string, value: unknown): string => {
    if (value === null || value === undefined || value === "") return "—";
    const text = String(value);
    if (field === "department_id") return org.departmentName(text);
    if (field === "location_id") return org.locationName(text);
    if (field === "probation_end_date") return formatDay(text, true);
    if (field === "manager_id") return "another manager";
    return text.replace(/_/g, " ");
  };
}

/**
 * Every lifecycle event on one person — effective date, approver, letter —
 * including the ones that failed or were cancelled.
 */
export function LifecycleTimeline({ employeeId }: { employeeId: string }) {
  const { data, error, isLoading, reload } = useApiQuery<EmployeeHistory>(
    `/lifecycle/employees/${employeeId}/history`,
  );
  const show = useFieldValue();
  const events = data?.events ?? [];

  if (error?.status === 403) {
    return (
      <DataPanel title="Lifecycle history">
        <EmptyState icon={Lock} title="Not available to you" description={error.detail} />
      </DataPanel>
    );
  }

  return (
    <DataPanel
      title="Lifecycle history"
      description="Confirmations, transfers, promotions and other effective-dated changes."
      isLoading={isLoading}
      error={error?.detail}
      onRetry={reload}
      isEmpty={events.length === 0}
      empty={{
        icon: History,
        title: "No lifecycle events yet",
        description: "Events raised under People → Lifecycle events appear here.",
      }}
    >
      <ol className="grid gap-0 p-5">
        {events.map((event, index) => (
          <li key={event.event_id} className="relative grid gap-1 pb-5 pl-6 last:pb-0">
            <span className="absolute left-0 top-1.5 size-2.5 rounded-full bg-primary" />
            {index < events.length - 1 && (
              <span className="absolute bottom-0 left-[4.5px] top-4 w-px bg-border" />
            )}
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{EVENT_TYPE[event.type]}</span>
              <EventStatusBadge status={event.status} />
              <span className="text-sm text-muted-foreground">
                effective {formatDay(event.effective_from, true)}
              </span>
              {event.letter_id && (
                <Badge variant="outline">
                  <FileSignature /> Letter issued
                </Badge>
              )}
            </div>
            {event.changes.length > 0 && (
              <ul className="text-sm text-muted-foreground">
                {event.changes.map((change) => (
                  <li key={change.field}>
                    {FIELD_LABEL[change.field] ?? change.field}: {show(change.field, change.from)} →{" "}
                    <span className="text-foreground">{show(change.field, change.to)}</span>
                  </li>
                ))}
              </ul>
            )}
            {event.salary_revision && (
              <p className="text-sm text-muted-foreground">
                New annual CTC: <Money value={event.salary_revision} className="text-foreground" />
              </p>
            )}
            <p className="text-sm">{event.reason}</p>
            <p className="text-xs text-muted-foreground">
              {event.approved_by_name
                ? `Approved by ${event.approved_by_name} on ${formatDate(event.approved_at)}`
                : "Not approved"}
              {event.effected_at ? ` · applied ${formatDate(event.effected_at)}` : ""}
            </p>
            {event.failure_reason && (
              <p className="text-xs text-destructive">Failed: {event.failure_reason}</p>
            )}
            {event.cancelled_reason && (
              <p className="text-xs text-muted-foreground">Cancelled: {event.cancelled_reason}</p>
            )}
          </li>
        ))}
      </ol>
    </DataPanel>
  );
}
