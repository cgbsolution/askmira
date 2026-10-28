"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { CalendarRange, Copy, Loader2, Lock, Play, Plus, RefreshCw, Rocket, UserRoundCheck } from "lucide-react";
import React, { useState } from "react";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataPanel } from "@/components/common/DataPanel";
import { DataTable } from "@/components/common/data-table/DataTable";
import { ErrorState } from "@/components/common/ErrorState";
import { FormField } from "@/components/common/FormField";
import { PageShell } from "@/components/common/PageShell";
import { PolicyCard, RulesCard, StagesCard, StagesEditor, TemplateCard, stagesValid } from "@/components/performance/CycleSetup";
import { StatusBadge, errorText, humanize, useAction } from "@/components/performance/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { CycleDetail, CycleSummary, CycleType, Distribution, ProbationOutcome, ProbationReview, StageInput } from "@/lib/types/performance";
import { formatDate, formatDateRange, formatDay } from "@/lib/utils";
import { DatePicker } from "@/components/common/DatePicker";

const TYPES: CycleType[] = ["annual", "half_yearly", "quarterly", "probation", "off_cycle"];
const DEFAULT_STAGES: StageInput[] = [
  { sequence: 1, role: "self", label: "Self review", is_mandatory: true, sees_previous_entries: true, visible_to_employee_before_release: true },
  { sequence: 2, role: "manager", label: "Manager review", is_mandatory: true, sees_previous_entries: true, visible_to_employee_before_release: false },
  { sequence: 3, role: "reviewer", label: "Reviewer sign-off", is_mandatory: false, sees_previous_entries: true, visible_to_employee_before_release: false },
  { sequence: 4, role: "hr", label: "HR sign-off", is_mandatory: true, sees_previous_entries: true, visible_to_employee_before_release: false },
];

