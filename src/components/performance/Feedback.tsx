"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  EyeOff,
  HandHeart,
  Inbox,
  Loader2,
  MessageSquareHeart,
  Send,
  UserRoundSearch,
  Users,
  X,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/data-table/DataTable";
import { DataPanel } from "@/components/common/DataPanel";
import { DatePicker } from "@/components/common/DatePicker";
import { EmployeePicker, employeeDisplayName } from "@/components/common/EmployeePicker";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { FormField } from "@/components/common/FormField";
import { PageShell } from "@/components/common/PageShell";
import { PersonCell } from "@/components/common/PersonCell";
import { humanize, PersonSelect, StatusBadge, useAction, usePeople } from "@/components/performance/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { HR, MANAGERS } from "@/lib/access";
import { post } from "@/lib/api";
import type { EmployeeSummary } from "@/lib/types";
import type {
  FeedbackCompetencyAggregate,
  FeedbackCompetencyAnswerInput,
  FeedbackForm,
  FeedbackInboxItem,
  FeedbackRequestDetail,
  FeedbackRequestSummary,
  FeedbackScale,
  FeedbackVisibility,
  GoalCycleOption,
  PrivateFeedback,
  PrivateFeedbackKind,
} from "@/lib/types/performance";
import { formatDate, formatDay, toISODate } from "@/lib/utils";

const NONE = "__none__";
const MAX_REVIEWERS = 8;

const VISIBILITY_LABEL: Record<FeedbackVisibility, string> = {
  anonymised: "Anonymised summary for the person (from 3 answers)",
  named: "The person sees each answer with its writer",
  manager_only: "Manager line and HR only",
};

const OVERALL: { value: string; label: string }[] = [
  { value: "1", label: "1 — Needs significant improvement" },
  { value: "2", label: "2 — Needs some improvement" },
  { value: "3", label: "3 — Solid" },
  { value: "4", label: "4 — Strong" },
  { value: "5", label: "5 — Exceptional" },
];

const TABS = ["give", "about", "team", "notes", "all"] as const;
type Tab = (typeof TABS)[number];

