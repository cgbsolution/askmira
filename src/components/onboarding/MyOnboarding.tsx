"use client";

import { CalendarHeart, ClipboardCheck, PartyPopper, Rocket, UserRound, Users } from "lucide-react";
import Link from "next/link";
import React from "react";

import { EmptyState } from "@/components/common/EmptyState";
import {
  dayOrDash,
  daysUntil,
  PHASE_LABELS,
  pluralCount,
  ProgressRing,
  useOnboardingRoles,
} from "@/components/onboarding/shared";
import { PhasedTaskList } from "@/components/onboarding/TaskList";
import { QueryBoundary } from "@/components/payroll-ops/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useApiQuery } from "@/hooks/useApiQuery";
import type {
  OnboardingMe,
  OnboardingPhase,
  OnboardingPlanDetail,
  OnboardingSummary,
  OnboardingTask,
} from "@/lib/types/onboarding";

/**
 * /onboarding — the new joiner's own checklist (a pre-joiner signs in to this
 * before day one). Everyone else sees an honest "nothing here" with where their
 * own onboarding work is, if any.
 */
export function MyOnboarding() {
  const query = useApiQuery<OnboardingMe>("/onboarding/me");

  return (
    <QueryBoundary query={query} skeletonRows={6}>
      {(data) =>
        data.plan ? (
          <PlanView
            plan={data.plan}
            onTaskChanged={(task) =>
              query.setData((current) =>
                current?.plan
                  ? {
                      plan: {
                        ...current.plan,
                        tasks: current.plan.tasks.map((row) => (row.id === task.id ? task : row)),
                      },
                    }
                  : current,
              )
            }
            reload={query.reload}
          />
        ) : (
          <NoPlan />
        )
      }
    </QueryBoundary>
  );
}

function NoPlan() {
  const { isHr } = useOnboardingRoles();
  const summary = useApiQuery<OnboardingSummary>("/onboarding/me/summary");
  const assigned = summary.data?.assigned_pending ?? 0;
  return (
    <Card tier="tier2" className="py-0">
      <EmptyState
        tier="tier2"
        icon={Rocket}
        title="You have no onboarding checklist"
        description={
          assigned > 0
            ? `You are not being onboarded yourself, but ${pluralCount(assigned, "onboarding task")} for new joiners ${assigned === 1 ? "is" : "are"} waiting on you.`
            : "A checklist appears here when HR starts onboarding for you as a new joiner. If you have just joined and expected one, ask your HR team."
        }
        action={
          <div className="flex flex-wrap justify-center gap-2">
            {assigned > 0 && (
              <Button asChild>
                <Link href="/onboarding/tasks">
                  <ClipboardCheck /> Open my tasks
                </Link>
              </Button>
            )}
            {isHr && (
              <Button variant="outline" asChild>
                <Link href="/onboarding/plans">New joiners</Link>
              </Button>
            )}
          </div>
        }
      />
    </Card>
  );
}

function PlanView({
  plan,
  onTaskChanged,
  reload,
}: {
  plan: OnboardingPlanDetail;
  onTaskChanged: (task: OnboardingTask) => void;
  reload: () => void;
}) {
  const { firstName } = useOnboardingRoles();
  const mine = plan.tasks.filter((task) => task.owner_type === "new_joiner");
  const myOpen = mine.filter((task) => task.status === "pending");
  const myOverdue = myOpen.filter((task) => task.is_overdue);
  const next = [...myOpen].sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
  const until = daysUntil(plan.joining_date);

  const headline =
    plan.status === "completed"
      ? "Your onboarding is complete"
      : until > 0
        ? `Welcome aboard, ${firstName ?? "and welcome"}!`
        : `Welcome to the team, ${firstName ?? "and welcome"}!`;
  const subline =
    plan.status === "completed"
      ? `Every required step is done. You joined on ${dayOrDash(plan.joining_date)}.`
      : until > 1
        ? `You join on ${dayOrDash(plan.joining_date)} — ${until} days to go. Here is what to get ready.`
        : until === 1
          ? `You join tomorrow, ${dayOrDash(plan.joining_date)}.`
          : until === 0
            ? "Today is your first day. Here is what is left on your checklist."
            : `You joined on ${dayOrDash(plan.joining_date)}. Here is what is left on your checklist.`;

  const headingFor = (phase: OnboardingPhase) =>
    phase === "pre_joining"
      ? "Before you join"
      : phase === "week_1"
        ? "Your first week"
        : PHASE_LABELS[phase];

  return (
    <div className="flex flex-col gap-6">
      <Card tier="tier2">
        <CardContent className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <ProgressRing percent={plan.progress.percent} caption="complete" />
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-foreground sm:text-2xl">
              {plan.status === "completed" && <PartyPopper className="size-5 text-accent" />}
              {headline}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{subline}</p>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">Your tasks left</dt>
                <dd className="mt-0.5 font-medium tabular-nums text-foreground">
                  {myOpen.length} of {mine.length}
                  {myOverdue.length > 0 && (
                    <span className="ml-1.5 text-xs font-normal text-marigold-900 dark:text-marigold-100">
                      ({myOverdue.length} overdue)
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                  <UserRound className="size-3" /> Your manager
                </dt>
                <dd className="mt-0.5 font-medium text-foreground">
                  {plan.manager_name ?? "Not set yet"}
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="size-3" /> Your buddy
                </dt>
                <dd className="mt-0.5 font-medium text-foreground">
                  {plan.buddy_name ?? "Not assigned"}
                </dd>
              </div>
            </dl>
          </div>
        </CardContent>
      </Card>

      {plan.status === "in_progress" && next && (
        <Alert variant={next.is_overdue ? "warning" : "success"}>
          <CalendarHeart />
          <AlertDescription>
            Next up: <span className="font-medium">{next.title}</span>, due{" "}
            {dayOrDash(next.due_date)}
            {next.is_overdue ? " — this is overdue." : "."}
          </AlertDescription>
        </Alert>
      )}

      <PhasedTaskList
        tasks={plan.tasks}
        showDocument
        headingFor={headingFor}
        onChanged={(task) => {
          onTaskChanged(task);
          // The plan's own status and progress move with the last task.
          reload();
        }}
      />

      <p className="text-xs text-muted-foreground">
        Tasks marked for IT, HR, your manager or your buddy are done for you; they appear here
        so you can see what is being prepared.
      </p>
    </div>
  );
}
