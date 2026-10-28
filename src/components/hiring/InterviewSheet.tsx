"use client";

import {
  AlertTriangle,
  CalendarClock,
  Check,
  CheckCircle2,
  ExternalLink,
  HelpCircle,
  Loader2,
  MessageSquarePlus,
  X,
  XCircle,
} from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { ErrorState } from "@/components/common/ErrorState";
import { FormField } from "@/components/common/FormField";
import { FeedbackDialog } from "@/components/hiring/FeedbackDialog";
import { FeedbackView } from "@/components/hiring/FeedbackView";
import { InterviewAdvanceCheck, InterviewConsolidated } from "@/components/hiring/InterviewConsolidated";
import { InterviewWhen } from "@/components/hiring/InterviewTable";
import {
  humanize,
  INTERVIEW_MODE,
  INTERVIEW_STATUS,
  PANEL_RESPONSE,
  safeHref,
  StatusBadge,
} from "@/components/hiring/labels";
import { ActionDialog } from "@/components/hiring/OfferActionDialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, patch, post } from "@/lib/api";
import type { InterviewDetail, PanelResponse } from "@/lib/types/hiring";
import { DateTimePicker } from "@/components/common/DateTimePicker";

type ManageAction = "outcome" | "reschedule" | "cancel" | null;
type Outcome = "completed" | "candidate_no_show" | "panel_no_show";

const ACTIVE_STATUSES = new Set(["scheduled", "rescheduled"]);

const RESPONSES: { value: Exclude<PanelResponse, "needs_action">; label: string; icon: typeof Check }[] = [
  { value: "accepted", label: "Accept", icon: Check },
  { value: "tentative", label: "Tentative", icon: HelpCircle },
  { value: "declined", label: "Decline", icon: X },
];

/** Warnings from the calendar side of a schedule or reschedule, as a toast. */
function toastCalendarWarnings(title: string, warnings: unknown) {
  const list = Array.isArray(warnings) ? warnings.map(String) : [];
  if (list.length > 0) toast.warning(title, { description: list.join(" ") });
  else toast.success(title);
}

/**
 * One interview, opened from a list: when and where, the panel and their
 * replies, and what the viewer may do — reply, give or read feedback, see the
 * consolidated view (overseers) and manage the booking (HR).
 */
