"use client";

import { Flag, History, Loader2, Plus, Target, Trash2 } from "lucide-react";
import React, { useState } from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { FormField } from "@/components/common/FormField";
import { PageShell } from "@/components/common/PageShell";
import { PercentBar, PersonSelect, StatusBadge, humanize, useAction, usePeople } from "@/components/performance/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { HR, MANAGERS } from "@/lib/access";
import { useApiQuery } from "@/hooks/useApiQuery";
import { patch, post } from "@/lib/api";
import type {
  CheckInConfidence,
  CycleSummary,
  Goal,
  GoalCheckIn,
  GoalVisibility,
  KeyResultInput,
  KeyResultKind,
} from "@/lib/types/performance";
import { formatDate, formatDay } from "@/lib/utils";

const NONE = "__none__";
const VISIBILITY_LABEL: Record<GoalVisibility, string> = {
  self: "Only me and HR",
  manager_line: "My reporting line",
  company: "Everyone",
};

/** Goals and key results. Progress is measured, and it is what a review's goal score reads. */
export default function GoalsPage() {
  const { user, hasRole } = useAuth();
  const isManager = hasRole(...MANAGERS);
  const isHr = hasRole(...HR);
  const [tab, setTab] = useState(user?.employee_id ? "mine" : "company");
  const [creating, setCreating] = useState<"mine" | "team" | "company" | null>(null);
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion((v) => v + 1);

  return (
    <PageShell
      title="Goals"
      description="Objectives with measurable key results. Their progress is the goal score in your review."
      actions={
        user?.employee_id ? (
          <Button variant="accent" onClick={() => setCreating(tab === "company" ? "company" : tab === "team" ? "team" : "mine")}>
            <Plus /> New goal
          </Button>
        ) : isHr ? (
          <Button variant="accent" onClick={() => setCreating("company")}>
            <Plus /> New company goal
          </Button>
        ) : undefined
      }
    >
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {user?.employee_id && <TabsTrigger value="mine">My goals</TabsTrigger>}
          {isManager && <TabsTrigger value="team">My team</TabsTrigger>}
          <TabsTrigger value="company">Company</TabsTrigger>
        </TabsList>
        {(["mine", "team", "company"] as const).map((scope) => (
          <TabsContent key={scope} value={scope} className="mt-4">
            <GoalList scope={scope} version={version} onChanged={refresh} />
          </TabsContent>
        ))}
      </Tabs>
      {creating && (
        <GoalDialog
          mode={creating}
          canCompany={isHr}
          onClose={() => setCreating(null)}
          onDone={() => {
            setCreating(null);
            refresh();
          }}
        />
      )}
    </PageShell>
  );
}

function GoalList({ scope, version, onChanged }: { scope: string; version: number; onChanged: () => void }) {
  const { data, error, isLoading, reload } = useApiQuery<Goal[]>(`/goals?scope=${scope}&v=${version}`);
  const goals = data ?? [];
  const total = goals.filter((g) => g.status !== "cancelled" && g.level !== "company").reduce(
    (sum, g) => sum + Number(g.weight),
    0,
  );
  if (isLoading && !data) return <Skeleton className="h-40 w-full" />;
  if (error || goals.length === 0) {
    return (
      <DataPanel
        error={error?.detail}
        onRetry={reload}
        isEmpty
        empty={{
          icon: Target,
          title: scope === "mine" ? "You have no goals yet" : scope === "team" ? "No goals in your team yet" : "No company goals yet",
          description: "Goals with key results count towards the review for the cycle they belong to.",
        }}
      />
    );
  }
  return (
    <div className="space-y-3">
      {scope === "mine" && (
        <p className="text-sm text-muted-foreground">
          Your live goals carry <span className="font-medium tabular-nums text-foreground">{total}</span> of 100 weight.
        </p>
      )}
      {goals.map((goal) => (
        <GoalCard key={goal.id} goal={goal} showOwner={scope !== "mine"} onChanged={() => { reload(); onChanged(); }} />
      ))}
    </div>
  );
}

