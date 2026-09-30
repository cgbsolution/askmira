"use client";

import { ArrowRight, ClipboardCheck, Rocket } from "lucide-react";
import Link from "next/link";
import React from "react";

import { dayOrDash, pluralCount, ProgressRing } from "@/components/onboarding/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { OnboardingSummary } from "@/lib/types/onboarding";
import { cn } from "@/lib/utils";

/**
 * The Home card: my onboarding progress while I am being onboarded, or the
 * onboarding tasks waiting on me for somebody else. Renders nothing when
 * neither applies — an empty onboarding card on everybody's Home is noise.
 */
export function OnboardingProgressCard({ className }: { className?: string }) {
  const { data } = useApiQuery<OnboardingSummary>("/onboarding/me/summary");
  if (!data) return null;

  const ownActive = data.has_plan && data.plan_status === "in_progress" && data.progress;
  if (ownActive && data.progress) {
    const progress = data.progress;
    return (
      <Card tier="tier2" className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Rocket className="size-4 text-brand-600 dark:text-brand-300" />
            Your onboarding
          </CardTitle>
          <CardDescription>
            {data.joining_date ? `Joining date ${dayOrDash(data.joining_date)}` : "In progress"}
          </CardDescription>
          <CardAction>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/onboarding">
                Open <ArrowRight />
              </Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex items-center gap-5">
          <ProgressRing percent={progress.percent} size={88} />
          <div className="min-w-0 space-y-1.5 text-sm">
            <p className="text-foreground">
              {progress.done + progress.skipped} of {pluralCount(progress.total, "task")} done
            </p>
            {data.next_task ? (
              <p className="text-muted-foreground">
                Next: <span className="text-foreground">{data.next_task.title}</span>, due{" "}
                {dayOrDash(data.next_task.due_date)}
                {data.next_task.is_overdue && (
                  <Badge variant="warning" className="ml-1.5">
                    Overdue
                  </Badge>
                )}
              </p>
            ) : (
              <p className="text-muted-foreground">
                Nothing left for you to do; the rest is being prepared for you.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.assigned_pending === 0) return null;

  return (
    <Card tier="tier2" className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardCheck className="size-4 text-brand-600 dark:text-brand-300" />
          Onboarding tasks
        </CardTitle>
        <CardDescription>
          {pluralCount(data.assigned_pending, "task")} for new joiners waiting on you
          {data.assigned_overdue > 0 && `, ${data.assigned_overdue} overdue`}.
        </CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/onboarding/tasks">
              Open <ArrowRight />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {data.assigned_next.map((task) => (
            <li
              key={task.id}
              className="flex items-center justify-between gap-3 rounded-md bg-muted/60 px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate text-foreground">{task.title}</span>
              <span
                className={cn(
                  "shrink-0 text-xs tabular-nums",
                  task.is_overdue
                    ? "font-medium text-mustard-900 dark:text-mustard-100"
                    : "text-muted-foreground",
                )}
              >
                {task.is_overdue ? "Overdue · " : ""}
                {dayOrDash(task.due_date)}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
