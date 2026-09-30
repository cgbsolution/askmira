"use client";

import { ClipboardCheck } from "lucide-react";
import React, { useMemo, useState } from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { PageShell } from "@/components/common/PageShell";
import { PersonCell } from "@/components/common/PersonCell";
import { ClearanceChecklist } from "@/components/exits/ClearanceChecklist";
import { dayOrDash } from "@/components/exits/common";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { ClearanceTask } from "@/lib/types/payroll-ops";

/**
 * People → Clearance tasks. What waits on you when a colleague leaves: items
 * that name you as the owner (collecting a laptop, a handover), and — for a
 * line manager — the manager items of people leaving your team. Reachable by
 * everyone, because the owner of an item is often not a manager.
 */
export function ClearanceTasksScreen() {
  const { data, error, isLoading, reload } = useApiQuery<ClearanceTask[]>("/exits/clearance/mine");
  const [version, setVersion] = useState(0);

  const exits = useMemo(() => {
    const byExit = new Map<string, ClearanceTask[]>();
    for (const task of data ?? []) {
      byExit.set(task.exit_id, [...(byExit.get(task.exit_id) ?? []), task]);
    }
    return Array.from(byExit.values());
  }, [data]);

  return (
    <PageShell
      title="Clearance tasks"
      description="Sign-offs that wait on you when a colleague leaves."
    >
      <DataPanel
        title="Waiting on you"
        description="Each leaver's full checklist is shown; you can sign off the items that are yours."
        isLoading={isLoading}
        error={error?.detail}
        onRetry={reload}
        isEmpty={exits.length === 0}
        empty={{
          icon: ClipboardCheck,
          title: "Nothing waits on you",
          description:
            "When someone leaves and a clearance item names you, or you manage them, it appears here.",
        }}
      >
        <div className="grid gap-6">
          {exits.map((tasks) => {
            const first = tasks[0];
            return (
              <section key={first.exit_id} className="grid gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <PersonCell
                    name={first.employee_name}
                    photoUrl={first.photo_url}
                    subtitle={`${first.employee_code} · last working day ${dayOrDash(first.last_working_day)}`}
                  />
                  <p className="text-sm text-muted-foreground">
                    {tasks.length} item{tasks.length === 1 ? "" : "s"} waiting on you
                  </p>
                </div>
                <ClearanceChecklist
                  exitId={first.exit_id}
                  isOwnExit={false}
                  version={version}
                  onChanged={() => {
                    reload();
                    setVersion((current) => current + 1);
                  }}
                />
              </section>
            );
          })}
        </div>
      </DataPanel>
    </PageShell>
  );
}