export function InterviewSheet({
  interviewId,
  onClose,
  onChanged,
}: {
  interviewId: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const { data, error, isLoading, reload } = useApiQuery<InterviewDetail>(
    interviewId ? `/interviews/${interviewId}` : null,
  );
  const detail = data && data.id === interviewId ? data : null;
  const [responding, setResponding] = useState<PanelResponse | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [manage, setManage] = useState<ManageAction>(null);
  const [feedbackVersion, setFeedbackVersion] = useState(0);

  const me = detail?.panel.find((member) => member.user_id === user?.id) ?? null;
  const changed = () => {
    reload();
    onChanged();
  };

  const respond = async (response: Exclude<PanelResponse, "needs_action">) => {
    if (!detail || !user) return;
    setResponding(response);
    try {
      await post(`/interviews/${detail.id}/response`, { panelist_user_id: user.id, response });
      toast.success(`Reply recorded: ${PANEL_RESPONSE[response][0]}`);
      changed();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "Your reply could not be recorded.");
    } finally {
      setResponding(null);
    }
  };

  let body: React.ReactNode;
  if (!interviewId) {
    body = null;
  } else if (isLoading && !detail) {
    body = (
      <div className="space-y-3 px-4">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  } else if (error) {
    body = <ErrorState message={error.detail} onRetry={reload} />;
  } else if (detail) {
    const href = safeHref(detail.location_or_link);
    const active = ACTIVE_STATUSES.has(detail.status);
    const canGiveFeedback = Boolean(me) && !detail.my_feedback_submitted;

    body = (
      <div className="space-y-5 px-4 pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge map={INTERVIEW_STATUS} value={detail.status} />
          <Badge variant="outline">{INTERVIEW_MODE[detail.mode] ?? detail.mode}</Badge>
          <Badge variant="muted">{humanize(detail.stage.stage_type)}</Badge>
          {detail.reschedule_count > 0 && (
            <Badge variant="warning" className="tabular-nums">
              Rescheduled {detail.reschedule_count}×
            </Badge>
          )}
        </div>

        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">When</p>
            <InterviewWhen start={detail.scheduled_start} candidateTimezone={detail.candidate_timezone} />
            <p className="text-xs text-muted-foreground">{detail.stage.duration_minutes} minutes</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Where</p>
            {href ? (
              <a
                href={href}
                target={href.startsWith("https://") ? "_blank" : undefined}
                rel={href.startsWith("https://") ? "noopener noreferrer" : undefined}
                className="inline-flex items-center gap-1 break-all text-primary hover:underline"
              >
                {detail.location_or_link} <ExternalLink className="size-3.5 shrink-0" />
              </a>
            ) : (
              <p className="break-words">{detail.location_or_link ?? "Not set"}</p>
            )}
          </div>
          {detail.stage.required_competencies.length > 0 && (
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground">Competencies assessed</p>
              <p>{detail.stage.required_competencies.map(humanize).join(", ")}</p>
            </div>
          )}
          {detail.stage.preparation_notes && (
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground">Preparation notes</p>
              <p className="whitespace-pre-line">{detail.stage.preparation_notes}</p>
            </div>
          )}
        </div>

        {detail.calendar_warnings.length > 0 && (
          <Alert variant="warning">
            <AlertTriangle />
            <AlertTitle>Calendar warnings</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">
                {detail.calendar_warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap gap-2">
          {me &&
            active &&
            RESPONSES.map((option) => (
              <Button
                key={option.value}
                size="sm"
                variant={me.response === option.value ? "default" : "outline"}
                disabled={responding !== null}
                onClick={() => void respond(option.value)}
              >
                {responding === option.value ? <Loader2 className="animate-spin" /> : <option.icon />}
                {option.label}
              </Button>
            ))}
          {canGiveFeedback && (
            <Button size="sm" variant="accent" onClick={() => setFeedbackOpen(true)}>
              <MessageSquarePlus /> Give feedback
            </Button>
          )}
          {detail.can_manage && active && (
            <>
              <Button size="sm" variant="outline" onClick={() => setManage("outcome")}>
                <CheckCircle2 /> Record outcome
              </Button>
              <Button size="sm" variant="outline" onClick={() => setManage("reschedule")}>
                <CalendarClock /> Reschedule
              </Button>
              <Button size="sm" variant="outline" onClick={() => setManage("cancel")}>
                <XCircle /> Cancel
              </Button>
            </>
          )}
        </div>
        {me && detail.my_feedback_submitted && (
          <p className="text-xs text-muted-foreground">You have submitted your feedback.</p>
        )}

        <Separator />

        <Tabs defaultValue="panel">
          <TabsList>
            <TabsTrigger value="panel">Panel</TabsTrigger>
            <TabsTrigger value="feedback">View feedback</TabsTrigger>
            {detail.oversees && <TabsTrigger value="consolidated">Consolidated</TabsTrigger>}
          </TabsList>
          <TabsContent value="panel">
            {detail.panel.length === 0 ? (
              <p className="text-sm text-muted-foreground">No one is on this panel.</p>
            ) : (
              <ul className="divide-y divide-border">
                {detail.panel.map((member) => (
                  <li key={member.user_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {member.name}
                        {member.user_id === user?.id && <span className="text-muted-foreground"> (you)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {humanize(member.role)}
                        {member.email ? ` · ${member.email}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <StatusBadge map={PANEL_RESPONSE} value={member.response} />
                      {member.feedback_submitted ? (
                        <Badge variant="success">Feedback in</Badge>
                      ) : (
                        <Badge variant="outline">No feedback yet</Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
          <TabsContent value="feedback">
            <FeedbackView key={feedbackVersion} interviewId={detail.id} />
          </TabsContent>
          {detail.oversees && (
            <TabsContent value="consolidated" className="space-y-4">
              <InterviewAdvanceCheck key={`advance-${feedbackVersion}`} interviewId={detail.id} />
              <InterviewConsolidated key={`consolidated-${feedbackVersion}`} interviewId={detail.id} />
            </TabsContent>
          )}
        </Tabs>

        {canGiveFeedback && (
          <FeedbackDialog
            interviewId={detail.id}
            competencies={detail.stage.required_competencies}
            open={feedbackOpen}
            onOpenChange={setFeedbackOpen}
            onSubmitted={() => {
              setFeedbackVersion((v) => v + 1);
              changed();
            }}
          />
        )}
        {detail.can_manage && (
          <InterviewManageDialogs
            key={detail.id}
            detail={detail} action={manage} onAction={setManage} onDone={changed} />
        )}
      </div>
    );
  }

  return (
    <Sheet open={interviewId !== null} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{detail ? `${detail.candidate_name} · ${detail.stage.name}` : "Interview"}</SheetTitle>
          <SheetDescription>
            {detail
              ? `${detail.requisition_code ?? ""}${detail.requisition_title ? ` · ${detail.requisition_title}` : ""}`
              : "Loading the interview"}
          </SheetDescription>
        </SheetHeader>
        {body}
      </SheetContent>
    </Sheet>
  );
}

/** HR's dialogs for one interview: record the outcome, reschedule, cancel. */
function InterviewManageDialogs({
  detail,
  action,
  onAction,
  onDone,
}: {
  detail: InterviewDetail;
  action: ManageAction;
  onAction: (action: ManageAction) => void;
  onDone: () => void;
}) {
  const [outcome, setOutcome] = useState<Outcome | "">("");
  const [note, setNote] = useState("");
  const [start, setStart] = useState("");
  const [timezone, setTimezone] = useState(detail.candidate_timezone || "Asia/Kolkata");
  const [reason, setReason] = useState("");

  const close = (next: boolean) => {
    if (next) return;
    onAction(null);
    setOutcome("");
    setNote("");
    setStart("");
    setReason("");
    setTimezone(detail.candidate_timezone || "Asia/Kolkata");
  };

  return (
    <>
      <ActionDialog
        open={action === "outcome"}
        onOpenChange={close}
        title="Record outcome"
        submitLabel="Record"
        validate={() => (outcome ? null : "Choose what happened.")}
        onSubmit={async () => {
          await patch(`/interviews/${detail.id}/outcome`, {
            status: outcome,
            note: note.trim() || null,
          });
          toast.success("Outcome recorded");
          onDone();
        }}
      >
        <FormField htmlFor="interview-outcome" label="What happened">
          <Select value={outcome} onValueChange={(value) => setOutcome(value as Outcome)}>
            <SelectTrigger id="interview-outcome" className="w-full">
              <SelectValue placeholder="Choose one" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="candidate_no_show">Candidate did not attend</SelectItem>
              <SelectItem value="panel_no_show">Panel did not attend</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <FormField htmlFor="interview-outcome-note" label="Note" optional>
          <Textarea
            id="interview-outcome-note"
            rows={3}
            maxLength={2000}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </FormField>
      </ActionDialog>

      <ActionDialog
        open={action === "reschedule"}
        onOpenChange={close}
        title="Reschedule interview"
        description="The new time is read as wall-clock time in the time zone below. The panel and candidate are told."
        submitLabel="Reschedule"
        validate={() => {
          if (!start) return "Choose the new date and time.";
          if (!timezone.trim()) return "Enter the time zone the new time is in.";
          if (!reason.trim()) return "Say why the interview is moving.";
          return null;
        }}
        onSubmit={async () => {
          const result = await patch<{ calendar_warnings?: unknown }>(`/interviews/${detail.id}/reschedule`, {
            start,
            reason: reason.trim(),
            candidate_timezone: timezone.trim(),
          });
          toastCalendarWarnings("Interview rescheduled", result?.calendar_warnings);
          onDone();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField htmlFor="interview-new-start" label="New start">
            <DateTimePicker
              id="interview-new-start"
              value={start}
              onChange={setStart}
            />
          </FormField>
          <FormField htmlFor="interview-new-tz" label="Time zone" hint="For example Asia/Kolkata">
            <Input
              id="interview-new-tz"
              value={timezone}
              maxLength={64}
              onChange={(event) => setTimezone(event.target.value)}
            />
          </FormField>
        </div>
        <FormField htmlFor="interview-reschedule-reason" label="Reason">
          <Textarea
            id="interview-reschedule-reason"
            rows={3}
            maxLength={2000}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </FormField>
      </ActionDialog>

      <ActionDialog
        open={action === "cancel"}
        onOpenChange={close}
        title="Cancel interview"
        description="The panel and candidate are told it is cancelled. This cannot be undone; schedule a new one if needed."
        submitLabel="Cancel interview"
        destructive
        validate={() => (reason.trim() ? null : "Say why the interview is cancelled.")}
        onSubmit={async () => {
          await post(`/interviews/${detail.id}/cancel`, { reason: reason.trim() });
          toast.success("Interview cancelled");
          onDone();
        }}
      >
        <FormField htmlFor="interview-cancel-reason" label="Reason">
          <Textarea
            id="interview-cancel-reason"
            rows={3}
            maxLength={2000}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </FormField>
      </ActionDialog>
    </>
  );
}
