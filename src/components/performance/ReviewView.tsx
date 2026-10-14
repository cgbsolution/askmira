"use client";

import { CheckCircle2, Circle, CornerUpLeft, Dot, Loader2, RotateCcw, Send } from "lucide-react";
import React, { useState } from "react";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ErrorState } from "@/components/common/ErrorState";
import { FormField } from "@/components/common/FormField";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Feedback360Panel } from "./Feedback360Panel";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { ReviewDetail, ReviewEntry } from "@/lib/types/performance";
import { cn, formatDate, formatDateRange, formatDay } from "@/lib/utils";

import { ReviewForm } from "./ReviewForm";
import { GoalScorePanel, StatusBadge, useAction } from "./shared";

/**
 * One review, as the caller may see it: where it stands, the goal score, what
 * each step wrote, the outcome once released, and the actions the caller holds.
 * Everything shown and every button offered follows the server's `viewer` block.
 */
export function ReviewView({ appraisalId, onChanged }: { appraisalId: string; onChanged?: () => void }) {
  const { data, error, isLoading, reload } = useApiQuery<ReviewDetail>(
    `/appraisal/appraisals/${appraisalId}`,
  );
  const changed = () => {
    reload();
    onChanged?.();
  };

  if (isLoading && !data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (error) return <ErrorState message={error.detail} onRetry={reload} />;
  if (!data) return null;

  const { appraisal, viewer } = data;
  return (
    <div className="space-y-5">
      <Card tier="tier1">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {viewer.is_subject ? appraisal.cycle_name : `${appraisal.employee_name} · ${appraisal.cycle_name}`}
            <StatusBadge status={appraisal.status} />
            {appraisal.escalated && <Badge variant="warning">Escalated</Badge>}
          </CardTitle>
          <CardDescription>
            Review period {formatDateRange(appraisal.period_start, appraisal.period_end)}
            {appraisal.manager_name && ` · Manager ${appraisal.manager_name}`}
            {appraisal.department && ` · ${appraisal.department}`}
            {appraisal.reopened_count > 0 && ` · Reopened ${appraisal.reopened_count} time(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-wrap gap-x-5 gap-y-2">
            {data.stages.map((stage) => (
              <li key={stage.id} className="flex items-center gap-1.5 text-sm">
                {stage.state === "done" ? (
                  <CheckCircle2 className="size-4 text-success" />
                ) : stage.state === "current" ? (
                  <Circle className="size-4 fill-accent text-accent" />
                ) : (
                  <Dot className="size-4 text-muted-foreground" />
                )}
                <span className={cn(stage.state === "current" ? "font-semibold text-foreground" : "text-muted-foreground")}>
                  {stage.label}
                  {stage.state === "skipped" && " (skipped)"}
                  {!stage.is_mandatory && stage.state === "upcoming" && " (optional)"}
                </span>
                {stage.state === "current" && stage.due_date && (
                  <span className={cn("text-xs", appraisal.days_overdue > 0 ? "text-destructive" : "text-muted-foreground")}>
                    due {formatDay(stage.due_date, true)}
                    {appraisal.days_overdue > 0 && ` · ${appraisal.days_overdue}d overdue`}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {data.outcome && (appraisal.status === "released" || appraisal.status === "acknowledged" || !viewer.is_subject) && (
        <OutcomeCard detail={data} onChanged={changed} />
      )}

      <Card tier="tier1">
        <CardContent>
          <GoalScorePanel goals={data.goals} />
          {data.template && (
            <p className="mt-3 text-xs text-muted-foreground">
              This cycle weighs goals {data.template.goal_weight}%, competencies {data.template.competency_weight}%
              {data.template.values_weight !== "0.00" ? `, values ${data.template.values_weight}%` : ""}.
            </p>
          )}
        </CardContent>
      </Card>

      <Feedback360Panel requests={data.feedback_360 ?? []} />

      {viewer.can_act && (
        <Card tier="tier1">
          <CardHeader>
            <CardTitle>{appraisal.current_stage_label}</CardTitle>
            <CardDescription>{viewer.act_reason}</CardDescription>
          </CardHeader>
          <CardContent>
            {!data.template && (
              <Alert className="mb-4">
                <AlertDescription>
                  This cycle has no scoring template, so this step records comments only.
                </AlertDescription>
              </Alert>
            )}
            <ReviewForm key={`${appraisal.id}-${appraisal.current_stage_id}`} detail={data} onDone={changed} />
            {viewer.return_targets.length > 0 && <ReturnAction detail={data} onChanged={changed} />}
          </CardContent>
        </Card>
      )}

      {!viewer.can_act && appraisal.current_stage_label && viewer.is_subject && (
        <Alert>
          <AlertTitle>With {appraisal.current_stage_label.toLowerCase()}</AlertTitle>
          <AlertDescription>
            Your part is done for now. You will see the assessment once HR releases it.
          </AlertDescription>
        </Alert>
      )}

      <EntryList entries={data.entries} />
    </div>
  );
}

function EntryList({ entries }: { entries: ReviewEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle>History</CardTitle>
        <CardDescription>Every submission and return, in order. Returns stay on the record.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {entries.map((entry) => (
          <div key={entry.id} className="rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">
                {entry.stage_label}
                {entry.returned_to_label ? ` → returned to ${entry.returned_to_label}` : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                {entry.actor_name ?? "—"}
                {entry.delegated_from_name && ` for ${entry.delegated_from_name}`}
                {entry.is_escalated && " (escalated)"} · {formatDate(entry.submitted_at)}
                {entry.score && <span className="ml-2 font-semibold tabular-nums text-foreground">{entry.score}</span>}
              </p>
            </div>
            {entry.returned_reason && <p className="mt-1 text-sm text-foreground">Reason: {entry.returned_reason}</p>}
            {entry.comments && <p className="mt-1 whitespace-pre-line text-sm text-foreground">{entry.comments}</p>}
            {(entry.ratings.competencies?.length ?? 0) > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {entry.ratings.competencies
                  ?.map((r) => (r.is_applicable ? `${r.rating ?? "—"}` : "n/a"))
                  .join(" · ")}{" "}
                across {entry.ratings.competencies?.length} competency ratings
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function OutcomeCard({ detail, onChanged }: { detail: ReviewDetail; onChanged: () => void }) {
  const { appraisal, viewer, outcome } = detail;
  const { busy, run } = useAction();
  const [ackOpen, setAckOpen] = useState(false);
  const [disagree, setDisagree] = useState(false);
  const [objection, setObjection] = useState("");
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reason, setReason] = useState("");

  const acknowledge = async () => {
    const done = await run(
      "ack",
      () =>
        post(`/appraisal/appraisals/${appraisal.id}/acknowledge`, {
          acknowledgement: disagree ? "disagreed" : "agreed",
          objection: disagree ? objection.trim() : null,
        }),
      disagree ? "Acknowledged. Your objection has gone to HR." : "Acknowledged.",
    );
    if (done !== undefined) {
      setAckOpen(false);
      onChanged();
    }
  };

  const reopen = async () => {
    const done = await run(
      "reopen",
      () =>
        post(`/appraisal/appraisals/${appraisal.id}/reopen`, {
          reason: reason.trim(),
          acknowledge_impact: true,
        }),
      "Review reopened. It starts again from the first step.",
    );
    if (done === undefined) throw new Error("not reopened");
    onChanged();
  };

  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle>Outcome</CardTitle>
        <CardDescription>
          {appraisal.status === "completed"
            ? "Complete and not yet released to the employee."
            : appraisal.released_at
              ? `Released ${formatDate(appraisal.released_at)}`
              : "In progress"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-baseline gap-4">
          <p className="text-2xl font-semibold text-foreground">{outcome?.final_rating ?? "No rating yet"}</p>
          {outcome?.final_score && (
            <p className="text-sm tabular-nums text-muted-foreground">Score {outcome.final_score} / 100</p>
          )}
          {outcome?.calibrated && <Badge variant="secondary">Calibrated</Badge>}
        </div>
        {appraisal.acknowledged_at && (
          <p className="text-sm text-foreground">
            Acknowledged {formatDate(appraisal.acknowledged_at)}
            {appraisal.acknowledgement_type === "disagreed" ? " with a written objection." : " and agreed."}
          </p>
        )}
        {appraisal.objection && (
          <p className="rounded-md bg-muted px-3 py-2 text-sm text-foreground">Objection: {appraisal.objection}</p>
        )}
        <div className="flex flex-wrap gap-2">
          {viewer.can_acknowledge && (
            <Button variant="accent" onClick={() => setAckOpen(true)}>
              Acknowledge
            </Button>
          )}
          {viewer.can_release && (
            <Button onClick={() => setReleaseOpen(true)}>
              <Send /> Release to employee
            </Button>
          )}
          {viewer.can_reopen && (
            <Button variant="outline" onClick={() => setReopenOpen(true)}>
              <RotateCcw /> Reopen
            </Button>
          )}
        </div>
      </CardContent>

      <Dialog open={ackOpen} onOpenChange={setAckOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Acknowledge your review</DialogTitle>
            <DialogDescription>
              Acknowledging closes the review for you. You can disagree — your written objection goes to HR
              and stays on the record.
            </DialogDescription>
          </DialogHeader>
          <FormField htmlFor="ack-choice" label="Your response">
            <Select value={disagree ? "disagreed" : "agreed"} onValueChange={(v) => setDisagree(v === "disagreed")}>
              <SelectTrigger id="ack-choice" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="agreed">I agree with this review</SelectItem>
                <SelectItem value="disagreed">I acknowledge it but disagree</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          {disagree && (
            <FormField htmlFor="ack-objection" label="Your objection" hint="Required. Say what you disagree with and why.">
              <Textarea
                id="ack-objection"
                rows={5}
                maxLength={8000}
                value={objection}
                onChange={(e) => setObjection(e.target.value)}
              />
            </FormField>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAckOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy !== null || (disagree && !objection.trim())} onClick={() => void acknowledge()}>
              {busy === "ack" && <Loader2 className="animate-spin" />} Acknowledge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={releaseOpen}
        onOpenChange={setReleaseOpen}
        title={`Release ${appraisal.employee_name}'s review?`}
        description={`They will see the rating "${outcome?.final_rating ?? "—"}" and every step's comments, and be asked to acknowledge.`}
        confirmLabel="Release"
        onConfirm={async () => {
          const done = await run("release", () => post(`/appraisal/appraisals/${appraisal.id}/release`, {}), "Released.");
          if (done === undefined) throw new Error("not released");
          onChanged();
        }}
      />

      <ConfirmDialog
        open={reopenOpen}
        onOpenChange={setReopenOpen}
        title="Reopen this review?"
        description="It restarts from the first step. Any increment already recommended on this rating is listed on the record and is not unwound."
        confirmLabel="Reopen"
        destructive
        onConfirm={reopen}
      >
        <FormField htmlFor="reopen-reason" label="Reason">
          <Input id="reopen-reason" value={reason} maxLength={4000} onChange={(e) => setReason(e.target.value)} />
        </FormField>
      </ConfirmDialog>
    </Card>
  );
}

function ReturnAction({ detail, onChanged }: { detail: ReviewDetail; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(detail.viewer.return_targets.at(-1)?.id ?? "");
  const [reason, setReason] = useState("");
  const { busy, run } = useAction();

  const submit = async () => {
    const done = await run(
      "return",
      () =>
        post(`/appraisal/appraisals/${detail.appraisal.id}/return`, {
          target_stage_id: target,
          reason: reason.trim(),
        }),
      "Sent back with your reason.",
    );
    if (done !== undefined) {
      setOpen(false);
      onChanged();
    }
  };

  return (
    <>
      <Button variant="ghost" className="mt-3" onClick={() => setOpen(true)}>
        <CornerUpLeft /> Send back to an earlier step
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send back</DialogTitle>
            <DialogDescription>The person receiving it sees your reason. The return stays in the history.</DialogDescription>
          </DialogHeader>
          <FormField htmlFor="return-target" label="Back to">
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger id="return-target" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {detail.viewer.return_targets.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField htmlFor="return-reason" label="What needs to change">
            <Textarea id="return-reason" rows={4} maxLength={4000} value={reason} onChange={(e) => setReason(e.target.value)} />
          </FormField>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!target || !reason.trim() || busy !== null} onClick={() => void submit()}>
              {busy && <Loader2 className="animate-spin" />} Send back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
