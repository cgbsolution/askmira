"use client";

import {
  CalendarClock,
  CircleCheck,
  ClipboardList,
  FileUp,
  Loader2,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import { FormField } from "@/components/common/FormField";
import { apiErrorMessage, InlineProblem } from "@/components/payroll-ops/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { HR } from "@/lib/access";
import type {
  OnboardingDocumentType,
  OnboardingOwnerType,
  OnboardingPhase,
  OnboardingPlanStatus,
  OnboardingTask,
  OnboardingTaskStatus,
  OnboardingTaskType,
} from "@/lib/types/onboarding";
import { cn, formatDay, parseISODate } from "@/lib/utils";

/**
 * Shared pieces for the onboarding screens. Every label names a value the API
 * sent; progress, overdue and phase all come from the API too.
 */

// ── Roles ───────────────────────────────────────────────────────────────────

export function useOnboardingRoles() {
  const { user, hasRole } = useAuth();
  return {
    isHr: hasRole(...HR),
    ownEmployeeId: user?.employee_id ?? null,
    firstName: user?.full_name?.split(" ")[0] ?? null,
  };
}

/** Reload a query when a parent's change counter moves, without a second request on mount. */
export function useReloadOn(version: number, reload: () => void) {
  const isFirst = useRef(true);
  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    reload();
  }, [version, reload]);
}

// ── Labels ──────────────────────────────────────────────────────────────────

export const OWNER_LABELS: Record<OnboardingOwnerType, string> = {
  new_joiner: "New joiner",
  manager: "Manager",
  hr: "HR",
  it: "IT",
  buddy: "Buddy",
  finance: "Finance",
};

export const TASK_TYPE_LABELS: Record<OnboardingTaskType, string> = {
  general: "Task",
  document_upload: "Document upload",
  form: "Form",
  acknowledge_policy: "Acknowledgement",
  meeting: "Meeting",
};

