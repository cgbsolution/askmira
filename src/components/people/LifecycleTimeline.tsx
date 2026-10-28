"use client";

import { CalendarSearch, FileSignature, History, Lock } from "lucide-react";
import React, { useState } from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { EmptyState } from "@/components/common/EmptyState";
import { Money } from "@/components/common/Money";
import { EVENT_TYPE, FIELD_LABEL } from "@/components/people/labels";
import { EventStatusBadge } from "@/components/people/StatusBadges";
import { useOrgReference } from "@/components/people/useOrgReference";
import { FormField } from "@/components/common/FormField";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { EmployeeHistory, EmployeeStateOn } from "@/lib/types/people";
import { formatDate, formatDay } from "@/lib/utils";
import { DatePicker } from "@/components/common/DatePicker";

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
    <div className="grid gap-6">
      <RecordOnDate employeeId={employeeId} />
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
          description: "Events raised under Employees → Lifecycle events appear here.",
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
    </div>
  );
}

const STATE_FIELDS = [
  "designation",
  "grade",
  "department_id",
  "location_id",
  "manager_id",
  "employment_type",
  "notice_period_days",
  "status",
];

/**
 * The job fields as they stood on a chosen date — "what was their grade on
 * 1 April" — rebuilt from the effected events above, not from a second copy.
 */
function RecordOnDate({ employeeId }: { employeeId: string }) {
  const [on, setOn] = useState("");
  const query = useApiQuery<EmployeeStateOn>(
    on ? `/lifecycle/employees/${employeeId}/state?on=${on}` : null,
  );
  const show = useFieldValue();
  const state = query.data?.state;

  return (
    <Card tier="tier2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarSearch className="size-4 text-primary" /> The record on a date
        </CardTitle>
        <CardDescription>
          Pick a date to see their job details as they stood that day.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <FormField htmlFor={`state-on-${employeeId}`} label="Date" className="max-w-48">
          <DatePicker id={`state-on-${employeeId}`} value={on} onChange={setOn} />
        </FormField>
        {on && query.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : query.error ? (
          <p className="text-sm text-destructive">{query.error.detail}</p>
        ) : state ? (
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {STATE_FIELDS.map((field) => (
              <div key={field} className="flex justify-between gap-3 border-b border-border py-1">
                <dt className="text-muted-foreground">{FIELD_LABEL[field] ?? field}</dt>
                <dd>
                  {field === "manager_id"
                    ? (query.data?.manager_name ?? (state[field] ? "Someone no longer visible to you" : "—"))
                    : show(field, state[field])}
                </dd>
              </div>
            ))}
            <p className="text-xs text-muted-foreground sm:col-span-2">
              {query.data?.events_undone
                ? `${query.data.events_undone} later change(s) set aside to show this date.`
                : "Nothing has changed since this date."}
            </p>
          </dl>
        ) : null}
      </CardContent>
    </Card>
  );
}
