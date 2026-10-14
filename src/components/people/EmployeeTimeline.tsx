"use client";

import { Activity, Lock } from "lucide-react";
import Link from "next/link";
import React, { useMemo, useState } from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { EmptyState } from "@/components/common/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApiQuery } from "@/hooks/useApiQuery";

interface TimelineEvent {
  at: string;
  module: string;
  title: string;
  detail: string | null;
  status: string | null;
  link: string | null;
}

interface Timeline {
  employee_id: string;
  modules: string[];
  events: TimelineEvent[];
  truncated: boolean;
}

const MODULE_LABEL: Record<string, string> = {
  leave: "Leave",
  attendance: "Attendance",
  lifecycle: "Job changes",
  pay: "Pay",
  performance: "Reviews",
  goals: "Goals",
  recognition: "Recognition",
  assets: "Assets",
  documents: "Documents",
  letters: "Letters",
  expenses: "Expenses",
  loans: "Loans",
  helpdesk: "Helpdesk",
  onboarding: "Onboarding",
  exit: "Exit",
};

const ALL = "__all";
const month = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" });
const day = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });

function when(value: string): Date {
  return new Date(value.length === 10 ? `${value}T00:00:00` : value);
}

/**
 * Everything that has happened to this person, across modules, newest first.
 * Read from each module as it is recorded there; a manager sees the working
 * record without pay, documents or tickets.
 */
export function EmployeeTimeline({ employeeId }: { employeeId: string }) {
  const [module, setModule] = useState(ALL);
  const { data, error, isLoading, reload } = useApiQuery<Timeline>(
    `/employees/${employeeId}/timeline${module === ALL ? "" : `?module=${module}`}`,
  );

  const groups = useMemo(() => {
    const out: { label: string; events: TimelineEvent[] }[] = [];
    for (const event of data?.events ?? []) {
      const label = month.format(when(event.at));
      const last = out.at(-1);
      if (last && last.label === label) last.events.push(event);
      else out.push({ label, events: [event] });
    }
    return out;
  }, [data]);

  if (error?.status === 403) {
    return (
      <DataPanel title="Timeline">
        <EmptyState icon={Lock} title="Not available to you" description={error.detail} />
      </DataPanel>
    );
  }

  return (
    <DataPanel
      tier="tier2"
      title="Timeline"
      description="Everything on record for this person, newest first."
      toolbar={
        <Select value={module} onValueChange={setModule}>
          <SelectTrigger aria-label="Module" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Every module</SelectItem>
            {(data?.modules ?? []).map((key) => (
              <SelectItem key={key} value={key}>
                {MODULE_LABEL[key] ?? key}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
      isLoading={isLoading && !data}
      error={error?.detail ?? null}
      onRetry={reload}
      isEmpty={(data?.events.length ?? 0) === 0}
      empty={{ icon: Activity, title: "Nothing recorded yet" }}
    >
      <div className="grid gap-6 p-5">
        {groups.map((group) => (
          <section key={group.label} className="grid gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</h3>
            <ol className="grid gap-2">
              {group.events.map((event, index) => (
                <li key={`${event.at}-${index}`} className="flex gap-3 rounded-md border border-border p-3">
                  <span className="w-14 shrink-0 text-sm tabular-nums text-muted-foreground">{day.format(when(event.at))}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{MODULE_LABEL[event.module] ?? event.module}</Badge>
                      {event.link ? (
                        <Link href={event.link} className="text-sm font-medium hover:underline">
                          {event.title}
                        </Link>
                      ) : (
                        <span className="text-sm font-medium">{event.title}</span>
                      )}
                      {event.status && <Badge variant="muted">{event.status}</Badge>}
                    </div>
                    {event.detail && <p className="mt-1 truncate text-sm text-muted-foreground">{event.detail}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ))}
        {data?.truncated && (
          <p className="text-xs text-muted-foreground">Showing the latest 300 entries. Filter by module to see older ones.</p>
        )}
      </div>
    </DataPanel>
  );
}
