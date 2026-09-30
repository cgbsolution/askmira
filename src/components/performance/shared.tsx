"use client";

import { Award, Target } from "lucide-react";
import React, { useCallback, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError } from "@/lib/api";
import type { Evidence, GoalScoreBreakdown, Person } from "@/lib/types/performance";
import { cn, formatDay } from "@/lib/utils";

/** The API's own words for a failure, or a plain fallback. */
export function errorText(error: unknown, fallback = "Something went wrong."): string {
  return error instanceof ApiError ? error.detail : fallback;
}

/**
 * Run one mutation with a busy flag and the server's error as a toast.
 * Resolves to the result, or `undefined` when it failed.
 */
export function useAction() {
  const [busy, setBusy] = useState<string | null>(null);
  const run = useCallback(
    async <T,>(key: string, action: () => Promise<T>, success?: string): Promise<T | undefined> => {
      setBusy(key);
      try {
        const result = await action();
        if (success) toast.success(success);
        return result;
      } catch (error) {
        toast.error(errorText(error, "The change was not saved."));
        return undefined;
      } finally {
        setBusy(null);
      }
    },
    [],
  );
  return { busy, run };
}

type Tone = "default" | "accent" | "secondary" | "outline" | "success" | "warning" | "destructive" | "muted";

const TONES: Record<string, Tone> = {
  not_started: "muted",
  in_progress: "secondary",
  submitted: "secondary",
  returned: "warning",
  completed: "success",
  released: "accent",
  acknowledged: "success",
  draft: "muted",
  active: "secondary",
  in_calibration: "accent",
  closed: "muted",
  scheduled: "muted",
  cancelled: "muted",
  extended: "warning",
  successful: "success",
  unsuccessful: "destructive",
  abandoned: "muted",
  escalated: "warning",
  approved: "success",
  rejected: "destructive",
  open: "secondary",
  approvals: "warning",
  pending: "muted",
  met: "success",
  not_met: "destructive",
  waived: "muted",
  on_track: "success",
  at_risk: "warning",
  off_track: "destructive",
  done: "success",
  declined: "muted",
  lenient: "warning",
  severe: "warning",
  typical: "muted",
  not_assessed: "outline",
};

export function humanize(value: string): string {
  return value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/** Any status the performance API returns, as a badge. */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant={TONES[status] ?? "outline"} className={className}>
      {humanize(status)}
    </Badge>
  );
}

/** A decimal percentage string as a bar plus its figure. Never parsed beyond the bar width. */
export function PercentBar({ value, label }: { value: string | null; label?: string }) {
  const width = value === null ? 0 : Math.max(0, Math.min(100, Number(value)));
  return (
    <div className="flex min-w-32 items-center gap-2">
      <Progress value={width} className="h-1.5" aria-label={label ?? "Progress"} />
      <span className="w-14 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        {value === null ? "—" : `${value}%`}
      </span>
    </div>
  );
}

/** The people the caller may act for: their reporting line, or everybody for HR. */
export function usePeople() {
  return useApiQuery<Person[]>("/performance/people");
}

export function PersonSelect({
  id,
  people,
  value,
  onChange,
  placeholder = "Choose a person",
  excludeSelf = true,
  withLoginOnly = false,
  valueKey = "employee_id",
}: {
  id: string;
  people: Person[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  excludeSelf?: boolean;
  withLoginOnly?: boolean;
  valueKey?: "employee_id" | "user_id";
}) {
  const options = people.filter(
    (p) => (!excludeSelf || !p.is_self) && (!withLoginOnly || p.user_id) && p[valueKey],
  );
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={options.length ? placeholder : "Nobody to choose"} />
      </SelectTrigger>
      <SelectContent>
        {options.map((person) => (
          <SelectItem key={person.employee_id} value={person[valueKey] as string}>
            {person.name}
            <span className="text-muted-foreground">
              {" "}
              · {person.employee_code}
              {person.department ? ` · ${person.department}` : ""}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Recognition shown beside a competency or value — evidence to read, never a score. */
export function EvidenceList({ evidence, compact = false }: { evidence: Evidence | null; compact?: boolean }) {
  if (!evidence) return null;
  return (
    <div className="rounded-md bg-muted/60 px-3 py-2 text-xs">
      <p className="flex items-center gap-1.5 font-medium text-foreground">
        <Award className="size-3.5 text-brand-600" />
        {evidence.recognition_count > 0
          ? `${evidence.recognition_count} recognition(s) from ${evidence.distinct_recognisers} colleague(s)`
          : "No recognition in the review period"}
      </p>
      <p className="mt-0.5 text-muted-foreground">{evidence.note}</p>
      {!compact && evidence.items.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {evidence.items.slice(0, 5).map((item) => (
            <li key={item.recognition_id} className="text-foreground">
              <span className="text-muted-foreground">
                {item.from_name}, {formatDay(item.given_on, true)}:
              </span>{" "}
              “{item.message}”
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The goal component of a review, with every goal and key result behind it. */
export function GoalScorePanel({ goals, className }: { goals: GoalScoreBreakdown; className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <Target className="size-4 text-brand-600" /> Goal score
        </p>
        <p className="text-sm tabular-nums">
          <span className="text-lg font-semibold text-foreground">{goals.score ?? "—"}</span>
          <span className="text-muted-foreground"> / 100 · measured on {goals.measured_weight_percent}% of goal weight</span>
        </p>
      </div>
      {goals.contributing.length === 0 ? (
        <p className="text-sm text-muted-foreground">No goal with measured progress counts towards this review yet.</p>
      ) : (
        <ul className="space-y-2">
          {goals.contributing.map((goal) => (
            <li key={goal.goal_id} className="rounded-md border border-border px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{goal.title}</p>
                <span className="text-xs tabular-nums text-muted-foreground">
                  weight {goal.weight}
                  {goal.share_of_score ? ` · ${goal.share_of_score}% of the score` : ""}
                </span>
              </div>
              <PercentBar value={goal.progress} label={`${goal.title} progress`} />
              <ul className="mt-1 space-y-0.5">
                {goal.key_results.map((kr) => (
                  <li key={kr.key_result_id} className="flex justify-between text-xs text-muted-foreground">
                    <span>{kr.title}</span>
                    <span className="tabular-nums">{kr.progress}%</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      {goals.excluded.length > 0 && (
        <ul className="space-y-0.5 text-xs text-muted-foreground">
          {goals.excluded.map((goal) => (
            <li key={goal.goal_id}>
              Not counted — {goal.title}: {goal.reason}
            </li>
          ))}
        </ul>
      )}
      {goals.notes.map((note) => (
        <p key={note} className="text-xs text-muted-foreground">
          {note}
        </p>
      ))}
    </div>
  );
}