export const PLAN_STATUS_LABELS: Record<OnboardingPlanStatus, string> = {
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const TASK_STATUS_LABELS: Record<OnboardingTaskStatus, string> = {
  pending: "Pending",
  done: "Done",
  skipped: "Skipped",
};

export const PHASE_LABELS: Record<OnboardingPhase, string> = {
  pre_joining: "Before joining",
  week_1: "First week",
  later: "After the first week",
};

export const PHASES: OnboardingPhase[] = ["pre_joining", "week_1", "later"];

/** The document vault's categories, as the vault names them. */
export const DOCUMENT_TYPE_LABELS: Record<OnboardingDocumentType, string> = {
  id_proof: "Identity proof",
  address_proof: "Address proof",
  education: "Education",
  experience: "Previous employment",
  contract: "Contract",
  offer_letter: "Offer letter",
  policy_ack: "Policy acknowledgement",
  payslip: "Payslip",
  tax: "Tax",
  medical: "Medical",
  other: "Other",
};

export function documentTypeLabel(value: string | null): string {
  if (!value) return "Document";
  return DOCUMENT_TYPE_LABELS[value as OnboardingDocumentType] ?? value;
}

const TASK_ICONS: Record<OnboardingTaskType, LucideIcon> = {
  general: CircleCheck,
  document_upload: FileUp,
  form: ClipboardList,
  acknowledge_policy: ShieldCheck,
  meeting: Users,
};

export function TaskTypeIcon({ type, className }: { type: OnboardingTaskType; className?: string }) {
  const Icon = TASK_ICONS[type] ?? CalendarClock;
  return <Icon className={cn("size-4", className)} aria-hidden />;
}

/** "7 days before joining", "On the joining day", "30 days after joining". */
export function offsetLabel(days: number): string {
  if (days === 0) return "On the joining day";
  const n = Math.abs(days);
  return `${n} day${n === 1 ? "" : "s"} ${days < 0 ? "before" : "after"} joining`;
}

export function pluralCount(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function dayOrDash(value: string | null | undefined): string {
  return value ? formatDay(value, true) : "—";
}

/** Whole days from today (the viewer's) to an ISO date; negative when past. */
export function daysUntil(value: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((parseISODate(value).getTime() - today.getTime()) / 86_400_000);
}

// ── Badges ──────────────────────────────────────────────────────────────────

type BadgeVariant = React.ComponentProps<typeof Badge>["variant"];

const PLAN_VARIANT: Record<OnboardingPlanStatus, BadgeVariant> = {
  in_progress: "secondary",
  completed: "success",
  cancelled: "muted",
};

export function PlanStatusBadge({ status }: { status: OnboardingPlanStatus }) {
  return <Badge variant={PLAN_VARIANT[status]}>{PLAN_STATUS_LABELS[status] ?? status}</Badge>;
}

export function TaskStatusBadge({
  task,
}: {
  task: Pick<OnboardingTask, "status" | "is_overdue">;
}) {
  if (task.status === "pending") {
    return task.is_overdue ? (
      <Badge variant="warning">Overdue</Badge>
    ) : (
      <Badge variant="outline">Pending</Badge>
    );
  }
  return (
    <Badge variant={task.status === "done" ? "success" : "muted"}>
      {TASK_STATUS_LABELS[task.status]}
    </Badge>
  );
}

/** Who holds a task: "IT · Priya Ramesh", or who it is waiting for. */
export function ownerLine(task: Pick<OnboardingTask, "owner_type" | "assignee_name">): string {
  const role = OWNER_LABELS[task.owner_type] ?? task.owner_type;
  if (task.assignee_name) return `${role} · ${task.assignee_name}`;
  if (task.owner_type === "new_joiner") return role;
  return `${role} · not assigned yet`;
}

// ── Progress ring ───────────────────────────────────────────────────────────

/**
 * A ring for a whole-number percentage the API computed. Drawn with SVG
 * attributes and token classes; the figure in the middle is the same number.
 */
export function ProgressRing({
  percent,
  size = 112,
  caption,
  className,
}: {
  percent: number;
  size?: number;
  caption?: string;
  className?: string;
}) {
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      role="img"
      aria-label={`${clamped}% complete`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-mint-100 dark:stroke-mint-900/50"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          className="stroke-primary transition-all duration-500 dark:stroke-mint-300"
        />
      </svg>
      <span className="absolute flex flex-col items-center">
        <span className="font-display text-2xl font-semibold tabular-nums text-foreground">
          {clamped}%
        </span>
        {caption && <span className="text-[11px] text-muted-foreground">{caption}</span>}
      </span>
    </div>
  );
}

// ── Reason dialog ───────────────────────────────────────────────────────────

/** An action that needs a written reason (skip a task, cancel a plan). */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  confirmLabel,
  destructive = false,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  label: string;
  confirmLabel: string;
  destructive?: boolean;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const missing = text.trim() === "";

  const close = (next: boolean) => {
    if (isBusy) return;
    onOpenChange(next);
    if (!next) {
      setText("");
      setTouched(false);
      setError(null);
    }
  };

  const submit = async () => {
    setTouched(true);
    if (missing) return;
    setIsBusy(true);
    setError(null);
    try {
      await onSubmit(text.trim());
      setText("");
      setTouched(false);
      onOpenChange(false);
    } catch (caught) {
      setError(apiErrorMessage(caught, "This could not be saved."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="grid gap-4">
          <FormField
            htmlFor="onboarding-reason"
            label={label}
            error={touched && missing ? `${label} is required.` : null}
          >
            <Textarea
              id="onboarding-reason"
              rows={3}
              maxLength={2000}
              value={text}
              disabled={isBusy}
              aria-invalid={touched && missing}
              onChange={(event) => setText(event.target.value)}
            />
          </FormField>
          {error && <InlineProblem>{error}</InlineProblem>}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={isBusy} onClick={() => close(false)}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={isBusy}
            onClick={() => void submit()}
          >
            {isBusy && <Loader2 className="animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
