"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, Award, Loader2, Lock, Plus, Scale, Unlock } from "lucide-react";
import React, { useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataTable } from "@/components/common/data-table/DataTable";
import { ErrorState } from "@/components/common/ErrorState";
import { FormField } from "@/components/common/FormField";
import { PageShell } from "@/components/common/PageShell";
import { PersonCell } from "@/components/common/PersonCell";
import { RequireRole } from "@/components/common/RequireRole";
import { EvidenceList, GoalScorePanel, PersonSelect, StatusBadge, humanize, useAction, usePeople } from "@/components/performance/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { HR } from "@/lib/access";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type {
  CalibrationChange,
  CalibrationRow,
  CalibrationScope,
  CalibrationSession,
  CalibrationWorkspace,
  CycleSummary,
  PersonEvidence,
} from "@/lib/types/performance";
import { formatDate } from "@/lib/utils";

export default function CalibrationPage() {
  const sessions = useApiQuery<CalibrationSession[]>("/calibration/sessions");
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  if (open) {
    return (
      <PageShell title="Calibration" description="A live session: ratings, the distribution against target, and the evidence behind each person.">
        <div>
          <Button variant="ghost" onClick={() => { setOpen(null); sessions.reload(); }}>
            ← All sessions
          </Button>
        </div>
        <Workspace sessionId={open} />
      </PageShell>
    );
  }

  const columns: ColumnDef<CalibrationSession>[] = [
    { accessorKey: "name", header: "Session", meta: { cellClassName: "font-medium" } },
    {
      accessorKey: "cycle_name",
      header: "Cycle",
      cell: ({ row }) => row.original.cycle_name ?? "—",
    },
    {
      accessorKey: "scope",
      header: "Scope",
      meta: { text: (s) => humanize(s.scope) },
      cell: ({ row }) => humanize(row.original.scope),
    },
    { id: "facilitator", header: "Facilitator", accessorFn: (s) => s.facilitator_name ?? "HR" },
    {
      accessorKey: "status",
      header: "Status",
      meta: { text: (s) => `${humanize(s.status)}${s.locked_at ? " · Locked" : ""}` },
      cell: ({ row }) => (
        <>
          <StatusBadge status={row.original.status} />
          {row.original.locked_at && <Badge variant="outline" className="ml-2">Locked</Badge>}
        </>
      ),
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
    <PageShell
      title="Calibration"
      description="Sessions you facilitate or take part in. Every rating change needs a reason and names who made it."
      actions={
        <RequireRole roles={HR}>
          <Button variant="accent" onClick={() => setCreating(true)}>
            <Plus /> New session
          </Button>
        </RequireRole>
      }
    >
      <DataTable
        title="Sessions"
        columns={columns}
        data={sessions.data ?? []}
        noun="sessions"
        exportName="calibration-sessions"
        searchPlaceholder="Search sessions"
        isLoading={sessions.isLoading && !sessions.data}
        error={sessions.error?.detail}
        onRetry={sessions.reload}
        empty={{ icon: Scale, title: "No calibration sessions", description: "Sessions you are invited to appear here. HR sets them up." }}
      />
      {creating && <NewSessionDialog onClose={() => setCreating(false)} onDone={() => { setCreating(false); sessions.reload(); }} />}
    </PageShell>
  );
}

function NewSessionDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const cycles = useApiQuery<CycleSummary[]>("/appraisal/cycles");
  const people = usePeople();
  const [cycleId, setCycleId] = useState("");
  const [name, setName] = useState("");
  const [scope, setScope] = useState<CalibrationScope>("department");
  const [scopeValue, setScopeValue] = useState("");
  const [facilitator, setFacilitator] = useState("");
  const [participants, setParticipants] = useState<string[]>([]);
  const { busy, run } = useAction();
  const list = useMemo(() => people.data ?? [], [people.data]);
  const departments = useMemo(() => {
    const map = new Map<string, string>();
    list.forEach((p) => p.department_id && map.set(p.department_id, p.department ?? p.department_id));
    return [...map.entries()];
  }, [list]);
  const managers = list.filter((p) => list.some((q) => q.manager_id === p.employee_id));
  const grades = [...new Set(list.map((p) => p.grade).filter(Boolean))] as string[];
  const effectiveScope = scope === "company" ? "company" : scopeValue;
  const valid = cycleId && name.trim() && effectiveScope;
  const withLogin = list.filter((p) => p.user_id);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New calibration session</DialogTitle>
          <DialogDescription>The facilitator changes ratings; participants can see the room. Nobody calibrates their own rating.</DialogDescription>
        </DialogHeader>
        <FormField htmlFor="cs-cycle" label="Cycle">
          <Select value={cycleId} onValueChange={setCycleId}>
            <SelectTrigger id="cs-cycle" className="w-full">
              <SelectValue placeholder="Choose a cycle" />
            </SelectTrigger>
            <SelectContent>
              {(cycles.data ?? []).filter((c) => c.status === "active" || c.status === "in_calibration").map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField htmlFor="cs-name" label="Name">
          <Input id="cs-name" maxLength={255} value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField htmlFor="cs-scope" label="Covers">
            <Select value={scope} onValueChange={(v) => { setScope(v as CalibrationScope); setScopeValue(""); }}>
              <SelectTrigger id="cs-scope" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="company">The whole company</SelectItem>
                <SelectItem value="department">A department</SelectItem>
                <SelectItem value="manager">A manager&apos;s team</SelectItem>
                <SelectItem value="grade">A grade</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          {scope !== "company" && (
            <FormField htmlFor="cs-value" label={humanize(scope)}>
              <Select value={scopeValue} onValueChange={setScopeValue}>
                <SelectTrigger id="cs-value" className="w-full">
                  <SelectValue placeholder="Choose" />
                </SelectTrigger>
                <SelectContent>
                  {scope === "department" && departments.map(([id, label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}
                  {scope === "manager" && managers.map((m) => <SelectItem key={m.employee_id} value={m.employee_id}>{m.name}</SelectItem>)}
                  {scope === "grade" && grades.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
          )}
        </div>
        <FormField htmlFor="cs-fac" label="Facilitator" optional hint="Without one, only HR changes ratings.">
          <PersonSelect id="cs-fac" people={list} value={facilitator} onChange={setFacilitator} withLoginOnly valueKey="user_id" excludeSelf={false} />
        </FormField>
        <div className="space-y-1">
          <p className="text-sm font-medium">Participants</p>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2">
            {withLogin.map((p) => (
              <div key={p.employee_id} className="flex items-center gap-2">
                <Checkbox
                  id={`pp-${p.employee_id}`}
                  checked={participants.includes(p.user_id!)}
                  onCheckedChange={(v) => setParticipants((c) => (v === true ? [...c, p.user_id!] : c.filter((x) => x !== p.user_id)))}
                />
                <Label htmlFor={`pp-${p.employee_id}`} className="font-normal">
                  {p.name} <span className="text-muted-foreground">· {p.designation ?? p.employee_code}</span>
                </Label>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!valid || busy !== null}
            onClick={async () => {
              const r = await run(
                "save",
                () =>
                  post("/calibration/sessions", {
                    cycle_id: cycleId,
                    name: name.trim(),
                    scope,
                    scope_value: effectiveScope,
                    facilitator_user_id: facilitator || null,
                    participant_user_ids: participants,
                  }),
                "Session created.",
              );
              if (r !== undefined) onDone();
            }}
          >
            {busy && <Loader2 className="animate-spin" />} Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Workspace({ sessionId }: { sessionId: string }) {
  const { data, error, isLoading, reload } = useApiQuery<CalibrationWorkspace>(`/calibration/sessions/${sessionId}/workspace`);
  const changes = useApiQuery<CalibrationChange[]>(`/calibration/sessions/${sessionId}/changes`);
  const [changing, setChanging] = useState<CalibrationRow | null>(null);
  const [evidence, setEvidence] = useState<CalibrationRow | null>(null);
  const [confirm, setConfirm] = useState<"lock" | "reopen" | null>(null);
  const [reason, setReason] = useState("");
  const { run } = useAction();
  const refresh = () => {
    reload();
    changes.reload();
  };

  if (isLoading && !data) return <Skeleton className="h-96 w-full" />;
  if (error) return <ErrorState message={error.detail} onRetry={reload} />;
  if (!data) return null;
  const { session, viewer, distribution } = data;
  const names = Object.fromEntries(data.grid.map((r) => [r.appraisal_id, r.name]));

  const gridColumns: ColumnDef<CalibrationRow>[] = [
    {
      accessorKey: "name",
      header: "Person",
      meta: {
        text: (row) =>
          [row.name, row.employee_code, row.manager_name ? `reports to ${row.manager_name}` : null]
            .filter(Boolean)
            .join(" · "),
      },
      cell: ({ row }) => (
        <PersonCell
          name={row.original.name}
          subtitle={row.original.manager_name ? `reports to ${row.original.manager_name}` : row.original.employee_code}
          size="sm"
        />
      ),
    },
    {
      accessorKey: "grade",
      header: "Grade",
      cell: ({ row }) => row.original.grade ?? "—",
    },
    {
      accessorKey: "tenure_months",
      header: "Tenure",
      meta: { className: "text-right tabular-nums" },
      cell: ({ row }) => (row.original.tenure_months !== null ? `${row.original.tenure_months} mo` : "—"),
    },
    {
      accessorKey: "goal_score",
      header: "Goal score",
      sortingFn: "alphanumeric",
      meta: { className: "text-right tabular-nums" },
      cell: ({ row }) => row.original.goal_score ?? "—",
    },
    {
      accessorKey: "current_score",
      header: "Score",
      sortingFn: "alphanumeric",
      meta: { className: "text-right tabular-nums" },
      cell: ({ row }) => row.original.current_score ?? "—",
    },
    {
      accessorKey: "peer_median_score",
      header: "Peer median",
      sortingFn: "alphanumeric",
      meta: {
        className: "text-right tabular-nums",
        text: (row) => `${row.peer_median_score ?? "—"}${row.peer_count > 0 ? ` (${row.peer_count})` : ""}`,
      },
      cell: ({ row }) => (
        <>
          {row.original.peer_median_score ?? "—"}
          {row.original.peer_count > 0 && <span className="text-xs text-muted-foreground"> ({row.original.peer_count})</span>}
        </>
      ),
    },
    {
      accessorKey: "current_rating",
      header: "Rating",
      meta: { text: (row) => row.current_rating ?? "Not rated" },
      cell: ({ row }) => row.original.current_rating ?? <span className="text-muted-foreground">Not rated</span>,
    },
    {
      accessorKey: "recognition_count",
      header: "Recognition",
      meta: { className: "text-right tabular-nums" },
      cell: ({ row }) => (
        <>
          <Award className="mr-1 inline size-3.5 text-brand-600" />
          {row.original.recognition_count}
        </>
      ),
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      meta: { className: "text-right", text: false },
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => setEvidence(row.original)}>
            Evidence
          </Button>
          {viewer.can_change && !row.original.is_self && (
            <Button size="sm" variant="outline" onClick={() => setChanging(row.original)}>
              Change
            </Button>
          )}
        </div>
      ),
    },
  ];

  const changeColumns: ColumnDef<CalibrationChange>[] = [
    {
      accessorKey: "changed_at",
      header: "When",
      meta: { text: (c) => formatDate(c.changed_at) },
      cell: ({ row }) => formatDate(row.original.changed_at),
    },
    { id: "person", header: "Person", accessorFn: (c) => names[c.appraisal_id] ?? "—" },
    {
      id: "from_to",
      header: "From → to",
      accessorFn: (c) => c.new_rating,
      meta: {
        text: (c) => `${c.previous_rating ?? "—"} → ${c.new_rating}${c.new_score ? ` (${c.new_score})` : ""}`,
      },
      cell: ({ row }) => (
        <>
          {row.original.previous_rating ?? "—"} → <span className="font-medium">{row.original.new_rating}</span>
          {row.original.new_score && <span className="text-xs text-muted-foreground"> ({row.original.new_score})</span>}
        </>
      ),
    },
    { accessorKey: "justification", header: "Justification", meta: { cellClassName: "max-w-md whitespace-normal" } },
    {
      accessorKey: "applied_on_lock",
      header: "Applied",
      meta: { text: (c) => (c.applied_on_lock ? "Written back" : "—") },
      cell: ({ row }) => (row.original.applied_on_lock ? <Badge variant="success">Written back</Badge> : "—"),
    },
  ];

  return (
    <div className="space-y-4">
      <Card tier="tier1">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {session.name} <StatusBadge status={session.status} />
            {session.locked_at && <Badge variant="outline">Locked {formatDate(session.locked_at)}</Badge>}
          </CardTitle>
          <CardDescription>
            {session.cycle_name} · {humanize(session.scope)} · mode {humanize(data.mode)}
            {data.min_group_size !== null && ` · groups under ${data.min_group_size} are not enforced`}
          </CardDescription>
          <CardAction className="flex gap-2">
            {viewer.can_lock && (
              <Button onClick={() => setConfirm("lock")}>
                <Lock /> Lock and write back
              </Button>
            )}
            {viewer.can_reopen && (
              <Button variant="outline" onClick={() => setConfirm("reopen")}>
                <Unlock /> Reopen
              </Button>
            )}
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-3">
          {distribution.is_excluded_as_small && (
            <Alert>
              <AlertTriangle />
              <AlertDescription>{distribution.exclusion_reason}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {distribution.counts.map((c) => (
              <div key={c.rating} className="rounded-lg border border-border p-3">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{c.rating}</span>
                  <span className="tabular-nums">{c.count}</span>
                </div>
                <Progress value={Number(c.actual_percent)} className="mt-2 h-1.5" aria-label={`${c.rating} share`} />
                <p className={c.is_within_tolerance ? "mt-1 text-xs text-muted-foreground" : "mt-1 text-xs text-destructive"}>
                  {c.actual_percent}%{c.target_percent !== null ? ` · target ${c.target_percent}% (${c.lower_bound}–${c.upper_bound})` : " · no target"}
                </p>
              </div>
            ))}
          </div>
          {distribution.notes.map((n) => (
            <p key={n} className="text-xs text-muted-foreground">
              {n}
            </p>
          ))}
        </CardContent>
      </Card>

      {data.outliers.some((o) => o.classification === "lenient" || o.classification === "severe") && (
        <Alert>
          <AlertTitle>Managers whose ratings sit away from their peers</AlertTitle>
          <AlertDescription>
            {data.outliers
              .filter((o) => o.classification === "lenient" || o.classification === "severe")
              .map((o) => (
                <span key={o.manager_id} className="block">
                  {o.manager_name} ({humanize(o.classification)}): {o.reason}
                </span>
              ))}
          </AlertDescription>
        </Alert>
      )}

      <DataTable
        title="People in scope"
        description="Peer median is the score of others at the same grade in this session."
        columns={gridColumns}
        data={data.grid}
        getRowId={(row) => row.appraisal_id}
        noun="people"
        exportName="calibration-people"
        searchPlaceholder="Search people"
        empty={{ icon: Scale, title: "Nobody in this session's scope has a review" }}
      />

      <DataTable
        title="Changes in this session"
        description="Every change, who made it and why. The last change for a person is what locking writes back."
        columns={changeColumns}
        data={changes.data ?? []}
        noun="changes"
        exportName="calibration-changes"
        searchPlaceholder="Search changes"
        isLoading={changes.isLoading && !changes.data}
        error={changes.error?.detail}
        empty={{ icon: Scale, title: "No ratings changed yet" }}
      />

      {changing && (
        <ChangeDialog sessionId={session.id} row={changing} options={data.rating_options} onClose={() => setChanging(null)} onDone={() => { setChanging(null); refresh(); }} />
      )}

      <Sheet open={evidence !== null} onOpenChange={(v) => !v && setEvidence(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{evidence?.name}</SheetTitle>
            <SheetDescription>Goals, recognition and what each review step said. Evidence to weigh, not a score.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">{evidence && <EvidencePanel sessionId={session.id} appraisalId={evidence.appraisal_id} />}</div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirm === "lock"}
        onOpenChange={(v) => !v && setConfirm(null)}
        title="Lock this session?"
        description="The agreed ratings are written back to each review, together with the record of every change."
        confirmLabel="Lock"
        onConfirm={async () => {
          const r = await run("lock", () => post(`/calibration/sessions/${session.id}/lock`), "Session locked; ratings written back.");
          if (r === undefined) throw new Error("failed");
          refresh();
        }}
      />
      <ConfirmDialog
        open={confirm === "reopen"}
        onOpenChange={(v) => !v && setConfirm(null)}
        title="Reopen this locked session?"
        description="The earlier lock stays in the audit trail. Ratings already written back stay until the session locks again."
        confirmLabel="Reopen"
        destructive
        onConfirm={async () => {
          if (!reason.trim()) throw new Error("reason required");
          const r = await run("reopen", () => post(`/calibration/sessions/${session.id}/reopen`, { reason: reason.trim() }), "Session reopened.");
          if (r === undefined) throw new Error("failed");
          setReason("");
          refresh();
        }}
      >
        <FormField htmlFor="rs-reason" label="Reason">
          <Input id="rs-reason" maxLength={4000} value={reason} onChange={(e) => setReason(e.target.value)} />
        </FormField>
      </ConfirmDialog>
    </div>
  );
}

function ChangeDialog({
  sessionId,
  row,
  options,
  onClose,
  onDone,
}: {
  sessionId: string;
  row: CalibrationRow;
  options: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [rating, setRating] = useState(row.current_rating ?? "");
  const [score, setScore] = useState("");
  const [justification, setJustification] = useState("");
  const { busy, run } = useAction();
  const scoreOk = !score || /^\d{1,3}(\.\d{1,2})?$/.test(score);
  const valid = rating && rating !== row.current_rating && justification.trim() && scoreOk;
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change {row.name}&apos;s rating</DialogTitle>
          <DialogDescription>Currently {row.current_rating ?? "not rated"}. The justification is permanent and names you.</DialogDescription>
        </DialogHeader>
        <FormField htmlFor="ch-rating" label="New rating">
          <Select value={rating} onValueChange={setRating}>
            <SelectTrigger id="ch-rating" className="w-full">
              <SelectValue placeholder="Choose" />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField htmlFor="ch-score" label="New score" optional hint="Out of 100. Leave empty to keep the computed score.">
          <Input id="ch-score" inputMode="decimal" value={score} onChange={(e) => setScore(e.target.value)} />
        </FormField>
        <FormField htmlFor="ch-just" label="Justification">
          <Textarea id="ch-just" rows={4} maxLength={4000} value={justification} onChange={(e) => setJustification(e.target.value)} />
        </FormField>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!valid || busy !== null}
            onClick={async () => {
              const r = await run(
                "save",
                () =>
                  post(`/calibration/sessions/${sessionId}/changes`, {
                    appraisal_id: row.appraisal_id,
                    new_rating: rating,
                    new_score: score || null,
                    justification: justification.trim(),
                  }),
                "Change recorded.",
              );
              if (r !== undefined) onDone();
            }}
          >
            {busy && <Loader2 className="animate-spin" />} Record change
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EvidencePanel({ sessionId, appraisalId }: { sessionId: string; appraisalId: string }) {
  const { data, error, isLoading } = useApiQuery<PersonEvidence>(`/calibration/sessions/${sessionId}/evidence/${appraisalId}`);
  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (error) return <ErrorState message={error.detail} />;
  if (!data) return null;
  return (
    <div className="space-y-5">
      <GoalScorePanel goals={data.goals} />
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Recognition by value</h3>
        {data.recognition.values.length === 0 ? (
          <p className="text-sm text-muted-foreground">No company values are configured.</p>
        ) : (
          data.recognition.values.map((v) => (
            <div key={v.code} className="space-y-1">
              <p className="text-sm font-medium">{v.name}</p>
              <EvidenceList evidence={v.evidence} />
            </div>
          ))
        )}
      </section>
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">What the review steps said</h3>
        {data.entries.length === 0 && <p className="text-sm text-muted-foreground">Nothing submitted yet.</p>}
        {data.entries.map((e, i) => (
          <div key={i} className="rounded-md border border-border p-2 text-sm">
            <p className="text-xs text-muted-foreground">
              {e.stage_label} {e.score && `· score ${e.score}`}
            </p>
            {e.returned_reason && <p>Returned: {e.returned_reason}</p>}
            {e.comments && <p className="whitespace-pre-line">{e.comments}</p>}
          </div>
        ))}
      </section>
      {data.calibration_history.length > 0 && (
        <section className="space-y-1">
          <h3 className="text-sm font-semibold">Calibration history</h3>
          {data.calibration_history.map((c) => (
            <p key={c.changed_at} className="text-sm">
              {formatDate(c.changed_at)}: {c.from ?? "—"} → {c.to} — {c.justification}
            </p>
          ))}
        </section>
      )}
    </div>
  );
}
