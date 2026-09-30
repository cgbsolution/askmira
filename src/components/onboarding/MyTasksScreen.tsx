"use client";

import { ClipboardCheck } from "lucide-react";
import React, { useState } from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { PersonCell } from "@/components/common/PersonCell";
import {
  dayOrDash,
  OWNER_LABELS,
  pluralCount,
  TASK_TYPE_LABELS,
  TaskStatusBadge,
  TaskTypeIcon,
} from "@/components/onboarding/shared";
import { TaskActions } from "@/components/onboarding/TaskActions";
import { ForbiddenState } from "@/components/payroll-ops/shared";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { MyOnboardingTask } from "@/lib/types/onboarding";
import { cn } from "@/lib/utils";

/**
 * /onboarding/tasks — onboarding work assigned to me on other people's plans:
 * the welcome meeting as their manager, the laptop as IT, the lunch as buddy.
 */
export function MyTasksScreen() {
  const [includeDone, setIncludeDone] = useState(false);
  const query = useApiQuery<MyOnboardingTask[]>(
    `/onboarding/my-tasks${includeDone ? "?include_done=true" : ""}`,
  );
  const rows = query.data ?? [];
  const forbidden = query.error?.status === 403;
  const open = rows.filter((row) => row.status === "pending");
  const overdue = open.filter((row) => row.is_overdue).length;

  return (
    <DataPanel
      tier="tier2"
      title="Tasks assigned to you"
      description={
        query.data
          ? open.length === 0
            ? "Nothing waiting on you."
            : `${pluralCount(open.length, "task")} open${overdue ? `, ${overdue} overdue` : ""}.`
          : undefined
      }
      isLoading={query.isLoading && query.data === null}
      error={forbidden ? null : (query.error?.detail ?? null)}
      onRetry={query.reload}
      isEmpty={!forbidden && query.data !== null && rows.length === 0}
      empty={{
        icon: ClipboardCheck,
        title: includeDone ? "No onboarding tasks yet" : "Nothing waiting on you",
        description:
          "When HR starts onboarding for a new joiner and a task on their checklist is yours — as their manager, buddy, or the IT, HR or finance owner — it appears here.",
      }}
      toolbar={
        <div className="flex items-center gap-2">
          <Switch id="onboarding-show-done" checked={includeDone} onCheckedChange={setIncludeDone} />
          <Label htmlFor="onboarding-show-done" className="text-sm font-normal">
            Show completed
          </Label>
        </div>
      }
    >
      {forbidden ? (
        <ForbiddenState message={query.error?.detail} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Task</TableHead>
              <TableHead>New joiner</TableHead>
              <TableHead>As</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-32" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="max-w-sm">
                  <div className="flex items-start gap-2.5">
                    <TaskTypeIcon type={row.task_type} className="mt-0.5 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium whitespace-normal text-foreground">
                        {row.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {TASK_TYPE_LABELS[row.task_type]}
                        {!row.is_mandatory && " · optional"}
                      </p>
                      {row.status !== "pending" && row.note && (
                        <p className="mt-0.5 text-xs whitespace-normal text-muted-foreground">
                          {row.note}
                        </p>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <PersonCell
                    size="sm"
                    name={row.employee_name}
                    subtitle={`${row.designation ?? row.employee_code} · joins ${dayOrDash(row.joining_date)}`}
                  />
                </TableCell>
                <TableCell>{OWNER_LABELS[row.owner_type]}</TableCell>
                <TableCell
                  className={cn(
                    "whitespace-nowrap tabular-nums",
                    row.is_overdue && "font-medium text-mustard-900 dark:text-mustard-100",
                  )}
                >
                  {dayOrDash(row.due_date)}
                </TableCell>
                <TableCell>
                  <TaskStatusBadge task={row} />
                </TableCell>
                <TableCell className="text-right">
                  <TaskActions
                    task={row}
                    onChanged={(next) =>
                      query.setData((current) =>
                        current
                          ? current.map((item) =>
                              item.id === next.id ? { ...item, ...next } : item,
                            )
                          : current,
                      )
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </DataPanel>
  );
}
