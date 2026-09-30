"use client";

import { Ban, CalendarClock, EllipsisVertical, Loader2, SkipForward, UserRoundCog } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { DatePicker } from "@/components/common/DatePicker";
import { FormField } from "@/components/common/FormField";
import {
  dayOrDash,
  pluralCount,
  PlanStatusBadge,
  ProgressRing,
  ReasonDialog,
} from "@/components/onboarding/shared";
import { JoinerAssets, JoinerDocuments } from "@/components/onboarding/JoinerAssetsDocs";
import { PhasedTaskList } from "@/components/onboarding/TaskList";
import { apiErrorMessage, InlineProblem, QueryBoundary } from "@/components/payroll-ops/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiQuery } from "@/hooks/useApiQuery";
import { patch, post } from "@/lib/api";
import type {
  OnboardingOwnerCandidate,
  OnboardingPlanDetail,
  OnboardingTask,
} from "@/lib/types/onboarding";
import { formatDate, humanizeRole } from "@/lib/utils";

type TaskDialog = { kind: "reassign" | "redate" | "skip"; task: OnboardingTask } | null;

/**
 * One new joiner's plan, for HR: progress, people, every task, and the
 * reassign / re-date / skip / cancel actions. The server decides which are
 * allowed (`can_manage`, `can_complete`) and refuses the rest.
 */
