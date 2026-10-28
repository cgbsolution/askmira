"use client";

import { FileText, Loader2, MessageSquarePlus, ShieldAlert, ShieldCheck } from "lucide-react";
import React, { useState } from "react";

import { FormField } from "@/components/common/FormField";
import { ErrorState } from "@/components/common/ErrorState";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { EmployeeInputState, MilestoneStatus, PipCloseResult, PipDetail } from "@/lib/types/performance";
import { formatDate, formatDateRange, formatDay, toISODate } from "@/lib/utils";

import { StatusBadge, humanize, useAction } from "./shared";
import { DatePicker } from "@/components/common/DatePicker";

/**
 * One improvement plan. The trail — milestones, check-ins with both sides of
 * the conversation, and the employee's own statements — is the point, so it is
 * shown in full to everyone who may see the plan.
 */
export function PipPanel({ pipId, onChanged }: { pipId: string; onChanged?: () => void }) {
  const { data, error, isLoading, reload } = useApiQuery<PipDetail>(`/performance/pips/${pipId}`);
  const [dialog, setDialog] = useState<"checkin" | "statement" | "close" | "evidence" | null>(null);
  const [assessing, setAssessing] = useState<string | null>(null);
  const changed = () => {
    reload();
    onChanged?.();
  };

  if (isLoading && !data) return <Skeleton className="h-64 w-full" />;
  if (error) return <ErrorState message={error.detail} onRetry={reload} />;
  if (!data) return null;
  const { pip, viewer, trail } = data;

  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {viewer.is_subject ? "Your improvement plan" : `Improvement plan · ${pip.employee_name}`}
          <StatusBadge status={pip.status} />
        </CardTitle>
        <CardDescription>
          {formatDateRange(pip.start_date, pip.end_date)}
          {pip.initiated_by_name && ` · opened by ${pip.initiated_by_name}`}
        </CardDescription>
        <CardAction className="flex flex-wrap gap-2">
          {viewer.can_add_statement && (
            <Button size="sm" variant="accent" onClick={() => setDialog("statement")}>
              <MessageSquarePlus /> Add my account
            </Button>
          )}
          {viewer.can_record_check_in && (
            <Button size="sm" onClick={() => setDialog("checkin")}>
              Record check-in
            </Button>
          )}
          {viewer.can_close && (
            <Button size="sm" variant="outline" onClick={() => setDialog("close")}>
              Record outcome
            </Button>
          )}
          {viewer.can_see_evidence_pack && (
            <Button size="sm" variant="ghost" onClick={() => setDialog("evidence")}>
              <FileText /> Evidence pack
            </Button>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
          <Block title="Why">{pip.reason}</Block>
          <Block title="What is expected">{pip.expectations}</Block>
          <Block title="Support provided">{pip.support_provided}</Block>
        </div>

        {!viewer.is_subject && (
          <Alert variant={trail.is_defensible ? "default" : "destructive"}>
            {trail.is_defensible ? <ShieldCheck /> : <ShieldAlert />}
            <AlertTitle>{trail.summary}</AlertTitle>
            {trail.gaps.length > 0 && (
              <AlertDescription>
                <ul className="list-disc space-y-0.5 pl-4">
                  {trail.gaps.map((gap) => (
                    <li key={gap}>{gap}</li>
                  ))}
                </ul>
              </AlertDescription>
            )}
          </Alert>
        )}

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Milestones</h3>
          {data.milestones.map((m) => (
            <div key={m.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-3">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{m.description}</p>
                <p className="text-xs text-muted-foreground">
                  By {formatDay(m.target_date, true)} · Measured by: {m.measurable_criteria}
                </p>
                {m.assessment_note && (
                  <p className="mt-1 text-sm text-foreground">
                    Assessed {m.assessed_on ? formatDay(m.assessed_on, true) : ""}: {m.assessment_note}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={m.status} />
                {viewer.can_assess_milestones && m.status === "pending" && (
                  <Button size="sm" variant="outline" onClick={() => setAssessing(m.id)}>
                    Assess
                  </Button>
                )}
              </div>
            </div>
          ))}
        </section>

        <Separator />
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Check-ins</h3>
          {data.check_ins.length === 0 ? (
            <p className="text-sm text-muted-foreground">No check-in has been recorded yet.</p>
          ) : (
            data.check_ins.map((c) => (
              <div key={c.id} className="space-y-1 rounded-lg border border-border p-3 text-sm">
                <p className="text-xs text-muted-foreground">
                  Held {c.held_on ? formatDay(c.held_on, true) : "—"} · recorded by {c.recorded_by_name ?? "—"}
                </p>
                <p className="text-foreground">
                  <span className="font-medium">Manager: </span>
                  {c.manager_comments}
                </p>
                <p className="text-foreground">
                  <span className="font-medium">Employee ({humanize(c.employee_input_state)}): </span>
                  {c.employee_input_state === "declined" ? c.decline_reason : c.employee_comments}
                </p>
                {data.statements
                  .filter((s) => s.check_in_id === c.id)
                  .map((s) => (
                    <p key={s.id} className="rounded-md bg-blush-50 px-2 py-1 text-foreground dark:bg-blush-900/30">
                      In their own words ({formatDate(s.recorded_at)}): {s.statement}
                    </p>
                  ))}
              </div>
            ))
          )}
        </section>

        {data.statements.some((s) => !s.check_in_id) && (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">The employee&apos;s own statements</h3>
            {data.statements
              .filter((s) => !s.check_in_id)
              .map((s) => (
                <p key={s.id} className="rounded-md bg-blush-50 px-3 py-2 text-sm text-foreground dark:bg-blush-900/30">
                  {formatDate(s.recorded_at)}: {s.statement}
                </p>
              ))}
          </section>
        )}
      </CardContent>

      {dialog === "checkin" && <CheckInDialog detail={data} onClose={() => setDialog(null)} onDone={changed} />}
      {dialog === "statement" && <StatementDialog detail={data} onClose={() => setDialog(null)} onDone={changed} />}
      {dialog === "close" && <CloseDialog detail={data} onClose={() => setDialog(null)} onDone={changed} />}
      {dialog === "evidence" && <EvidenceDialog pipId={pip.id} onClose={() => setDialog(null)} />}
      {assessing && (
        <AssessDialog pipId={pip.id} milestoneId={assessing} onClose={() => setAssessing(null)} onDone={changed} />
      )}
    </Card>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-1 whitespace-pre-line text-sm text-foreground">{children}</p>
    </div>
  );
}

function CheckInDialog({ detail, onClose, onDone }: { detail: PipDetail; onClose: () => void; onDone: () => void }) {
  const today = toISODate(new Date());
  const [heldOn, setHeldOn] = useState(today);
  const [manager, setManager] = useState("");
  const [state, setState] = useState<EmployeeInputState>("given");
  const [employee, setEmployee] = useState("");
  const [decline, setDecline] = useState("");
  const [milestone, setMilestone] = useState("none");
  const { busy, run } = useAction();

  const valid =
    manager.trim() && heldOn && ((state === "given" && employee.trim()) || (state === "declined" && decline.trim()));

  const submit = async () => {
    const done = await run(
      "save",
      () =>
        post(`/performance/pips/${detail.pip.id}/check-ins`, {
          scheduled_for: heldOn,
          held_on: heldOn,
          manager_comments: manager.trim(),
          employee_input_state: state,
          employee_comments: state === "given" ? employee.trim() : "",
          decline_reason: state === "declined" ? decline.trim() : "",
          milestone_id: milestone === "none" ? null : milestone,
        }),
      "Check-in recorded.",
    );
    if (done !== undefined) {
      onClose();
      onDone();
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record a check-in</DialogTitle>
          <DialogDescription>
            Both sides of the conversation. If the employee chose not to comment, say so and why — a blank is
            refused.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField htmlFor="ci-held" label="Held on">
              <DatePicker id="ci-held" max={today} value={heldOn} onChange={setHeldOn} />
            </FormField>
            <FormField htmlFor="ci-milestone" label="About milestone" optional>
              <Select value={milestone} onValueChange={setMilestone}>
                <SelectTrigger id="ci-milestone" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">General</SelectItem>
                  {detail.milestones.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <FormField htmlFor="ci-manager" label="What you discussed and observed">
            <Textarea id="ci-manager" rows={3} maxLength={8000} value={manager} onChange={(e) => setManager(e.target.value)} />
          </FormField>
          <FormField htmlFor="ci-state" label="The employee's input">
            <Select value={state} onValueChange={(v) => setState(v as EmployeeInputState)}>
              <SelectTrigger id="ci-state" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="given">They gave their account</SelectItem>
                <SelectItem value="declined">They declined to comment</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          {state === "given" ? (
            <FormField htmlFor="ci-employee" label="What they said">
              <Textarea id="ci-employee" rows={3} maxLength={8000} value={employee} onChange={(e) => setEmployee(e.target.value)} />
            </FormField>
          ) : (
            <FormField htmlFor="ci-decline" label="What they said when declining">
              <Input id="ci-decline" maxLength={2000} value={decline} onChange={(e) => setDecline(e.target.value)} />
            </FormField>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!valid || busy !== null} onClick={() => void submit()}>
            {busy && <Loader2 className="animate-spin" />} Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatementDialog({ detail, onClose, onDone }: { detail: PipDetail; onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState("");
  const [checkIn, setCheckIn] = useState("none");
  const { busy, run } = useAction();
  const submit = async () => {
    const done = await run(
      "save",
      () =>
        post(`/performance/pips/${detail.pip.id}/statements`, {
          statement: text.trim(),
          check_in_id: checkIn === "none" ? null : checkIn,
        }),
      "Your account has been added to the plan.",
    );
    if (done !== undefined) {
      onClose();
      onDone();
    }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add your own account</DialogTitle>
          <DialogDescription>
            Saved with today&apos;s date and kept on the plan exactly as you write it. Nobody can edit it.
          </DialogDescription>
        </DialogHeader>
        {detail.check_ins.length > 0 && (
          <FormField htmlFor="st-checkin" label="In response to" optional>
            <Select value={checkIn} onValueChange={setCheckIn}>
              <SelectTrigger id="st-checkin" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">The plan as a whole</SelectItem>
                {detail.check_ins.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    Check-in on {c.held_on ? formatDay(c.held_on, true) : c.scheduled_for}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        )}
        <FormField htmlFor="st-text" label="Your account">
          <Textarea id="st-text" rows={6} maxLength={8000} value={text} onChange={(e) => setText(e.target.value)} />
        </FormField>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!text.trim() || busy !== null} onClick={() => void submit()}>
            {busy && <Loader2 className="animate-spin" />} Add to the plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssessDialog({
  pipId,
  milestoneId,
  onClose,
  onDone,
}: {
  pipId: string;
  milestoneId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [status, setStatus] = useState<MilestoneStatus>("met");
  const [note, setNote] = useState("");
  const { busy, run } = useAction();
  const submit = async () => {
    const done = await run(
      "save",
      () => post(`/performance/pips/${pipId}/milestones/${milestoneId}/assess`, { status, note: note.trim() }),
      "Milestone assessed.",
    );
    if (done !== undefined) {
      onClose();
      onDone();
    }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assess milestone</DialogTitle>
          <DialogDescription>Record the result and what it is based on.</DialogDescription>
        </DialogHeader>
        <FormField htmlFor="as-status" label="Result">
          <Select value={status} onValueChange={(v) => setStatus(v as MilestoneStatus)}>
            <SelectTrigger id="as-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="met">Met</SelectItem>
              <SelectItem value="not_met">Not met</SelectItem>
              <SelectItem value="waived">Waived</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <FormField htmlFor="as-note" label="Based on">
          <Textarea id="as-note" rows={3} maxLength={4000} value={note} onChange={(e) => setNote(e.target.value)} />
        </FormField>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!note.trim() || busy !== null} onClick={() => void submit()}>
            {busy && <Loader2 className="animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CloseDialog({ detail, onClose, onDone }: { detail: PipDetail; onClose: () => void; onDone: () => void }) {
  const [outcome, setOutcome] = useState("successful");
  const [reason, setReason] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [acknowledge, setAcknowledge] = useState(false);
  const { busy, run } = useAction();
  const needsReason = outcome !== "successful";
  const valid = (!needsReason || reason.trim()) && (outcome !== "extended" || newEnd);

  const submit = async () => {
    const result = await run<PipCloseResult>(
      "save",
      () =>
        post<PipCloseResult>(`/performance/pips/${detail.pip.id}/close`, {
          outcome,
          reason: reason.trim(),
          new_end_date: outcome === "extended" ? newEnd : null,
          acknowledge_weak_trail: acknowledge,
        }),
    );
    if (result) {
      onClose();
      onDone();
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record the outcome</DialogTitle>
          <DialogDescription>
            An unsuccessful outcome on a plan with gaps in its trail is refused unless you record that you are
            proceeding anyway.
          </DialogDescription>
        </DialogHeader>
        <FormField htmlFor="cl-outcome" label="Outcome">
          <Select value={outcome} onValueChange={setOutcome}>
            <SelectTrigger id="cl-outcome" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="successful">Successful</SelectItem>
              <SelectItem value="extended">Extended</SelectItem>
              <SelectItem value="unsuccessful">Unsuccessful</SelectItem>
              <SelectItem value="abandoned">Abandoned</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        {outcome === "extended" && (
          <FormField htmlFor="cl-end" label="New end date">
            <DatePicker id="cl-end" min={detail.pip.end_date} value={newEnd} onChange={setNewEnd} />
          </FormField>
        )}
        <FormField htmlFor="cl-reason" label="Reason" optional={!needsReason}>
          <Textarea id="cl-reason" rows={3} maxLength={4000} value={reason} onChange={(e) => setReason(e.target.value)} />
        </FormField>
        {outcome === "unsuccessful" && !detail.trail.is_defensible && (
          <div className="flex items-start gap-2">
            <Checkbox id="cl-ack" checked={acknowledge} onCheckedChange={(v) => setAcknowledge(v === true)} />
            <Label htmlFor="cl-ack" className="text-sm font-normal">
              I am proceeding knowing the trail has gaps. This is recorded on the plan.
            </Label>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={outcome === "unsuccessful" ? "destructive" : "default"} disabled={!valid || busy !== null} onClick={() => void submit()}>
            {busy && <Loader2 className="animate-spin" />} Record outcome
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EvidenceDialog({ pipId, onClose }: { pipId: string; onClose: () => void }) {
  const { data, error, isLoading } = useApiQuery<{
    period: { start: string; end: string; days: number };
    trail: { summary: string };
    check_ins: { check_in_id: string; held_on: string | null; manager_comments: string; employee_comments: string; is_evidenced: boolean }[];
    employee_statements: { statement: string; recorded_at: string }[];
    assembled_on: string;
    note: string;
  }>(`/performance/pips/${pipId}/evidence`);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Evidence pack</DialogTitle>
          <DialogDescription>{data?.note ?? "Everything an employment adviser would ask for."}</DialogDescription>
        </DialogHeader>
        {isLoading && <Skeleton className="h-40 w-full" />}
        {error && <ErrorState message={error.detail} />}
        {data && (
          <div className="max-h-[60vh] space-y-3 overflow-y-auto text-sm">
            <p>
              {formatDateRange(data.period.start, data.period.end)} ({data.period.days} days) · assembled{" "}
              {formatDay(data.assembled_on, true)}
            </p>
            <p className="font-medium">{data.trail.summary}</p>
            {data.check_ins.map((c) => (
              <div key={c.check_in_id} className="rounded-md border border-border p-2">
                <p className="text-xs text-muted-foreground">
                  {c.held_on ? formatDay(c.held_on, true) : "Not held"} · {c.is_evidenced ? "evidenced" : "not evidenced"}
                </p>
                <p>Manager: {c.manager_comments}</p>
                <p>Employee: {c.employee_comments || "—"}</p>
              </div>
            ))}
            {data.employee_statements.map((s) => (
              <p key={s.recorded_at} className="rounded-md bg-muted px-2 py-1">
                Employee statement, {formatDate(s.recorded_at)}: {s.statement}
              </p>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