export default function CyclesPage() {
  const { data, error, isLoading, reload } = useApiQuery<CycleSummary[]>("/appraisal/cycles");
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const columns: ColumnDef<CycleSummary>[] = [
    {
      accessorKey: "name",
      header: "Cycle",
      meta: { cellClassName: "font-medium", text: (c) => `${c.name}${!c.has_template ? " (no scoring)" : ""}` },
      cell: ({ row }) => (
        <>
          {row.original.name}
          {!row.original.has_template && <span className="ml-2 text-xs text-muted-foreground">no scoring</span>}
        </>
      ),
    },
    {
      accessorKey: "cycle_type",
      header: "Type",
      meta: { text: (c) => humanize(c.cycle_type) },
      cell: ({ row }) => humanize(row.original.cycle_type),
    },
    {
      id: "period",
      header: "Period",
      accessorFn: (c) => c.period_start,
      meta: { text: (c) => formatDateRange(c.period_start, c.period_end) },
      cell: ({ row }) => formatDateRange(row.original.period_start, row.original.period_end),
    },
    {
      accessorKey: "status",
      header: "Status",
      meta: { text: (c) => humanize(c.status) },
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "complete",
      header: "Complete",
      accessorFn: (c) => c.completed,
      meta: { className: "text-right tabular-nums", text: (c) => `${c.completed} / ${c.appraisals}` },
      cell: ({ row }) => (
        <>
          {row.original.completed} / {row.original.appraisals}
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
      title="Review cycles"
      description="Configure, launch, run and close review cycles, and keep probation reviews on each person's own clock."
      actions={
        <Button variant="accent" onClick={() => setCreating(true)}>
          <Plus /> New cycle
        </Button>
      }
    >
      <Tabs defaultValue="cycles">
        <TabsList>
          <TabsTrigger value="cycles">Cycles</TabsTrigger>
          <TabsTrigger value="probation">Probation reviews</TabsTrigger>
        </TabsList>
        <TabsContent value="cycles" className="mt-4">
          <DataTable
            title="Cycles"
            actions={<SweepButton onDone={reload} />}
            columns={columns}
            data={data ?? []}
            noun="cycles"
            exportName="review-cycles"
            searchPlaceholder="Search cycles"
            isLoading={isLoading && !data}
            error={error?.detail}
            onRetry={reload}
            empty={{ icon: CalendarRange, title: "No review cycles yet", description: "Create a cycle, set its scoring and rules, then launch it." }}
          />
        </TabsContent>
        <TabsContent value="probation" className="mt-4">
          <ProbationPanel />
        </TabsContent>
      </Tabs>

      <Sheet open={open !== null} onOpenChange={(v) => !v && setOpen(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-4xl">
          <SheetHeader>
            <SheetTitle>Cycle configuration</SheetTitle>
            <SheetDescription>Scoring, rules and policy can change only while the cycle is a draft.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">{open && <CyclePanel cycleId={open} onChanged={reload} onCloned={(id) => { reload(); setOpen(id); }} />}</div>
        </SheetContent>
      </Sheet>

      {creating && (
        <NewCycleDialog
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            reload();
            setOpen(id);
          }}
        />
      )}
    </PageShell>
  );
}

function SweepButton({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const { run } = useAction();
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <RefreshCw /> Run daily sweep
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Run the daily sweep now?"
        description="For every running cycle: applies closed-window auto-advance, escalates overdue steps and reminds owners of steps due in 3 days, 1 day or today; then schedules probation reviews due in the next 30 days. There is no scheduler yet, so this is how it runs."
        confirmLabel="Run sweep"
        onConfirm={async () => {
          const r = await run("sweep", () => post("/appraisal/sweep"), "Sweep complete.");
          if (r === undefined) throw new Error("failed");
          onDone();
        }}
      />
    </>
  );
}

function NewCycleDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<CycleType>("annual");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [escalation, setEscalation] = useState("7");
  const [grades, setGrades] = useState("");
  const [minService, setMinService] = useState("");
  const [stages, setStages] = useState<StageInput[]>(DEFAULT_STAGES);
  const { busy, run } = useAction();
  const valid = name.trim() && start && end && end >= start && /^\d+$/.test(escalation) && stagesValid(stages);
  const eligibility: Record<string, unknown> = {};
  const gradeList = grades.split(",").map((g) => g.trim()).filter(Boolean);
  if (gradeList.length) eligibility.grades = gradeList;
  if (minService) eligibility.min_service_months = Number(minService);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New review cycle</DialogTitle>
          <DialogDescription>Created as a draft. Nobody sees it until you launch it.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField htmlFor="c-name" label="Name">
              <Input id="c-name" maxLength={255} value={name} onChange={(e) => setName(e.target.value)} />
            </FormField>
            <FormField htmlFor="c-type" label="Type">
              <Select value={type} onValueChange={(v) => setType(v as CycleType)}>
                <SelectTrigger id="c-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {humanize(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField htmlFor="c-start" label="Period starts">
              <DatePicker id="c-start" value={start} onChange={setStart} />
            </FormField>
            <FormField htmlFor="c-end" label="Period ends">
              <DatePicker id="c-end" min={start} value={end} onChange={setEnd} />
            </FormField>
            <FormField htmlFor="c-esc" label="Escalate after (days overdue)">
              <Input id="c-esc" type="number" min={1} max={90} value={escalation} onChange={(e) => setEscalation(e.target.value)} />
            </FormField>
            <FormField htmlFor="c-min" label="Minimum service (months)" optional>
              <Input id="c-min" type="number" min={0} value={minService} onChange={(e) => setMinService(e.target.value)} />
            </FormField>
            <FormField htmlFor="c-grades" label="Only these grades" optional hint="Comma-separated. Empty means everyone." className="sm:col-span-2">
              <Input id="c-grades" value={grades} onChange={(e) => setGrades(e.target.value)} />
            </FormField>
          </div>
          <p className="text-sm font-medium">Stages</p>
          <StagesEditor stages={stages} onChange={setStages} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!valid || busy !== null}
            onClick={async () => {
              const r = await run<{ id: string }>(
                "save",
                () =>
                  post<{ id: string }>("/appraisal/cycles", {
                    name: name.trim(),
                    cycle_type: type,
                    period_start: start,
                    period_end: end,
                    escalation_after_days: Number(escalation),
                    eligibility_rule: eligibility,
                    stages: stages.map((s) => ({ ...s, label: s.label.trim() })),
                  }),
                "Cycle created as a draft.",
              );
              if (r) onCreated(r.id);
            }}
          >
            {busy && <Loader2 className="animate-spin" />} Create draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CyclePanel({ cycleId, onChanged, onCloned }: { cycleId: string; onChanged: () => void; onCloned: (id: string) => void }) {
  const { data, error, isLoading, reload } = useApiQuery<CycleDetail>(`/appraisal/cycles/${cycleId}`);
  const changed = () => {
    reload();
    onChanged();
  };
  if (isLoading && !data) return <Skeleton className="h-64 w-full" />;
  if (error) return <ErrorState message={error.detail} onRetry={reload} />;
  if (!data?.cycle) return null;
  return (
    <div className="space-y-4">
      <Card tier="tier1">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {data.cycle.name} <StatusBadge status={data.cycle.status} />
          </CardTitle>
          <CardDescription>
            {humanize(data.cycle.cycle_type)} · {formatDateRange(data.cycle.period_start, data.cycle.period_end)} · escalates{" "}
            {data.cycle.escalation_after_days} days after a due date
            {data.cycle.launched_at && ` · launched ${formatDate(data.cycle.launched_at)}`}
            {data.cycle.closed_at && ` · closed ${formatDate(data.cycle.closed_at)}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CycleActions detail={data} onChanged={changed} onCloned={onCloned} />
        </CardContent>
      </Card>
      <StagesCard detail={data} onChanged={changed} />
      <TemplateCard detail={data} onChanged={changed} />
      <RulesCard detail={data} onChanged={changed} />
      <PolicyCard detail={data} onChanged={changed} />
      {data.policy && data.cycle.status !== "draft" && <DistributionCard cycleId={cycleId} />}
    </div>
  );
}

interface LaunchResult {
  included: number;
  excluded: { employee_code: string; reason: string }[];
  conflicts: { employee_code: string; reason: string }[];
}

function CycleActions({ detail, onChanged, onCloned }: { detail: CycleDetail; onChanged: () => void; onCloned: (id: string) => void }) {
  const cycle = detail.cycle!;
  const { busy, run } = useAction();
  const [confirm, setConfirm] = useState<"launch" | "advance" | null>(null);
  const [closing, setClosing] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [launched, setLaunched] = useState<LaunchResult | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {cycle.status === "draft" && (
          <Button variant="accent" onClick={() => setConfirm("launch")}>
            <Rocket /> Launch
          </Button>
        )}
        {(cycle.status === "active" || cycle.status === "in_calibration") && (
          <>
            <Button variant="outline" onClick={() => setConfirm("advance")}>
              <Play /> Apply closed windows
            </Button>
            <Button variant="outline" onClick={() => setClosing(true)}>
              <Lock /> Close cycle
            </Button>
          </>
        )}
        <Button variant="outline" onClick={() => setCloning(true)}>
          <Copy /> Clone
        </Button>
      </div>
      {launched && (
        <Alert>
          <AlertTitle>Launched for {launched.included} people</AlertTitle>
          <AlertDescription>
            {launched.excluded.length} excluded
            {launched.excluded.slice(0, 8).map((e) => (
              <span key={e.employee_code} className="block">
                {e.employee_code}: {e.reason}
              </span>
            ))}
            {launched.conflicts.map((c) => (
              <span key={c.employee_code} className="block text-destructive">
                {c.employee_code}: {c.reason}
              </span>
            ))}
          </AlertDescription>
        </Alert>
      )}
      <ConfirmDialog
        open={confirm === "launch"}
        onOpenChange={(v) => !v && setConfirm(null)}
        title={`Launch ${cycle.name}?`}
        description="Every eligible employee gets a review, resolved to a template by the rules. It is refused if anybody resolves to none. The first step's owners are notified."
        confirmLabel="Launch"
        onConfirm={async () => {
          const r = await run<LaunchResult>("launch", () => post<LaunchResult>(`/cycle-config/cycles/${cycle.id}/launch`), "Cycle launched.");
          if (!r) throw new Error("failed");
          setLaunched(r);
          onChanged();
        }}
      />
      <ConfirmDialog
        open={confirm === "advance"}
        onOpenChange={(v) => !v && setConfirm(null)}
        title="Apply closed stage windows?"
        description="Reviews still on a stage whose window has closed escalate, advance with the stage skipped, or hold — as each stage is configured."
        confirmLabel="Apply"
        onConfirm={async () => {
          const r = await run("advance", () => post(`/cycle-config/cycles/${cycle.id}/auto-advance`), "Windows applied.");
          if (r === undefined) throw new Error("failed");
          onChanged();
        }}
      />
      {closing && <CloseDialog cycleId={cycle.id} onClose={() => setClosing(false)} onDone={() => { setClosing(false); onChanged(); }} />}
      {cloning && <CloneDialog cycleId={cycle.id} onClose={() => setCloning(false)} onDone={(id) => { setCloning(false); onCloned(id); }} />}
      {busy && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
    </div>
  );
}

function CloseDialog({ cycleId, onClose, onDone }: { cycleId: string; onClose: () => void; onDone: () => void }) {
  const [acknowledge, setAcknowledge] = useState(false);
  const [release, setRelease] = useState(true);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    setBlocked(null);
    try {
      await post(`/cycle-config/cycles/${cycleId}/close`, { acknowledge_incomplete: acknowledge, release_completed: release });
      onDone();
    } catch (error) {
      setBlocked(
        `${errorText(error, "The cycle could not be closed.")} If calibration is enforced, check the distribution below; unfinished reviews need the second box ticked.`,
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Close the cycle</DialogTitle>
          <DialogDescription>
            Closure is refused while an enforced calibration is out of tolerance. Closed reviews change only through an HR reopen.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-start gap-2">
          <Checkbox id="cc-release" checked={release} onCheckedChange={(v) => setRelease(v === true)} />
          <Label htmlFor="cc-release" className="text-sm font-normal">
            Release every completed review to its employee
          </Label>
        </div>
        <div className="flex items-start gap-2">
          <Checkbox id="cc-ack" checked={acknowledge} onCheckedChange={(v) => setAcknowledge(v === true)} />
          <Label htmlFor="cc-ack" className="text-sm font-normal">
            Close even if some reviews are unfinished (they stay unfinished)
          </Label>
        </div>
        {blocked && (
          <Alert variant="destructive">
            <AlertDescription>{blocked}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={busy} onClick={() => void submit()}>
            {busy && <Loader2 className="animate-spin" />} Close cycle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CloneDialog({ cycleId, onClose, onDone }: { cycleId: string; onClose: () => void; onDone: (id: string) => void }) {
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const { busy, run } = useAction();
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Clone this cycle</DialogTitle>
          <DialogDescription>Stages, rules, scoring and the calibration policy are copied. Dates and reviews are not.</DialogDescription>
        </DialogHeader>
        <FormField htmlFor="cl-name" label="New name">
          <Input id="cl-name" maxLength={255} value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField htmlFor="cl-start" label="Period starts">
            <DatePicker id="cl-start" value={start} onChange={setStart} />
          </FormField>
          <FormField htmlFor="cl-end" label="Period ends">
            <DatePicker id="cl-end" min={start} value={end} onChange={setEnd} />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!name.trim() || !start || !end || end < start || busy !== null}
            onClick={async () => {
              const r = await run<{ cycle_id: string }>(
                "clone",
                () => post<{ cycle_id: string }>(`/cycle-config/cycles/${cycleId}/clone`, { name: name.trim(), period_start: start, period_end: end }),
                "Cycle cloned as a draft.",
              );
              if (r) onDone(r.cycle_id);
            }}
          >
            {busy && <Loader2 className="animate-spin" />} Clone
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DistributionCard({ cycleId }: { cycleId: string }) {
  const { data, error, isLoading, reload } = useApiQuery<Distribution>(`/calibration/cycles/${cycleId}/distribution`);
  return (
    <DataPanel
      title="Distribution against target"
      description={data ? `${humanize(data.mode)}${data.can_close ? " · closure is not blocked" : " · closure is blocked"}` : undefined}
      isLoading={isLoading}
      error={error?.detail}
      onRetry={reload}
      isEmpty={!data || data.distributions.length === 0}
      empty={{ icon: CalendarRange, title: "No ratings yet", description: data?.note ?? "The distribution appears once reviews have ratings." }}
    >
      <div className="space-y-3 p-5">
        {data?.blockers.map((b) => (
          <Alert key={`${b.scope_value}-${b.rating}`} variant="destructive">
            <AlertDescription>{b.message}</AlertDescription>
          </Alert>
        ))}
        {data?.distributions.map((d) => (
          <div key={d.scope_value} className="rounded-lg border border-border p-3 text-sm">
            <p className="font-medium">
              {d.scope} {d.scope_value} · {d.population} rated
            </p>
            {d.is_excluded_as_small && <p className="text-xs text-muted-foreground">{d.exclusion_reason}</p>}
            <p className="mt-1 flex flex-wrap gap-x-4 text-xs tabular-nums">
              {d.counts.map((c) => (
                <span key={c.rating} className={c.is_within_tolerance ? "" : "text-destructive"}>
                  {c.rating}: {c.actual_percent}% {c.target_percent !== null && `(target ${c.target_percent}%)`}
                </span>
              ))}
            </p>
          </div>
        ))}
      </div>
    </DataPanel>
  );
}

function ProbationPanel() {
  const [pendingOnly, setPendingOnly] = useState(true);
  const { data, error, isLoading, reload } = useApiQuery<ProbationReview[]>(`/cycle-config/probation-reviews?pending_only=${pendingOnly}`);
  const [recording, setRecording] = useState<ProbationReview | null>(null);
  const { busy, run } = useAction();

  const columns: ColumnDef<ProbationReview>[] = [
    {
      id: "employee",
      header: "Employee",
      accessorFn: (r) => r.employee_name ?? "—",
      meta: { text: (r) => `${r.employee_name ?? "—"}${r.extends_review_id ? " (extension)" : ""}` },
      cell: ({ row }) => (
        <>
          {row.original.employee_name ?? "—"}
          {row.original.extends_review_id && <span className="ml-2 text-xs text-muted-foreground">(extension)</span>}
        </>
      ),
    },
    {
      accessorKey: "probation_end_date",
      header: "Probation ends",
      meta: { text: (r) => formatDay(r.probation_end_date, true) },
      cell: ({ row }) => formatDay(row.original.probation_end_date, true),
    },
    {
      accessorKey: "review_due_date",
      header: "Review due",
      meta: { text: (r) => formatDay(r.review_due_date, true) },
      cell: ({ row }) => formatDay(row.original.review_due_date, true),
    },
    {
      accessorKey: "outcome",
      header: "Outcome",
      meta: {
        text: (r) =>
          r.outcome
            ? `${humanize(r.outcome)}${r.extended_to ? ` to ${formatDay(r.extended_to, true)}` : ""}`
            : "Pending",
      },
      cell: ({ row }) => {
        const r = row.original;
        return r.outcome ? (
          <>
            <StatusBadge status={r.outcome} />
            {r.extended_to && <span className="ml-2 text-xs">to {formatDay(r.extended_to, true)}</span>}
          </>
        ) : (
          "Pending"
        );
      },
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      meta: { className: "text-right", text: false },
      cell: ({ row }) =>
        !row.original.outcome && (
          <Button size="sm" variant="ghost" onClick={() => setRecording(row.original)}>
            Record outcome
          </Button>
        ),
    },
  ];

  return (
    <>
      <DataTable
        title="Probation reviews"
        description="Scheduled from each employee's probation end date, not from a calendar."
        filters={
          <div className="flex items-center gap-2">
            <Checkbox id="pb-pending" checked={pendingOnly} onCheckedChange={(v) => setPendingOnly(v === true)} />
            <Label htmlFor="pb-pending" className="text-xs font-normal">
              Pending only
            </Label>
          </div>
        }
        actions={
          <Button
            size="sm"
            variant="outline"
            disabled={busy !== null}
            onClick={async () => {
              const r = await run<{ scheduled: number }>(
                "schedule",
                () => post<{ scheduled: number }>("/cycle-config/probation-reviews/schedule-due", { horizon_days: 30, lead_days: 7 }),
              );
              if (r) reload();
            }}
          >
            <UserRoundCheck /> Schedule due in 30 days
          </Button>
        }
        columns={columns}
        data={data ?? []}
        noun="probation reviews"
        exportName="probation-reviews"
        searchPlaceholder="Search probation reviews"
        isLoading={isLoading && !data}
        error={error?.detail}
        onRetry={reload}
        empty={{ icon: UserRoundCheck, title: "No probation reviews", description: "Schedule them from probation end dates on employee records." }}
      />
      {recording && <ProbationOutcomeDialog review={recording} onClose={() => setRecording(null)} onDone={() => { setRecording(null); reload(); }} />}
    </>
  );
}

function ProbationOutcomeDialog({ review, onClose, onDone }: { review: ProbationReview; onClose: () => void; onDone: () => void }) {
  const [outcome, setOutcome] = useState<ProbationOutcome>("confirm");
  const [newEnd, setNewEnd] = useState("");
  const [notes, setNotes] = useState("");
  const { busy, run } = useAction();
  const valid = outcome !== "extend" || (newEnd && newEnd > review.probation_end_date);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Probation outcome · {review.employee_name}</DialogTitle>
          <DialogDescription>
            An extension schedules the next review automatically. Confirmation letters are issued from Documents; this does not send one.
          </DialogDescription>
        </DialogHeader>
        <FormField htmlFor="po-outcome" label="Outcome">
          <Select value={outcome} onValueChange={(v) => setOutcome(v as ProbationOutcome)}>
            <SelectTrigger id="po-outcome" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="confirm">Confirm</SelectItem>
              <SelectItem value="extend">Extend</SelectItem>
              <SelectItem value="terminate">Terminate</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        {outcome === "extend" && (
          <FormField htmlFor="po-end" label="New probation end date">
            <DatePicker id="po-end" min={review.probation_end_date} value={newEnd} onChange={setNewEnd} />
          </FormField>
        )}
        <FormField htmlFor="po-notes" label="Notes" optional>
          <Textarea id="po-notes" rows={3} maxLength={4000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={outcome === "terminate" ? "destructive" : "default"}
            disabled={!valid || busy !== null}
            onClick={async () => {
              const r = await run(
                "save",
                () =>
                  post(`/cycle-config/probation-reviews/${review.id}/outcome`, {
                    outcome,
                    new_probation_end_date: outcome === "extend" ? newEnd : null,
                    notes: notes.trim() || null,
                  }),
                "Outcome recorded.",
              );
              if (r !== undefined) onDone();
            }}
          >
            {busy && <Loader2 className="animate-spin" />} Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