/** 360 feedback — to give, about me, about my team — and private notes between colleagues. */
export function FeedbackScreen() {
  const { user, hasRole } = useAuth();
  const params = useSearchParams();
  const isManager = hasRole(...MANAGERS);
  const isHr = hasRole(...HR);
  const hasRecord = Boolean(user?.employee_id);
  const requested = params.get("tab") as Tab | null;
  const [tab, setTab] = useState<Tab>(
    requested && TABS.includes(requested) ? requested : hasRecord ? "give" : "all",
  );
  const [asking, setAsking] = useState(false);
  const [giving, setGiving] = useState(false);
  const [version, setVersion] = useState(0);
  const bump = () => setVersion((v) => v + 1);

  if (!hasRecord && !isHr) {
    return (
      <PageShell title="Feedback" description="Feedback from colleagues, and private notes between you and a colleague.">
        <Card tier="tier1">
          <EmptyState
            icon={Users}
            title="Your login is not linked to an employee record"
            description="Feedback is given and received by employees. Ask HR to link your account."
          />
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Feedback"
      description="Ask colleagues for 360 feedback, answer what you have been asked, and send private feedback."
      actions={
        <div className="flex flex-wrap gap-2">
          {hasRecord && (
            <Button variant="outline" onClick={() => setGiving(true)}>
              <HandHeart /> Give feedback
            </Button>
          )}
          <Button variant="accent" onClick={() => setAsking(true)}>
            <Send /> Ask for feedback
          </Button>
        </div>
      }
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="flex-wrap">
          {hasRecord && <TabsTrigger value="give">To give</TabsTrigger>}
          {hasRecord && <TabsTrigger value="about">About me</TabsTrigger>}
          {isManager && <TabsTrigger value="team">My team</TabsTrigger>}
          {hasRecord && <TabsTrigger value="notes">Private notes</TabsTrigger>}
          {isHr && <TabsTrigger value="all">All requests</TabsTrigger>}
        </TabsList>
        {hasRecord && (
          <TabsContent value="give" className="mt-4">
            <GiveTab version={version} />
          </TabsContent>
        )}
        {hasRecord && (
          <TabsContent value="about" className="mt-4">
            <RequestsTab
              scope="about_me"
              version={version}
              title="Feedback about me"
              empty="Ask colleagues for feedback — you will see a summary here once enough have answered."
            />
          </TabsContent>
        )}
        {isManager && (
          <TabsContent value="team" className="mt-4">
            <RequestsTab
              scope="team"
              version={version}
              title="Feedback about my team"
              empty="Ask for feedback about someone in your team, or see requests they have made."
            />
          </TabsContent>
        )}
        {hasRecord && (
          <TabsContent value="notes" className="mt-4">
            <NotesTab version={version} isManager={isManager} />
          </TabsContent>
        )}
        {isHr && (
          <TabsContent value="all" className="mt-4">
            <RequestsTab scope="all" version={version} title="Every request" empty="No feedback has been requested yet." />
          </TabsContent>
        )}
      </Tabs>

      {asking && (
        <AskDialog
          canAskForOthers={isManager}
          selfId={user?.employee_id ?? null}
          onClose={() => setAsking(false)}
          onDone={() => {
            setAsking(false);
            bump();
          }}
        />
      )}
      {giving && (
        <GivePrivateDialog
          selfId={user?.employee_id ?? null}
          onClose={() => setGiving(false)}
          onDone={() => {
            setGiving(false);
            bump();
          }}
        />
      )}
    </PageShell>
  );
}

// ── To give ─────────────────────────────────────────────────────────────────

/** The status shown for one answer: a pending answer on a closed request reads "closed". */
function inboxStatus(r: FeedbackInboxItem): string {
  return r.request_status === "closed" && r.status === "pending" ? "closed" : r.status;
}

function GiveTab({ version }: { version: number }) {
  const { data, error, isLoading, reload } = useApiQuery<FeedbackInboxItem[]>(`/feedback/inbox?v=${version}`);
  const [open, setOpen] = useState<string | null>(null);
  const rows = data ?? [];
  const waiting = rows.filter((r) => r.status === "pending" && r.request_status === "open").length;
  const columns: ColumnDef<FeedbackInboxItem>[] = [
    {
      accessorKey: "subject_name",
      header: "About",
      meta: { text: (r) => `${r.subject_name} · ${r.cycle_name ?? "Ad hoc"}` },
      cell: ({ row }) => (
        <PersonCell name={row.original.subject_name} subtitle={row.original.cycle_name ?? "Ad hoc"} size="sm" />
      ),
    },
    {
      accessorKey: "requested_by_name",
      header: "Asked by",
      meta: { cellClassName: "text-muted-foreground" },
      cell: ({ row }) => row.original.requested_by_name ?? "—",
    },
    {
      accessorKey: "due_on",
      header: "Due",
      meta: { text: (r) => formatDay(r.due_on, true) },
      cell: ({ row }) => formatDay(row.original.due_on, true),
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (r) => inboxStatus(r),
      meta: { text: (r) => humanize(inboxStatus(r)) },
      cell: ({ row }) => <StatusBadge status={inboxStatus(row.original)} />,
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      meta: { className: "text-right", text: false },
      cell: ({ row }) => {
        const actionable = row.original.status === "pending" && row.original.request_status === "open";
        return (
          <Button size="sm" variant={actionable ? "default" : "ghost"} onClick={() => setOpen(row.original.reviewer_id)}>
            {actionable ? "Answer" : "View"}
          </Button>
        );
      },
    },
  ];
  return (
    <>
      <DataTable
        title="Feedback to give"
        description={waiting ? `${waiting} waiting on you.` : "Nothing is waiting on you."}
        columns={columns}
        data={rows}
        getRowId={(r) => r.reviewer_id}
        noun="requests"
        exportName="feedback-to-give"
        searchPlaceholder="Search by person or cycle"
        isLoading={isLoading && !data}
        error={error?.detail}
        onRetry={reload}
        empty={{
          icon: Inbox,
          title: "No one has asked you for feedback",
          description: "When a colleague or manager asks for your feedback on someone, it appears here.",
        }}
      />
      <Sheet open={open !== null} onOpenChange={(v) => !v && setOpen(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>Your feedback</SheetTitle>
            <SheetDescription>Specific, recent examples help most.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            {open && (
              <AnswerPanel
                reviewerId={open}
                onDone={() => {
                  reload();
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function scaleOptions(scale: FeedbackScale | null): { value: string; label: string }[] {
  if (!scale) return [];
  if (scale.levels.length) return scale.levels.map((l) => ({ value: l.value, label: `${Number(l.value)} — ${l.label}` }));
  const out = [];
  for (let v = Math.ceil(Number(scale.min)); v <= Math.floor(Number(scale.max)); v += 1) {
    out.push({ value: String(v), label: String(v) });
  }
  return out;
}

function AnswerPanel({ reviewerId, onDone }: { reviewerId: string; onDone: () => void }) {
  const { data, error, isLoading, reload, setData } = useApiQuery<FeedbackForm>(`/feedback/responses/${reviewerId}`);
  if (isLoading && !data) return <Skeleton className="h-64 w-full" />;
  if (error) return <ErrorState message={error.detail} onRetry={reload} />;
  if (!data) return null;
  return (
    <AnswerForm
      key={`${data.reviewer_id}-${data.status}`}
      form={data}
      onSaved={(next) => {
        setData(next);
        onDone();
      }}
    />
  );
}

function AnswerForm({ form, onSaved }: { form: FeedbackForm; onSaved: (f: FeedbackForm) => void }) {
  const editable = form.status === "pending" && form.request_status === "open";
  const initial = new Map(form.competency_ratings.map((c) => [c.competency_id, c]));
  const [answers, setAnswers] = useState<Record<string, FeedbackCompetencyAnswerInput>>(() =>
    Object.fromEntries(
      form.questions.map((q) => [
        q.competency_id,
        initial.get(q.competency_id) ?? { competency_id: q.competency_id, rating: null, comment: null },
      ]),
    ),
  );
  const [strengths, setStrengths] = useState(form.strengths ?? "");
  const [improvements, setImprovements] = useState(form.improvements ?? "");
  const [overall, setOverall] = useState(form.overall_rating ? String(Number(form.overall_rating)) : NONE);
  const [declineReason, setDeclineReason] = useState("");
  const [declining, setDeclining] = useState(false);
  const { busy, run } = useAction();
  const options = scaleOptions(form.scale);

  const saysSomething =
    strengths.trim() ||
    improvements.trim() ||
    overall !== NONE ||
    Object.values(answers).some((a) => a.rating || (a.comment ?? "").trim());

  const update = (id: string, patchValue: Partial<FeedbackCompetencyAnswerInput>) =>
    setAnswers((current) => ({ ...current, [id]: { ...current[id], ...patchValue } }));

  return (
    <div className="grid gap-4">
      <Card tier="tier1" className="gap-2">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Feedback on {form.subject_name} <StatusBadge status={form.status} />
          </CardTitle>
          <CardDescription>
            {form.requested_by_name ? `Asked by ${form.requested_by_name} · ` : ""}
            {form.cycle_name ? `${form.cycle_name} · ` : ""}due {formatDay(form.due_on, true)}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {form.message && <p className="whitespace-pre-line text-sm text-foreground">{form.message}</p>}
          <Alert>
            <EyeOff />
            <AlertDescription>{form.visibility_statement}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {form.questions.length > 0 && (
        <Card tier="tier1" className="gap-3">
          <CardHeader>
            <CardTitle>Competencies</CardTitle>
            <CardDescription>Rate what you have seen. Leave one blank if you have not seen it.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {form.questions.map((q) => (
              <div key={q.competency_id} className="grid gap-2 rounded-md border border-border p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{q.name}</p>
                  {q.description && <p className="text-xs text-muted-foreground">{q.description}</p>}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <FormField htmlFor={`fb-r-${q.competency_id}`} label="Rating" optional>
                    <Select
                      value={answers[q.competency_id]?.rating ? String(Number(answers[q.competency_id].rating)) : NONE}
                      onValueChange={(v) => update(q.competency_id, { rating: v === NONE ? null : v })}
                      disabled={!editable}
                    >
                      <SelectTrigger id={`fb-r-${q.competency_id}`} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Not seen / no rating</SelectItem>
                        {options.map((o) => (
                          <SelectItem key={o.value} value={String(Number(o.value))}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField htmlFor={`fb-c-${q.competency_id}`} label="Example" optional>
                    <Textarea
                      id={`fb-c-${q.competency_id}`}
                      rows={2}
                      maxLength={2000}
                      disabled={!editable}
                      value={answers[q.competency_id]?.comment ?? ""}
                      onChange={(e) => update(q.competency_id, { comment: e.target.value })}
                    />
                  </FormField>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card tier="tier1" className="gap-3">
        <CardHeader>
          <CardTitle>In your words</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <FormField htmlFor="fb-strengths" label="What do they do well?" optional>
            <Textarea
              id="fb-strengths"
              rows={3}
              maxLength={4000}
              disabled={!editable}
              value={strengths}
              onChange={(e) => setStrengths(e.target.value)}
            />
          </FormField>
          <FormField htmlFor="fb-improve" label="What could they do differently?" optional>
            <Textarea
              id="fb-improve"
              rows={3}
              maxLength={4000}
              disabled={!editable}
              value={improvements}
              onChange={(e) => setImprovements(e.target.value)}
            />
          </FormField>
          <FormField htmlFor="fb-overall" label="Overall" optional>
            <Select value={overall} onValueChange={setOverall} disabled={!editable}>
              <SelectTrigger id="fb-overall" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No overall rating</SelectItem>
                {OVERALL.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </CardContent>
      </Card>

      {editable ? (
        declining ? (
          <Card tier="tier1" className="gap-3">
            <CardContent className="grid gap-2">
              <FormField htmlFor="fb-decline" label="Why are you declining?" optional hint="For example, you have not worked with them.">
                <Textarea id="fb-decline" rows={2} maxLength={1000} value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} />
              </FormField>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setDeclining(false)}>
                  Back
                </Button>
                <Button
                  variant="destructive"
                  disabled={busy !== null}
                  onClick={async () => {
                    const r = await run(
                      "decline",
                      () =>
                        post<FeedbackForm>(`/feedback/responses/${form.reviewer_id}/decline`, {
                          reason: declineReason.trim() || null,
                        }),
                      "Declined.",
                    );
                    if (r) onSaved(r);
                  }}
                >
                  Decline
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!saysSomething || busy !== null}
              onClick={async () => {
                const r = await run(
                  "submit",
                  () =>
                    post<FeedbackForm>(`/feedback/responses/${form.reviewer_id}/submit`, {
                      competency_ratings: Object.values(answers)
                        .filter((a) => a.rating || (a.comment ?? "").trim())
                        .map((a) => ({ ...a, comment: (a.comment ?? "").trim() || null })),
                      strengths: strengths.trim() || null,
                      improvements: improvements.trim() || null,
                      overall_rating: overall === NONE ? null : overall,
                    }),
                  "Feedback submitted. Thank you.",
                );
                if (r) onSaved(r);
              }}
            >
              {busy === "submit" && <Loader2 className="animate-spin" />} Submit feedback
            </Button>
            <Button variant="ghost" onClick={() => setDeclining(true)}>
              I can&apos;t give feedback on this
            </Button>
          </div>
        )
      ) : (
        <p className="text-sm text-muted-foreground">
          {form.status === "submitted"
            ? `You submitted this on ${formatDate(form.submitted_at)}. An answer is final once given.`
            : form.status === "declined"
              ? "You declined this request."
              : "This request has been closed."}
        </p>
      )}
    </div>
  );
}

// ── Requests (about me / my team / all) ─────────────────────────────────────

function RequestsTab({
  scope,
  version,
  title,
  empty,
}: {
  scope: "about_me" | "team" | "all";
  version: number;
  title: string;
  empty: string;
}) {
  const { data, error, isLoading, reload } = useApiQuery<FeedbackRequestSummary[]>(
    `/feedback/requests?scope=${scope}&v=${version}`,
  );
  const [open, setOpen] = useState<string | null>(null);
  const rows = data ?? [];
  const columns: ColumnDef<FeedbackRequestSummary>[] = [
    {
      accessorKey: "subject_name",
      header: "About",
      meta: {
        text: (r) => (r.requested_by_name ? `${r.subject_name} · Asked by ${r.requested_by_name}` : r.subject_name),
      },
      cell: ({ row }) => (
        <PersonCell
          name={row.original.subject_name}
          subtitle={row.original.requested_by_name ? `Asked by ${row.original.requested_by_name}` : undefined}
          size="sm"
        />
      ),
    },
    {
      id: "cycle_name",
      header: "For",
      accessorFn: (r) => r.cycle_name ?? "Ad hoc",
      meta: { cellClassName: "text-muted-foreground" },
    },
    {
      accessorKey: "due_on",
      header: "Due",
      meta: { text: (r) => formatDay(r.due_on, true) },
      cell: ({ row }) => formatDay(row.original.due_on, true),
    },
    {
      id: "answered",
      header: "Answered",
      accessorFn: (r) => r.responses,
      meta: {
        className: "text-right",
        cellClassName: "tabular-nums",
        text: (r) => `${r.responses} / ${r.reviewers_total}${r.declined ? ` (${r.declined} declined)` : ""}`,
      },
      cell: ({ row }) => (
        <>
          {row.original.responses} / {row.original.reviewers_total}
          {row.original.declined ? (
            <span className="text-muted-foreground"> ({row.original.declined} declined)</span>
          ) : null}
        </>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      meta: { text: (r) => humanize(r.status) },
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      meta: { className: "text-right", text: false },
      cell: ({ row }) => (
        <Button size="sm" variant="ghost" onClick={() => setOpen(row.original.id)}>
          Open
        </Button>
      ),
    },
  ];
  return (
    <>
      <DataTable
        title={title}
        columns={columns}
        data={rows}
        noun="requests"
        exportName={`feedback-requests-${scope.replace("_", "-")}`}
        searchPlaceholder="Search by person or cycle"
        isLoading={isLoading && !data}
        error={error?.detail}
        onRetry={reload}
        empty={{ icon: MessageSquareHeart, title: "No feedback requests", description: empty }}
      />
      <Sheet open={open !== null} onOpenChange={(v) => !v && setOpen(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>Feedback request</SheetTitle>
            <SheetDescription>What you see here depends on who you are to this request.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">{open && <RequestPanel requestId={open} onChanged={reload} />}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function RequestPanel({ requestId, onChanged }: { requestId: string; onChanged: () => void }) {
  const { data, error, isLoading, reload, setData } = useApiQuery<FeedbackRequestDetail>(`/feedback/requests/${requestId}`);
  const { busy, run } = useAction();
  if (isLoading && !data) return <Skeleton className="h-64 w-full" />;
  if (error) return <ErrorState message={error.detail} onRetry={reload} />;
  if (!data) return null;
  const pending = (data.reviewers ?? []).filter((r) => r.status === "pending").length;

  return (
    <div className="grid gap-4">
      <Card tier="tier1" className="gap-2">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {data.subject_name} <StatusBadge status={data.status} />
          </CardTitle>
          <CardDescription>
            {data.cycle_name ?? "Ad hoc"} · due {formatDay(data.due_on, true)} · {data.responses} of {data.reviewers_total}{" "}
            answered{data.declined ? `, ${data.declined} declined` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {data.message && <p className="whitespace-pre-line text-sm text-foreground">{data.message}</p>}
          <Alert>
            <EyeOff />
            <AlertDescription>{data.visibility_note}</AlertDescription>
          </Alert>
          {data.can_manage && (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null || (data.reviewers !== null && pending === 0)}
                onClick={async () => {
                  const r = await run("remind", () =>
                    post<{ reminded: number }>(`/feedback/requests/${data.id}/remind`),
                  );
                  if (r) {
                    toastReminded(r.reminded);
                    reload();
                  }
                }}
              >
                Remind the rest
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy !== null}
                onClick={async () => {
                  const r = await run(
                    "close",
                    () => post<FeedbackRequestDetail>(`/feedback/requests/${data.id}/close`),
                    "Request closed.",
                  );
                  if (r) {
                    setData(r);
                    onChanged();
                  }
                }}
              >
                <X /> Stop collecting
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {data.aggregate && <AggregateCard aggregate={data.aggregate} />}

      {data.reviewers && (
        <Card tier="tier1" className="gap-3">
          <CardHeader>
            <CardTitle>Colleagues asked</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {data.reviewers.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <PersonCell
                    name={r.name}
                    size="sm"
                    subtitle={
                      r.status === "submitted"
                        ? `Answered ${formatDate(r.submitted_at)}`
                        : r.status === "declined"
                          ? r.decline_reason ?? "Declined"
                          : r.reminder_count
                            ? `Reminded ${r.reminder_count}×, last ${formatDate(r.last_reminded_at)}`
                            : "Not reminded yet"
                    }
                  />
                  <StatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {data.responses_named && data.responses_named.length > 0 && (
        <Card tier="tier1" className="gap-3">
          <CardHeader>
            <CardTitle>Answers</CardTitle>
            <CardDescription>With each colleague&apos;s name.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {data.responses_named.map((r) => (
              <div key={`${r.reviewer_name}-${r.submitted_at}`} className="grid gap-2 rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{r.reviewer_name}</p>
                  <span className="text-xs text-muted-foreground">
                    {r.overall_rating ? `Overall ${Number(r.overall_rating)} / 5 · ` : ""}
                    {formatDate(r.submitted_at)}
                  </span>
                </div>
                {r.competency_ratings.map((c) => (
                  <p key={c.competency_id} className="text-sm">
                    <span className="text-muted-foreground">{c.name}: </span>
                    {c.rating !== null && <span className="tabular-nums text-foreground">{Number(c.rating)}</span>}
                    {c.comment && <span className="text-foreground"> — {c.comment}</span>}
                  </p>
                ))}
                {r.strengths && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Does well: </span>
                    {r.strengths}
                  </p>
                )}
                {r.improvements && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Could do differently: </span>
                    {r.improvements}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function toastReminded(count: number) {
  toast.success(count ? `Reminded ${count} colleague(s).` : "Nobody left to remind.");
}

const AGGREGATE_COLUMNS: ColumnDef<FeedbackCompetencyAggregate>[] = [
  {
    accessorKey: "name",
    header: "Competency",
    cell: ({ row }) => (
      <>
        <p>{row.original.name}</p>
        {row.original.comments.map((comment) => (
          <p key={comment} className="text-xs text-muted-foreground">
            “{comment}”
          </p>
        ))}
      </>
    ),
  },
  {
    accessorKey: "average",
    header: "Average",
    meta: { className: "text-right", cellClassName: "tabular-nums" },
    cell: ({ row }) => row.original.average ?? "—",
  },
  {
    accessorKey: "responses",
    header: "Rated by",
    meta: { className: "text-right", cellClassName: "tabular-nums" },
  },
];

function AggregateCard({ aggregate }: { aggregate: NonNullable<FeedbackRequestDetail["aggregate"]> }) {
  return (
    <Card tier="tier1" className="gap-3">
      <CardHeader>
        <CardTitle>Summary</CardTitle>
        <CardDescription>
          {aggregate.responses} answer(s).
          {aggregate.overall_average
            ? ` Overall ${aggregate.overall_average} / 5 from ${aggregate.overall_count} rating(s).`
            : " No overall ratings given."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {aggregate.competencies.length > 0 && (
          <DataTable
            variant="plain"
            columns={AGGREGATE_COLUMNS}
            data={aggregate.competencies}
            getRowId={(c) => c.competency_id}
            noun="competencies"
          />
        )}
        <TextList title="What they do well" items={aggregate.strengths} />
        <TextList title="What they could do differently" items={aggregate.improvements} />
      </CardContent>
    </Card>
  );
}

function TextList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing written.</p>
      ) : (
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Private notes ───────────────────────────────────────────────────────────

function NotesTab({ version, isManager }: { version: number; isManager: boolean }) {
  const [scope, setScope] = useState<"received" | "given" | "team">("received");
  const { data, error, isLoading, reload } = useApiQuery<PrivateFeedback[]>(
    `/feedback/private?scope=${scope}&v=${version}`,
  );
  const rows = data ?? [];
  return (
    <DataPanel
      title="Private feedback"
      description="Visible to the person it is for, their manager and whoever wrote it. Never on the feed."
      toolbar={
        <Select value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
          <SelectTrigger aria-label="Which feedback" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="received">Received</SelectItem>
            <SelectItem value="given">Given</SelectItem>
            {isManager && <SelectItem value="team">My team received</SelectItem>}
          </SelectContent>
        </Select>
      }
      isLoading={isLoading && !data}
      error={error?.detail}
      onRetry={reload}
      isEmpty={rows.length === 0}
      empty={{
        icon: MessageSquareHeart,
        title: scope === "given" ? "You have not sent any private feedback" : "No private feedback yet",
        description: "Use “Give feedback” to thank a colleague or suggest something, privately.",
      }}
    >
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.id} className="grid gap-1 px-6 py-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium text-foreground">{r.from_name}</span>
              <span className="text-muted-foreground">to</span>
              <span className="font-medium text-foreground">{r.to_name}</span>
              <Badge variant={r.kind === "appreciation" ? "success" : "secondary"}>
                {r.kind === "appreciation" ? "Appreciation" : "Suggestion"}
              </Badge>
              <span className="text-xs text-muted-foreground">{formatDate(r.created_at)}</span>
            </div>
            <p className="whitespace-pre-line text-sm text-foreground">{r.body}</p>
          </li>
        ))}
      </ul>
    </DataPanel>
  );
}

function GivePrivateDialog({
  selfId,
  onClose,
  onDone,
}: {
  selfId: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [to, setTo] = useState<EmployeeSummary | null>(null);
  const [kind, setKind] = useState<PrivateFeedbackKind>("appreciation");
  const [body, setBody] = useState("");
  const { busy, run } = useAction();
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Give feedback</DialogTitle>
          <DialogDescription>
            Private: the colleague and their manager can read it. For public praise, post a shoutout on the Culture feed.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <FormField htmlFor="pf-to" label="To">
            <EmployeePicker id="pf-to" value={to} onChange={setTo} excludeId={selfId} />
          </FormField>
          <FormField htmlFor="pf-kind" label="Kind">
            <Select value={kind} onValueChange={(v) => setKind(v as PrivateFeedbackKind)}>
              <SelectTrigger id="pf-kind" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="appreciation">Appreciation</SelectItem>
                <SelectItem value="suggestion">Suggestion</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField htmlFor="pf-body" label="Feedback">
            <Textarea id="pf-body" rows={4} maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)} />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!to || !body.trim() || busy !== null}
            onClick={async () => {
              if (!to) return;
              const r = await run(
                "send",
                () => post("/feedback/private", { to_employee_id: to.id, kind, body: body.trim() }),
                `Feedback sent to ${employeeDisplayName(to)}.`,
              );
              if (r !== undefined) onDone();
            }}
          >
            {busy && <Loader2 className="animate-spin" />} Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Asking ──────────────────────────────────────────────────────────────────

function AskDialog({
  canAskForOthers,
  selfId,
  onClose,
  onDone,
}: {
  canAskForOthers: boolean;
  selfId: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const people = usePeople();
  const cycles = useApiQuery<GoalCycleOption[]>("/goals/cycles");
  const [about, setAbout] = useState<string>(selfId ? "me" : "");
  const [subjectId, setSubjectId] = useState("");
  const [picked, setPicked] = useState<EmployeeSummary | null>(null);
  const [reviewers, setReviewers] = useState<EmployeeSummary[]>([]);
  const [cycleId, setCycleId] = useState(NONE);
  const [due, setDue] = useState("");
  const [visibility, setVisibility] = useState<FeedbackVisibility>("anonymised");
  const [message, setMessage] = useState("");
  const { busy, run } = useAction();
  const subject = about === "me" ? selfId : subjectId;
  const today = toISODate(new Date());
  const valid = Boolean(subject) && reviewers.length > 0 && Boolean(due);

  const add = (employee: EmployeeSummary | null) => {
    if (!employee) return;
    if (employee.id === subject) return;
    setReviewers((current) =>
      current.some((r) => r.id === employee.id) || current.length >= MAX_REVIEWERS ? current : [...current, employee],
    );
    setPicked(null);
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ask for feedback</DialogTitle>
          <DialogDescription>
            Up to {MAX_REVIEWERS} colleagues. They are told who will read their answers before they write.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {canAskForOthers && (
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField htmlFor="ask-about" label="About">
                <Select value={about} onValueChange={setAbout}>
                  <SelectTrigger id="ask-about" className="w-full">
                    <SelectValue placeholder="Choose" />
                  </SelectTrigger>
                  <SelectContent>
                    {selfId && <SelectItem value="me">Me</SelectItem>}
                    <SelectItem value="other">Someone in my team</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              {about === "other" && (
                <FormField htmlFor="ask-subject" label="Person" error={people.error?.detail}>
                  <PersonSelect id="ask-subject" people={people.data ?? []} value={subjectId} onChange={setSubjectId} />
                </FormField>
              )}
            </div>
          )}
          <FormField
            htmlFor="ask-reviewer"
            label={`Colleagues to ask (${reviewers.length} of ${MAX_REVIEWERS})`}
            hint="Search and pick one at a time."
          >
            {reviewers.length < MAX_REVIEWERS && (
              <EmployeePicker id="ask-reviewer" value={picked} onChange={add} excludeId={subject ?? null} />
            )}
          </FormField>
          {reviewers.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {reviewers.map((r) => (
                <li key={r.id}>
                  <Badge variant="outline" className="gap-1 py-1 pl-2">
                    {employeeDisplayName(r)}
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="size-5"
                      aria-label={`Remove ${employeeDisplayName(r)}`}
                      onClick={() => setReviewers((current) => current.filter((x) => x.id !== r.id))}
                    >
                      <X />
                    </Button>
                  </Badge>
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField htmlFor="ask-due" label="Answer by">
              <DatePicker id="ask-due" value={due} onChange={setDue} min={today} />
            </FormField>
            <FormField htmlFor="ask-cycle" label="For a review" optional hint="Uses that cycle's competencies as questions.">
              <Select value={cycleId} onValueChange={setCycleId}>
                <SelectTrigger id="ask-cycle" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No — strengths and improvements only</SelectItem>
                  {(cycles.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <FormField htmlFor="ask-visibility" label="Who reads the answers">
            <Select value={visibility} onValueChange={(v) => setVisibility(v as FeedbackVisibility)}>
              <SelectTrigger id="ask-visibility" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(VISIBILITY_LABEL) as FeedbackVisibility[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {VISIBILITY_LABEL[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField htmlFor="ask-message" label="Context for them" optional>
            <Textarea id="ask-message" rows={3} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!valid || busy !== null}
            onClick={async () => {
              const r = await run(
                "ask",
                () =>
                  post("/feedback/requests", {
                    subject_employee_id: about === "me" ? null : subjectId,
                    reviewer_employee_ids: reviewers.map((x) => x.id),
                    appraisal_cycle_id: cycleId === NONE ? null : cycleId,
                    due_on: due,
                    employee_visibility: visibility,
                    message: message.trim() || null,
                  }),
                `Asked ${reviewers.length} colleague(s).`,
              );
              if (r !== undefined) onDone();
            }}
          >
            {busy ? <Loader2 className="animate-spin" /> : <UserRoundSearch />} Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