export function PlanDetailSheet({
  planId,
  onClose,
  onChanged,
}: {
  planId: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const query = useApiQuery<OnboardingPlanDetail>(planId ? `/onboarding/plans/${planId}` : null);
  const plan = query.data && query.data.id === planId ? query.data : null;

  return (
    <Sheet open={planId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="border-b border-border">
          <SheetTitle>
            {plan ? `${plan.employee_name} (${plan.employee_code})` : "Onboarding plan"}
          </SheetTitle>
          <SheetDescription>
            {plan
              ? `${plan.template_name} · joining ${dayOrDash(plan.joining_date)}`
              : "Loading the plan."}
          </SheetDescription>
        </SheetHeader>
        <QueryBoundary query={{ ...query, data: plan }} skeletonRows={8}>
          {(data) => (
            <PlanDetail
              plan={data}
              onChanged={() => {
                query.reload();
                onChanged();
              }}
            />
          )}
        </QueryBoundary>
      </SheetContent>
    </Sheet>
  );
}

function PlanDetail({ plan, onChanged }: { plan: OnboardingPlanDetail; onChanged: () => void }) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const [taskDialog, setTaskDialog] = useState<TaskDialog>(null);
  const manageable = plan.tasks.some((task) => task.can_manage);
  const progress = plan.progress;

  return (
    <div className="space-y-5 p-4">
      <Card tier="tier1">
        <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <ProgressRing percent={progress.percent} size={96} />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <PlanStatusBadge status={plan.status} />
              {plan.employee_status === "pre_joining" && <Badge variant="accent">Pre-joining</Badge>}
              {progress.overdue > 0 && (
                <Badge variant="warning">{progress.overdue} overdue</Badge>
              )}
              {progress.unassigned > 0 && (
                <Badge variant="destructive">{progress.unassigned} unassigned</Badge>
              )}
            </div>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <Fact label="Progress">
                {progress.done + progress.skipped} of {progress.total} resolved
                {progress.skipped > 0 && ` (${progress.skipped} skipped)`}
              </Fact>
              <Fact label="Mandatory still open">{progress.mandatory_pending}</Fact>
              <Fact label="Manager">{plan.manager_name ?? "None on record"}</Fact>
              <Fact label="Buddy">{plan.buddy_name ?? "None chosen"}</Fact>
              <Fact label="Department">{plan.department_name ?? "—"}</Fact>
              <Fact label="Started by">
                {plan.started_by_name ?? "—"} ·{" "}
                {formatDate(plan.created_at)}
              </Fact>
              {plan.completed_at && (
                <Fact label="Completed">{formatDate(plan.completed_at)}</Fact>
              )}
              {plan.cancelled_at && (
                <Fact label="Cancelled">
                  {formatDate(plan.cancelled_at)}
                  {plan.cancel_reason && ` — ${plan.cancel_reason}`}
                </Fact>
              )}
            </dl>
          </div>
        </CardContent>
      </Card>

      {progress.unassigned > 0 && plan.status === "in_progress" && (
        <Alert variant="warning">
          <UserRoundCog />
          <AlertDescription>
            {pluralCount(progress.unassigned, "task has", "tasks have")} nobody to do{" "}
            {progress.unassigned === 1 ? "it" : "them"} — the person has no login, or no buddy
            was chosen. Reassign {progress.unassigned === 1 ? "it" : "them"} from the task menu.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="checklist">
        <TabsList>
          <TabsTrigger value="checklist">Checklist</TabsTrigger>
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>
        <TabsContent value="assets" className="mt-4">
          <JoinerAssets employeeId={plan.employee_id} employeeName={plan.employee_name} />
        </TabsContent>
        <TabsContent value="documents" className="mt-4">
          <JoinerDocuments employeeId={plan.employee_id} employeeName={plan.employee_name} />
        </TabsContent>
        <TabsContent value="checklist" className="mt-4">
      <PhasedTaskList
        tasks={plan.tasks}
        showDocument
        onChanged={() => onChanged()}
        menuFor={(task) =>
          task.can_manage && task.status === "pending" ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Manage ${task.title}`}>
                  <EllipsisVertical />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {task.owner_type !== "new_joiner" && (
                  <DropdownMenuItem onSelect={() => setTaskDialog({ kind: "reassign", task })}>
                    <UserRoundCog /> Reassign
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => setTaskDialog({ kind: "redate", task })}>
                  <CalendarClock /> Change due date
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setTaskDialog({ kind: "skip", task })}>
                  <SkipForward /> Skip
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null
        }
      />
        </TabsContent>
      </Tabs>

      {manageable && plan.status === "in_progress" && (
        <div className="flex justify-end border-t border-border pt-4">
          <Button variant="outline" onClick={() => setCancelOpen(true)}>
            <Ban /> Cancel onboarding
          </Button>
        </div>
      )}

      <ReasonDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel onboarding"
        description="The plan and its history are kept. You can start a fresh plan for this person afterwards."
        label="Reason"
        confirmLabel="Cancel onboarding"
        destructive
        onSubmit={async (reason) => {
          await post(`/onboarding/plans/${plan.id}/cancel`, { reason });
          toast.success("Onboarding cancelled");
          onChanged();
        }}
      />

      <ReasonDialog
        open={taskDialog?.kind === "skip"}
        onOpenChange={(open) => !open && setTaskDialog(null)}
        title={taskDialog ? `Skip "${taskDialog.task.title}"` : "Skip task"}
        description="A skipped task counts as resolved. Say why it does not apply to this person."
        label="Reason"
        confirmLabel="Skip task"
        onSubmit={async (reason) => {
          if (!taskDialog) return;
          await post(`/onboarding/tasks/${taskDialog.task.id}/skip`, { reason });
          toast.success("Task skipped");
          onChanged();
        }}
      />

      {taskDialog?.kind === "reassign" && (
        <ReassignDialog
          task={taskDialog.task}
          onClose={() => setTaskDialog(null)}
          onDone={() => {
            setTaskDialog(null);
            onChanged();
          }}
        />
      )}
      {taskDialog?.kind === "redate" && (
        <RedateDialog
          task={taskDialog.task}
          onClose={() => setTaskDialog(null)}
          onDone={() => {
            setTaskDialog(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-foreground">{children}</dd>
    </div>
  );
}

function ReassignDialog({
  task,
  onClose,
  onDone,
}: {
  task: OnboardingTask;
  onClose: () => void;
  onDone: () => void;
}) {
  const candidates = useApiQuery<OnboardingOwnerCandidate[]>("/onboarding/owner-candidates");
  const [userId, setUserId] = useState(task.assignee_user_id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const submit = async () => {
    if (!userId) {
      setError("Choose who takes this task.");
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      const next = await patch<OnboardingTask>(`/onboarding/tasks/${task.id}`, {
        assignee_user_id: userId,
      });
      toast.success(`Assigned to ${next.assignee_name ?? "them"}`);
      onDone();
    } catch (caught) {
      setError(apiErrorMessage(caught, "The task could not be reassigned."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !isBusy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reassign task</DialogTitle>
          <DialogDescription>
            {task.title}. The new assignee is told it is theirs.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField htmlFor="onboarding-assignee" label="Assign to">
            <Select value={userId} onValueChange={setUserId} disabled={isBusy}>
              <SelectTrigger id="onboarding-assignee" className="w-full">
                <SelectValue
                  placeholder={candidates.isLoading ? "Loading people…" : "Choose a person"}
                />
              </SelectTrigger>
              <SelectContent>
                {(candidates.data ?? []).map((person) => (
                  <SelectItem key={person.user_id} value={person.user_id}>
                    {person.full_name} · {humanizeRole(person.role)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          {candidates.error && <InlineProblem>{candidates.error.detail}</InlineProblem>}
          {error && <InlineProblem>{error}</InlineProblem>}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={isBusy} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={isBusy} onClick={() => void submit()}>
            {isBusy && <Loader2 className="animate-spin" />}
            Reassign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RedateDialog({
  task,
  onClose,
  onDone,
}: {
  task: OnboardingTask;
  onClose: () => void;
  onDone: () => void;
}) {
  const [dueDate, setDueDate] = useState(task.due_date);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const submit = async () => {
    setIsBusy(true);
    setError(null);
    try {
      await patch<OnboardingTask>(`/onboarding/tasks/${task.id}`, { due_date: dueDate });
      toast.success(`Due ${dayOrDash(dueDate)}`);
      onDone();
    } catch (caught) {
      setError(apiErrorMessage(caught, "The due date could not be changed."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !isBusy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change due date</DialogTitle>
          <DialogDescription>{task.title}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField htmlFor="onboarding-due" label="Due on">
            <DatePicker id="onboarding-due" value={dueDate} onChange={setDueDate} disabled={isBusy} />
          </FormField>
          {error && <InlineProblem>{error}</InlineProblem>}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={isBusy} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={isBusy || dueDate === task.due_date} onClick={() => void submit()}>
            {isBusy && <Loader2 className="animate-spin" />}
            Save date
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
