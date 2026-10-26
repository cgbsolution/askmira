"use client";

import React from "react";

import {
  dayOrDash,
  ownerLine,
  PHASE_LABELS,
  PHASES,
  TASK_TYPE_LABELS,
  TaskStatusBadge,
  TaskTypeIcon,
} from "@/components/onboarding/shared";
import { TaskActions, TaskDocumentButton } from "@/components/onboarding/TaskActions";
import { Badge } from "@/components/ui/badge";
import type { OnboardingPhase, OnboardingTask } from "@/lib/types/onboarding";
import { cn, formatDate } from "@/lib/utils";

/**
 * One task: what it is, who holds it, when it is due, what happened, and — if
 * the API says this caller may — the action that completes it.
 */
export function TaskRow({
  task,
  onChanged,
  showDocument = false,
  menu,
  className,
}: {
  task: OnboardingTask;
  onChanged: (task: OnboardingTask) => void;
  /** Only the joiner and HR can download what was uploaded. */
  showDocument?: boolean;
  /** HR's reassign / re-date / skip menu, where it applies. */
  menu?: React.ReactNode;
  className?: string;
}) {
  const resolved = task.status !== "pending";
  return (
    <li
      className={cn(
        "flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
            resolved
              ? "bg-success/10 text-success"
              : task.is_overdue
                ? "bg-marigold-100 text-marigold-900 dark:bg-marigold-900/30 dark:text-marigold-100"
                : "bg-muted text-muted-foreground",
          )}
        >
          <TaskTypeIcon type={task.task_type} />
        </span>
        <div className="min-w-0">
          <p
            className={cn(
              "text-sm font-medium text-foreground",
              task.status === "skipped" && "text-muted-foreground line-through",
            )}
          >
            {task.title}
            {!task.is_mandatory && (
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">(optional)</span>
            )}
          </p>
          {task.description && !resolved && (
            <p className="mt-0.5 text-xs text-muted-foreground">{task.description}</p>
          )}
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="tabular-nums">Due {dayOrDash(task.due_date)}</span>
            <span aria-hidden>·</span>
            <span>{TASK_TYPE_LABELS[task.task_type]}</span>
            <span aria-hidden>·</span>
            <span>{ownerLine(task)}</span>
          </p>
          {resolved && (
            <p className="mt-1 text-xs text-muted-foreground">
              {task.status === "done" ? "Done" : "Skipped"}
              {task.completed_by_name && ` by ${task.completed_by_name}`}
              {task.completed_at && ` on ${formatDate(task.completed_at)}`}
              {task.note && <span className="text-foreground"> — {task.note}</span>}
            </p>
          )}
          {showDocument && <TaskDocumentButton task={task} />}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 pl-11 sm:pl-0">
        <TaskStatusBadge task={task} />
        <TaskActions task={task} onChanged={onChanged} />
        {menu}
      </div>
    </li>
  );
}

/** Tasks grouped by phase — before joining, the first week, later — in date order. */
export function PhasedTaskList({
  tasks,
  onChanged,
  showDocument = false,
  menuFor,
  headingFor,
}: {
  tasks: OnboardingTask[];
  onChanged: (task: OnboardingTask) => void;
  showDocument?: boolean;
  menuFor?: (task: OnboardingTask) => React.ReactNode;
  headingFor?: (phase: OnboardingPhase) => string;
}) {
  return (
    <div className="flex flex-col gap-5">
      {PHASES.map((phase) => {
        const rows = tasks.filter((task) => task.phase === phase);
        if (rows.length === 0) return null;
        const open = rows.filter((task) => task.status === "pending").length;
        return (
          <section key={phase} aria-labelledby={`phase-${phase}`}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 id={`phase-${phase}`} className="text-sm font-semibold text-foreground">
                {headingFor ? headingFor(phase) : PHASE_LABELS[phase]}
              </h3>
              <Badge variant={open === 0 ? "success" : "muted"}>
                {open === 0 ? "All done" : `${open} open`}
              </Badge>
            </div>
            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
              {rows.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onChanged={onChanged}
                  showDocument={showDocument}
                  menu={menuFor?.(task)}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
