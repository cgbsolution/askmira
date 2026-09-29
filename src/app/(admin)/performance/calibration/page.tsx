"use client";

import { AlertTriangle, Award, Loader2, Lock, Plus, Scale, Unlock } from "lucide-react";
import React, { useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataPanel } from "@/components/common/DataPanel";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
      <DataPanel
        title="Sessions"
        isLoading={sessions.isLoading}
        error={sessions.error?.detail}
        onRetry={sessions.reload}
        isEmpty={(sessions.data ?? []).length === 0}
        empty={{ icon: Scale, title: "No calibration sessions", description: "Sessions you are invited to appear here. HR sets them up." }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Session</TableHead>
              <TableHead>Cycle</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Facilitator</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.data?.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{s.cycle_name ?? "—"}</TableCell>
                <TableCell>{humanize(s.scope)}</TableCell>
                <TableCell>{s.facilitator_name ?? "HR"}</TableCell>
                <TableCell>
                  <StatusBadge status={s.status} />
                  {s.locked_at && <Badge variant="outline" className="ml-2">Locked</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => setOpen(s.id)}>
                    Open
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>
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
  const list = people.data ?? [];
  const departments = useMemo(() => {
    const map = new Map<string, string>();
    list.forEach((p) => p.department_id && map.set(p.department_id, p.department ?? p.department_id));
    return [...map.entries()];
  }, [list]);
  const managers = list.filter((p) => p.role === "manager" || list.some((q) => q.manager_id === p.employee_id));
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

      <DataPanel
        title="People in scope"
        description="Peer median is the score of others at the same grade in this session."
        isEmpty={data.grid.length === 0}
        empty={{ icon: Scale, title: "Nobody in this session's scope has a review" }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Person</TableHead>
              <TableHead>Grade</TableHead>
              <TableHead className="text-right">Tenure</TableHead>
              <TableHead className="text-right">Goal score</TableHead>
              <TableHead className="text-right">Score</TableHead>
              <TableHead className="text-right">Peer median</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead className="text-right">Recognition</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.grid.map((row) => (
              <TableRow key={row.appraisal_id}>
                <TableCell>
                  <PersonCell name={row.name} subtitle={row.manager_name ? `reports to ${row.manager_name}` : row.employee_code} size="sm" />
                </TableCell>
                <TableCell>{row.grade ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{row.tenure_months !== null ? `${row.tenure_months} mo` : "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{row.goal_score ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{row.current_score ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.peer_median_score ?? "—"}
                  {row.peer_count > 0 && <span className="text-xs text-muted-foreground"> ({row.peer_count})</span>}
                </TableCell>
                <TableCell>{row.current_rating ?? <span className="text-muted-foreground">Not rated</span>}</TableCell>
                <TableCell className="text-right tabular-nums">
                  <Award className="mr-1 inline size-3.5 text-brand-600" />
                  {row.recognition_count}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEvidence(row)}>
                      Evidence
                    </Button>
                    {viewer.can_change && !row.is_self && (
                      <Button size="sm" variant="outline" onClick={() => setChanging(row)}>
                        Change
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>

      <DataPanel
        title="Changes in this session"
        description="Every change, who made it and why. The last change for a person is what locking writes back."
        isLoading={changes.isLoading}
        error={changes.error?.detail}
        isEmpty={(changes.data ?? []).length === 0}
        empty={{ icon: Scale, title: "No ratings changed yet" }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Person</TableHead>
              <TableHead>From → to</TableHead>
              <TableHead>Justification</TableHead>
              <TableHead>Applied</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {changes.data?.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{formatDate(c.changed_at)}</TableCell>
                <TableCell>{names[c.appraisal_id] ?? "—"}</TableCell>
                <TableCell>
                  {c.previous_rating ?? "—"} → <span className="font-medium">{c.new_rating}</span>
                  {c.new_score && <span className="text-xs text-muted-foreground"> ({c.new_score})</span>}
                </TableCell>
                <TableCell className="max-w-md whitespace-normal">{c.justification}</TableCell>
                <TableCell>{c.applied_on_lock ? <Badge variant="success">Written back</Badge> : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>

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