function GoalCard({ goal, showOwner, onChanged }: { goal: Goal; showOwner: boolean; onChanged: () => void }) {
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const { busy, run } = useAction();
  const active = goal.status === "active";

  const setStatus = async (status: "completed" | "cancelled") => {
    await run(status, () => patch(`/goals/${goal.id}`, { status }), status === "completed" ? "Goal completed." : "Goal cancelled.");
    onChanged();
  };

  return (
    <Card tier="tier1" className="gap-3">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {goal.level === "company" && <Flag className="size-4 text-accent-foreground" />}
          {goal.title}
          <StatusBadge status={goal.status} />
        </CardTitle>
        <CardDescription>
          {showOwner && goal.owner_name && `${goal.owner_name} · `}
          Due {formatDay(goal.due_date, true)}
          {goal.level !== "company" && ` · weight ${goal.weight}`} · {VISIBILITY_LABEL[goal.visibility]}
          {goal.parent_title && ` · supports "${goal.parent_title}"`}
        </CardDescription>
        {goal.can_edit && active && (
          <CardAction className="flex gap-1">
            <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => void setStatus("completed")}>
              Complete
            </Button>
            <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => void setStatus("cancelled")}>
              Cancel
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {goal.description && <p className="text-sm text-muted-foreground">{goal.description}</p>}
        <PercentBar value={goal.progress_percent} label={`${goal.title} progress`} />
        <ul className="space-y-2">
          {goal.key_results.map((kr) => (
            <li key={kr.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm text-foreground">{kr.title}</p>
                <p className="text-xs tabular-nums text-muted-foreground">
                  {kr.kind === "milestone"
                    ? Number(kr.current_value) >= 1
                      ? "Done"
                      : "Not done"
                    : `${kr.current_value} of ${kr.target_value}${kr.unit ? ` ${kr.unit}` : ""} (from ${kr.start_value})`}
                  {" · "}weight {kr.weight}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <PercentBar value={kr.progress} label={`${kr.title} progress`} />
                {goal.can_edit && active && (
                  <Button size="sm" variant="outline" onClick={() => setCheckingIn(kr.id)}>
                    Update
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
        <Button size="sm" variant="ghost" onClick={() => setShowHistory((v) => !v)}>
          <History /> {showHistory ? "Hide" : "Show"} progress history
        </Button>
        {showHistory && <CheckInHistory goalId={goal.id} />}
      </CardContent>
      {checkingIn && (
        <CheckInDialog
          goal={goal}
          keyResultId={checkingIn}
          onClose={() => setCheckingIn(null)}
          onDone={() => {
            setCheckingIn(null);
            onChanged();
          }}
        />
      )}
    </Card>
  );
}

function CheckInHistory({ goalId }: { goalId: string }) {
  const { data, error, isLoading } = useApiQuery<GoalCheckIn[]>(`/goals/${goalId}/check-ins`);
  if (isLoading) return <Skeleton className="h-16 w-full" />;
  if (error) return <p className="text-sm text-destructive">{error.detail}</p>;
  if (!data?.length) return <p className="text-sm text-muted-foreground">No progress recorded yet.</p>;
  return (
    <ul className="space-y-1 text-xs">
      {data.map((c) => (
        <li key={c.id} className="flex flex-wrap gap-x-2 text-muted-foreground">
          <span>{formatDate(c.recorded_at)}</span>
          <span className="text-foreground">
            {c.key_result_title}: {c.previous_value ?? "—"} → {c.new_value ?? "—"}
          </span>
          <span className="tabular-nums">goal at {c.progress_after}%</span>
          {c.confidence && <Badge variant="outline">{humanize(c.confidence)}</Badge>}
          {c.recorded_by_name && <span>by {c.recorded_by_name}</span>}
          {c.note && <span className="text-foreground">“{c.note}”</span>}
        </li>
      ))}
    </ul>
  );
}

function CheckInDialog({
  goal,
  keyResultId,
  onClose,
  onDone,
}: {
  goal: Goal;
  keyResultId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const kr = goal.key_results.find((k) => k.id === keyResultId)!;
  const [value, setValue] = useState(kr.kind === "milestone" ? (Number(kr.current_value) >= 1 ? "1" : "0") : kr.current_value);
  const [confidence, setConfidence] = useState<string>(NONE);
  const [note, setNote] = useState("");
  const { busy, run } = useAction();
  const valid = /^-?\d+(\.\d{1,4})?$/.test(value.trim());
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update progress</DialogTitle>
          <DialogDescription>{kr.title}</DialogDescription>
        </DialogHeader>
        {kr.kind === "milestone" ? (
          <FormField htmlFor="ci-value" label="Status">
            <Select value={value} onValueChange={setValue}>
              <SelectTrigger id="ci-value" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Not done</SelectItem>
                <SelectItem value="1">Done</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        ) : (
          <FormField htmlFor="ci-value" label={`Current value${kr.unit ? ` (${kr.unit})` : ""}`} hint={`Target ${kr.target_value}, started at ${kr.start_value}.`}>
            <Input id="ci-value" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
          </FormField>
        )}
        <FormField htmlFor="ci-confidence" label="How is it going?" optional>
          <Select value={confidence} onValueChange={setConfidence}>
            <SelectTrigger id="ci-confidence" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Not stated</SelectItem>
              <SelectItem value="on_track">On track</SelectItem>
              <SelectItem value="at_risk">At risk</SelectItem>
              <SelectItem value="off_track">Off track</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <FormField htmlFor="ci-note" label="Note" optional>
          <Textarea id="ci-note" rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
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
                  post(`/goals/${goal.id}/check-ins`, {
                    key_result_id: kr.id,
                    value: value.trim(),
                    confidence: confidence === NONE ? null : (confidence as CheckInConfidence),
                    note: note.trim() || null,
                  }),
                "Progress recorded.",
              );
              if (r !== undefined) onDone();
            }}
          >
            {busy && <Loader2 className="animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const EMPTY_KR: KeyResultInput = { title: "", kind: "number", unit: "", start_value: "0", target_value: "", weight: "1" };
const DECIMAL = /^-?\d+(\.\d{1,4})?$/;

function GoalDialog({
  mode,
  canCompany,
  onClose,
  onDone,
}: {
  mode: "mine" | "team" | "company";
  canCompany: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const people = usePeople();
  const cycles = useApiQuery<CycleSummary[]>(mode === "company" ? null : "/appraisal/cycles");
  const [isCompany, setIsCompany] = useState(mode === "company" && canCompany);
  const [owner, setOwner] = useState(mode === "team" ? "" : "");
  const alignable = useApiQuery<Goal[]>(
    isCompany ? null : `/goals/alignable${owner ? `?owner_employee_id=${owner}` : ""}`,
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [weight, setWeight] = useState("0");
  const [due, setDue] = useState("");
  const [visibility, setVisibility] = useState<GoalVisibility>("manager_line");
  const [parent, setParent] = useState(NONE);
  const [cycleId, setCycleId] = useState(NONE);
  const [krs, setKrs] = useState<KeyResultInput[]>([{ ...EMPTY_KR }]);
  const { busy, run } = useAction();

  const krValid = krs.every(
    (k) => k.title.trim() && DECIMAL.test(k.start_value) && (k.kind === "milestone" || DECIMAL.test(k.target_value)) && DECIMAL.test(k.weight),
  );
  const valid =
    title.trim() && due && (isCompany || (DECIMAL.test(weight) && krValid && krs.length > 0)) && (mode !== "team" || owner || isCompany);

  const updateKr = (i: number, patchValue: Partial<KeyResultInput>) =>
    setKrs((current) => current.map((k, idx) => (idx === i ? { ...k, ...patchValue } : k)));

  const submit = async () => {
    const r = await run(
      "save",
      () =>
        post("/goals", {
          title: title.trim(),
          description: description.trim() || null,
          level: isCompany ? "company" : "individual",
          owner_employee_id: !isCompany && owner ? owner : null,
          weight: isCompany ? "0" : weight,
          due_date: due,
          visibility: isCompany ? "company" : visibility,
          parent_goal_id: !isCompany && parent !== NONE ? parent : null,
          appraisal_cycle_id: !isCompany && cycleId !== NONE ? cycleId : null,
          key_results: krs
            .filter((k) => k.title.trim())
            .map((k) => ({
              ...k,
              title: k.title.trim(),
              unit: k.unit?.trim() || null,
              target_value: k.kind === "milestone" ? "1" : k.target_value,
              start_value: k.kind === "milestone" ? "0" : k.start_value,
            })),
        }),
      "Goal created.",
    );
    if (r !== undefined) onDone();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isCompany ? "New company goal" : "New goal"}</DialogTitle>
          <DialogDescription>
            A goal needs at least one key result — that is what its progress, and the review&apos;s goal score, is measured from.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {canCompany && mode === "company" && (
            <FormField htmlFor="g-level" label="Kind">
              <Select value={isCompany ? "company" : "individual"} onValueChange={(v) => setIsCompany(v === "company")}>
                <SelectTrigger id="g-level" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="company">Company goal</SelectItem>
                  <SelectItem value="individual">Individual goal</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          )}
          {!isCompany && mode === "team" && (
            <FormField htmlFor="g-owner" label="For" error={people.error?.detail}>
              <PersonSelect id="g-owner" people={people.data ?? []} value={owner} onChange={setOwner} />
            </FormField>
          )}
          <FormField htmlFor="g-title" label="Objective">
            <Input id="g-title" maxLength={255} value={title} onChange={(e) => setTitle(e.target.value)} />
          </FormField>
          <FormField htmlFor="g-desc" label="Description" optional>
            <Textarea id="g-desc" rows={2} maxLength={4000} value={description} onChange={(e) => setDescription(e.target.value)} />
          </FormField>
          <div className="grid gap-3 sm:grid-cols-3">
            <FormField htmlFor="g-due" label="Due">
              <Input id="g-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </FormField>
            {!isCompany && (
              <>
                <FormField htmlFor="g-weight" label="Weight" hint="Out of 100 across the owner's goals.">
                  <Input id="g-weight" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
                </FormField>
                <FormField htmlFor="g-vis" label="Visible to">
                  <Select value={visibility} onValueChange={(v) => setVisibility(v as GoalVisibility)}>
                    <SelectTrigger id="g-vis" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(VISIBILITY_LABEL) as GoalVisibility[]).map((v) => (
                        <SelectItem key={v} value={v}>
                          {VISIBILITY_LABEL[v]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </>
            )}
          </div>
          {!isCompany && (
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField htmlFor="g-parent" label="Supports" optional hint="A company goal or one of your line's goals.">
                <Select value={parent} onValueChange={setParent}>
                  <SelectTrigger id="g-parent" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Nothing in particular</SelectItem>
                    {(alignable.data ?? []).map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.level === "company" ? "Company: " : `${g.owner_name}: `}
                        {g.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField htmlFor="g-cycle" label="Counts towards" optional hint="Otherwise, the cycle whose period contains the due date.">
                <Select value={cycleId} onValueChange={setCycleId}>
                  <SelectTrigger id="g-cycle" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>By due date</SelectItem>
                    {(cycles.data ?? [])
                      .filter((c) => c.status !== "closed")
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
          )}
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Key results{isCompany ? " (optional)" : ""}</p>
            {krs.map((k, i) => (
              <div key={i} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-6">
                <FormField htmlFor={`kr-title-${i}`} label="Result" className="sm:col-span-3">
                  <Input id={`kr-title-${i}`} maxLength={255} value={k.title} onChange={(e) => updateKr(i, { title: e.target.value })} />
                </FormField>
                <FormField htmlFor={`kr-kind-${i}`} label="Measured as" className="sm:col-span-2">
                  <Select value={k.kind} onValueChange={(v) => updateKr(i, { kind: v as KeyResultKind })}>
                    <SelectTrigger id={`kr-kind-${i}`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="percent">Percentage</SelectItem>
                      <SelectItem value="currency">Amount</SelectItem>
                      <SelectItem value="milestone">Done / not done</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
                <Button
                  variant="ghost"
                  size="icon"
                  className="self-end"
                  aria-label="Remove key result"
                  disabled={krs.length === 1}
                  onClick={() => setKrs((current) => current.filter((_, idx) => idx !== i))}
                >
                  <Trash2 />
                </Button>
                {k.kind !== "milestone" && (
                  <>
                    <FormField htmlFor={`kr-start-${i}`} label="From" className="sm:col-span-2">
                      <Input id={`kr-start-${i}`} inputMode="decimal" value={k.start_value} onChange={(e) => updateKr(i, { start_value: e.target.value })} />
                    </FormField>
                    <FormField htmlFor={`kr-target-${i}`} label="To" className="sm:col-span-2">
                      <Input id={`kr-target-${i}`} inputMode="decimal" value={k.target_value} onChange={(e) => updateKr(i, { target_value: e.target.value })} />
                    </FormField>
                    <FormField htmlFor={`kr-unit-${i}`} label="Unit" optional>
                      <Input id={`kr-unit-${i}`} maxLength={32} value={k.unit ?? ""} onChange={(e) => updateKr(i, { unit: e.target.value })} />
                    </FormField>
                  </>
                )}
                <FormField htmlFor={`kr-weight-${i}`} label="Weight">
                  <Input id={`kr-weight-${i}`} inputMode="decimal" value={k.weight} onChange={(e) => updateKr(i, { weight: e.target.value })} />
                </FormField>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setKrs((current) => [...current, { ...EMPTY_KR }])}>
              <Plus /> Add key result
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!valid || busy !== null} onClick={() => void submit()}>
            {busy && <Loader2 className="animate-spin" />} Create goal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
