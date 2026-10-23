"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Loader2, Plus, Trash2 } from "lucide-react";
import React, { useState } from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { FormField } from "@/components/common/FormField";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApiQuery } from "@/hooks/useApiQuery";
import { del, get, patch, post, put } from "@/lib/api";
import type {
  AssignmentPreview,
  AssignmentRuleConfig,
  AutoAdvance,
  CalibrationScope,
  CompetencyTemplate,
  CycleDetail,
  RatingScale,
  ScoreBand,
  StageConfig,
  StageInput,
  StageRole,
} from "@/lib/types/performance";
import { formatDay } from "@/lib/utils";

import { errorText, humanize, useAction } from "./shared";

const DECIMAL = /^\d+(\.\d{1,2})?$/;
const ROLES: StageRole[] = ["self", "manager", "reviewer", "hr", "normalisation"];

/** The stage list editor, shared by "new cycle" and "edit draft". */
export function StagesEditor({ stages, onChange }: { stages: StageInput[]; onChange: (s: StageInput[]) => void }) {
  const update = (i: number, p: Partial<StageInput>) => onChange(stages.map((s, idx) => (idx === i ? { ...s, ...p } : s)));
  return (
    <div className="space-y-2">
      {stages.map((s, i) => (
        <div key={i} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[4rem_10rem_1fr_auto]">
          <FormField htmlFor={`st-seq-${i}`} label="Order">
            <Input id={`st-seq-${i}`} type="number" min={1} max={20} value={s.sequence} onChange={(e) => update(i, { sequence: Number(e.target.value) })} />
          </FormField>
          <FormField htmlFor={`st-role-${i}`} label="Who">
            <Select value={s.role} onValueChange={(v) => update(i, { role: v as StageRole })}>
              <SelectTrigger id={`st-role-${i}`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {humanize(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField htmlFor={`st-label-${i}`} label="Label">
            <Input id={`st-label-${i}`} maxLength={128} value={s.label} onChange={(e) => update(i, { label: e.target.value })} />
          </FormField>
          <Button variant="ghost" size="icon" className="self-end" aria-label="Remove stage" disabled={stages.length === 1} onClick={() => onChange(stages.filter((_, idx) => idx !== i))}>
            <Trash2 />
          </Button>
          <div className="flex flex-wrap gap-4 sm:col-span-4">
            {(
              [
                ["is_mandatory", "Mandatory"],
                ["sees_previous_entries", "Sees earlier steps"],
                ["visible_to_employee_before_release", "Employee sees it before release"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="flex items-center gap-2">
                <Checkbox id={`st-${key}-${i}`} checked={s[key]} onCheckedChange={(v) => update(i, { [key]: v === true })} />
                <Label htmlFor={`st-${key}-${i}`} className="text-xs font-normal">
                  {label}
                </Label>
              </div>
            ))}
          </div>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          onChange([
            ...stages,
            {
              sequence: stages.length + 1,
              role: "manager",
              label: "",
              is_mandatory: true,
              sees_previous_entries: true,
              visible_to_employee_before_release: false,
            },
          ])
        }
      >
        <Plus /> Add stage
      </Button>
    </div>
  );
}

export function stagesValid(stages: StageInput[]): boolean {
  const seqs = stages.map((s) => s.sequence);
  return stages.length > 0 && stages.every((s) => s.label.trim() && s.sequence >= 1) && new Set(seqs).size === seqs.length;
}

/** Stages with their windows and what happens when a window closes. */
export function StagesCard({ detail, onChanged }: { detail: CycleDetail; onChanged: () => void }) {
  const [editing, setEditing] = useState<StageConfig | null>(null);
  const columns: ColumnDef<StageConfig>[] = [
    { accessorKey: "sequence", header: "#", meta: { cellClassName: "tabular-nums" } },
    {
      accessorKey: "label",
      header: "Stage",
      meta: { text: (s) => `${s.label} (${humanize(s.role)}${s.is_mandatory ? "" : ", optional"})` },
      cell: ({ row }) => (
        <>
          {row.original.label} <span className="text-xs text-muted-foreground">({humanize(row.original.role)}{row.original.is_mandatory ? "" : ", optional"})</span>
        </>
      ),
    },
    {
      accessorKey: "open_date",
      header: "Opens",
      meta: { text: (s) => (s.open_date ? formatDay(s.open_date, true) : null) },
      cell: ({ row }) => (row.original.open_date ? formatDay(row.original.open_date, true) : "—"),
    },
    {
      accessorKey: "due_date",
      header: "Due",
      meta: { text: (s) => (s.due_date ? formatDay(s.due_date, true) : null) },
      cell: ({ row }) => (row.original.due_date ? formatDay(row.original.due_date, true) : "—"),
    },
    {
      accessorKey: "close_date",
      header: "Closes",
      meta: {
        text: (s) => `${s.close_date ? formatDay(s.close_date, true) : "—"}${s.grace_days > 0 ? ` +${s.grace_days}d` : ""}`,
      },
      cell: ({ row }) => (
        <>
          {row.original.close_date ? formatDay(row.original.close_date, true) : "—"}
          {row.original.grace_days > 0 && <span className="text-xs text-muted-foreground"> +{row.original.grace_days}d</span>}
        </>
      ),
    },
    {
      accessorKey: "auto_advance",
      header: "On close",
      meta: { text: (s) => humanize(s.auto_advance) },
      cell: ({ row }) => <Badge variant="outline">{humanize(row.original.auto_advance)}</Badge>,
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      meta: { className: "text-right", text: false },
      cell: ({ row }) => (
        <Button size="sm" variant="ghost" onClick={() => setEditing(row.original)}>
          Edit window
        </Button>
      ),
    },
  ];
  return (
    <>
      <DataTable
        title="Stages and windows"
        description="Steps run in order. When a window closes, unfinished reviews escalate, advance or hold — as set here."
        tier="tier1"
        columns={columns}
        data={detail.stages}
        noun="stages"
        exportName="cycle-stages"
        searchPlaceholder="Search stages"
      />
      {editing && <WindowDialog stage={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); onChanged(); }} />}
    </>
  );
}

function WindowDialog({ stage, onClose, onDone }: { stage: StageConfig; onClose: () => void; onDone: () => void }) {
  const [open, setOpen] = useState(stage.open_date ?? "");
  const [due, setDue] = useState(stage.due_date ?? "");
  const [close, setClose] = useState(stage.close_date ?? "");
  const [grace, setGrace] = useState(String(stage.grace_days));
  const [mode, setMode] = useState<AutoAdvance>(stage.auto_advance);
  const { busy, run } = useAction();
  const valid = /^\d+$/.test(grace) && (!open || !close || close >= open);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{stage.label}</DialogTitle>
          <DialogDescription>Dates are optional. What happens on close is not — choose it deliberately.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <FormField htmlFor="w-open" label="Opens" optional>
            <Input id="w-open" type="date" value={open} onChange={(e) => setOpen(e.target.value)} />
          </FormField>
          <FormField htmlFor="w-due" label="Due" optional>
            <Input id="w-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </FormField>
          <FormField htmlFor="w-close" label="Closes" optional>
            <Input id="w-close" type="date" min={open || undefined} value={close} onChange={(e) => setClose(e.target.value)} />
          </FormField>
          <FormField htmlFor="w-grace" label="Grace days">
            <Input id="w-grace" type="number" min={0} max={90} value={grace} onChange={(e) => setGrace(e.target.value)} />
          </FormField>
        </div>
        <FormField htmlFor="w-mode" label="When the window closes">
          <Select value={mode} onValueChange={(v) => setMode(v as AutoAdvance)}>
            <SelectTrigger id="w-mode" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="escalate">Escalate one level up — nothing is skipped</SelectItem>
              <SelectItem value="advance">Advance, recording the stage as skipped</SelectItem>
              <SelectItem value="hold">Hold and wait for a person</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!valid || busy !== null}
            onClick={async () => {
              const r = await run("save", () =>
                patch(`/cycle-config/stages/${stage.id}/window`, {
                  open_date: open || null,
                  due_date: due || null,
                  close_date: close || null,
                  grace_days: Number(grace),
                  auto_advance: mode,
                }),
                "Window saved.",
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

/** Scoring: the rating scale, weights and bands. */
export function TemplateCard({ detail, onChanged }: { detail: CycleDetail; onChanged: () => void }) {
  const draft = detail.cycle?.status === "draft";
  const [editing, setEditing] = useState(false);
  const t = detail.template;
  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle>Scoring</CardTitle>
        <CardDescription>How goals, competencies and values combine into the score, and the bands that turn it into a rating.</CardDescription>
        {draft && (
          <CardAction>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              {t ? "Change" : "Set up scoring"}
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {t ? (
          <div className="space-y-2 text-sm">
            <p>
              Goals <span className="font-semibold tabular-nums">{t.goal_weight}</span> · Competencies{" "}
              <span className="font-semibold tabular-nums">{t.competency_weight}</span> · Values{" "}
              <span className="font-semibold tabular-nums">{t.values_weight}</span> · rated on {t.rating_scale_name}
              {t.competency_template_name && ` · default competencies: ${t.competency_template_name}`}
            </p>
            <div className="flex flex-wrap gap-2">
              {t.bands.map((b) => (
                <Badge key={b.label} variant="secondary">
                  {b.label}: {b.lower}–{b.upper}
                </Badge>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No scoring yet. Without it, review steps record comments only and produce no score.
          </p>
        )}
      </CardContent>
      {editing && <TemplateDialog detail={detail} onClose={() => setEditing(false)} onDone={() => { setEditing(false); onChanged(); }} />}
    </Card>
  );
}

function TemplateDialog({ detail, onClose, onDone }: { detail: CycleDetail; onClose: () => void; onDone: () => void }) {
  const scales = useApiQuery<RatingScale[]>("/competency/scales");
  const templates = useApiQuery<CompetencyTemplate[]>("/competency/templates");
  const t = detail.template;
  const [scale, setScale] = useState(t?.rating_scale_id ?? "");
  const [ct, setCt] = useState(t?.competency_template_id ?? "none");
  const [goalW, setGoalW] = useState(t?.goal_weight ?? "70");
  const [compW, setCompW] = useState(t?.competency_weight ?? "30");
  const [valW, setValW] = useState(t?.values_weight ?? "0");
  const [bands, setBands] = useState<ScoreBand[]>(
    t?.bands ?? [
      { label: "Below expectations", lower: "0", upper: "50" },
      { label: "Meets expectations", lower: "50", upper: "80" },
      { label: "Exceeds expectations", lower: "80", upper: "100" },
    ],
  );
  const { busy, run } = useAction();
  const weightsOk = [goalW, compW, valW].every((w) => DECIMAL.test(w));
  const sumHundred = weightsOk && Math.round((Number(goalW) + Number(compW) + Number(valW)) * 100) === 10000;
  const bandsOk = bands.every((b) => b.label.trim() && DECIMAL.test(b.lower) && DECIMAL.test(b.upper));
  const valid = scale && sumHundred && bandsOk && (Number(compW) === 0 || ct !== "none");
  const updateBand = (i: number, p: Partial<ScoreBand>) => setBands((c) => c.map((b, idx) => (idx === i ? { ...b, ...p } : b)));
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Scoring for {detail.cycle?.name}</DialogTitle>
          <DialogDescription>Weights must add up to 100. Bands must run edge to edge with no gaps.</DialogDescription>
        </DialogHeader>
        <FormField htmlFor="t-scale" label="Rating scale" error={scales.error?.detail}>
          <Select value={scale} onValueChange={setScale}>
            <SelectTrigger id="t-scale" className="w-full">
              <SelectValue placeholder={scales.data?.length ? "Choose a scale" : "Create a scale first"} />
            </SelectTrigger>
            <SelectContent>
              {(scales.data ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} ({s.min_value}–{s.max_value})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField htmlFor="t-ct" label="Default competency template" hint="Assignment rules can pick a different one per person.">
          <Select value={ct} onValueChange={setCt}>
            <SelectTrigger id="t-ct" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {(templates.data ?? []).map((x) => (
                <SelectItem key={x.id} value={x.id}>
                  {x.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <div className="grid grid-cols-3 gap-3">
          <FormField htmlFor="t-gw" label="Goals">
            <Input id="t-gw" inputMode="decimal" value={goalW} onChange={(e) => setGoalW(e.target.value)} />
          </FormField>
          <FormField htmlFor="t-cw" label="Competencies">
            <Input id="t-cw" inputMode="decimal" value={compW} onChange={(e) => setCompW(e.target.value)} />
          </FormField>
          <FormField htmlFor="t-vw" label="Values">
            <Input id="t-vw" inputMode="decimal" value={valW} onChange={(e) => setValW(e.target.value)} />
          </FormField>
        </div>
        {weightsOk && !sumHundred && <p className="text-xs text-destructive">The weights must add up to exactly 100.</p>}
        <div className="space-y-2">
          <p className="text-sm font-medium">Bands</p>
          {bands.map((b, i) => (
            <div key={i} className="grid grid-cols-[1fr_5rem_5rem_auto] items-end gap-2">
              <FormField htmlFor={`b-l-${i}`} label="Rating">
                <Input id={`b-l-${i}`} maxLength={64} value={b.label} onChange={(e) => updateBand(i, { label: e.target.value })} />
              </FormField>
              <FormField htmlFor={`b-lo-${i}`} label="From">
                <Input id={`b-lo-${i}`} inputMode="decimal" value={b.lower} onChange={(e) => updateBand(i, { lower: e.target.value })} />
              </FormField>
              <FormField htmlFor={`b-hi-${i}`} label="To">
                <Input id={`b-hi-${i}`} inputMode="decimal" value={b.upper} onChange={(e) => updateBand(i, { upper: e.target.value })} />
              </FormField>
              <Button variant="ghost" size="icon" aria-label="Remove band" disabled={bands.length === 1} onClick={() => setBands((c) => c.filter((_, idx) => idx !== i))}>
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => setBands((c) => [...c, { label: "", lower: "", upper: "" }])}>
            <Plus /> Add band
          </Button>
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
                  put("/competency/appraisal-templates", {
                    cycle_id: detail.cycle?.id,
                    rating_scale_id: scale,
                    competency_template_id: ct === "none" ? null : ct,
                    goal_weight: goalW,
                    competency_weight: compW,
                    values_weight: valW,
                    bands: bands.map((b) => ({ label: b.label.trim(), lower: b.lower, upper: b.upper })),
                  }),
                "Scoring saved.",
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

/** A rule's conditions in words: "Grades: L5, L6 · Min tenure months: 6". */
function conditionsText(conditions: Record<string, unknown>): string {
  return Object.entries(conditions)
    .map(([k, v]) => `${humanize(k)}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
    .join(" · ");
}

/** Which competency template each person is reviewed against. A default rule is required. */
export function RulesCard({ detail, onChanged }: { detail: CycleDetail; onChanged: () => void }) {
  const templates = useApiQuery<CompetencyTemplate[]>("/competency/templates");
  const draft = detail.cycle?.status === "draft";
  const [adding, setAdding] = useState(false);
  const [preview, setPreview] = useState<AssignmentPreview | null>(null);
  const { busy, run } = useAction();
  const names = Object.fromEntries((templates.data ?? []).map((t) => [t.id, t.name]));
  const hasDefault = detail.rules.some((r) => r.is_default);
  const columns: ColumnDef<AssignmentRuleConfig>[] = [
    { accessorKey: "priority", header: "Priority", meta: { cellClassName: "tabular-nums" } },
    { accessorKey: "label", header: "Label", cell: ({ row }) => row.original.label ?? "—" },
    {
      id: "conditions",
      header: "Conditions",
      accessorFn: (r) => (r.is_default ? "Default — everyone" : conditionsText(r.conditions)),
      meta: { cellClassName: "text-xs" },
      cell: ({ row }) =>
        row.original.is_default ? <Badge variant="secondary">Default — everyone</Badge> : conditionsText(row.original.conditions),
    },
    {
      id: "template",
      header: "Template",
      accessorFn: (r) => names[r.template_id] ?? null,
      cell: ({ row }) => names[row.original.template_id] ?? "—",
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      meta: { className: "text-right", text: false },
      cell: ({ row }) =>
        draft && (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Remove rule"
            disabled={busy !== null}
            onClick={async () => {
              await run(row.original.id, () => del(`/cycle-config/rules/${row.original.id}`), "Rule removed.");
              onChanged();
            }}
          >
            <Trash2 />
          </Button>
        ),
    },
  ];

  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle>Assignment rules</CardTitle>
        <CardDescription>Lowest priority number first; the first match wins. A rule with no conditions is the default.</CardDescription>
        <CardAction className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={busy !== null}
            onClick={async () => {
              const r = await run("preview", () => get<AssignmentPreview>(`/cycle-config/cycles/${detail.cycle?.id}/assignment-preview`));
              if (r) setPreview(r);
            }}
          >
            Preview
          </Button>
          {draft && (
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus /> Add rule
            </Button>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        {detail.rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No rules. Everybody is reviewed against the scoring&apos;s default competency template.
          </p>
        ) : (
          <>
            {!hasDefault && (
              <Alert variant="destructive">
                <AlertTitle>No default rule</AlertTitle>
                <AlertDescription>Launch is refused until one rule has no conditions, so nobody falls through.</AlertDescription>
              </Alert>
            )}
            <DataTable
              columns={columns}
              data={detail.rules}
              noun="rules"
              exportName="assignment-rules"
              searchPlaceholder="Search rules"
            />
          </>
        )}
        {preview && (
          <Alert variant={preview.unresolved.length ? "destructive" : "default"}>
            <AlertTitle>
              {preview.resolved} of {preview.eligible} eligible people resolve to a template
            </AlertTitle>
            <AlertDescription>
              {Object.entries(preview.by_template).map(([id, n]) => `${names[id] ?? id}: ${n}`).join(" · ") || "No rules yet."}
              {preview.unresolved.slice(0, 10).map((u) => (
                <span key={u.employee_id} className="block">
                  {u.reason}
                </span>
              ))}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
      {adding && (
        <RuleDialog
          cycleId={detail.cycle?.id ?? ""}
          templates={templates.data ?? []}
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            onChanged();
          }}
        />
      )}
    </Card>
  );
}

function RuleDialog({
  cycleId,
  templates,
  onClose,
  onDone,
}: {
  cycleId: string;
  templates: CompetencyTemplate[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [priority, setPriority] = useState("100");
  const [template, setTemplate] = useState("");
  const [label, setLabel] = useState("");
  const [grades, setGrades] = useState("");
  const [minTenure, setMinTenure] = useState("");
  const [maxTenure, setMaxTenure] = useState("");
  const { busy, run } = useAction();
  const conditions: Record<string, unknown> = {};
  const gradeList = grades.split(",").map((g) => g.trim()).filter(Boolean);
  if (gradeList.length) conditions.grades = gradeList;
  if (minTenure) conditions.min_tenure_months = Number(minTenure);
  if (maxTenure) conditions.max_tenure_months = Number(maxTenure);
  const valid = /^\d+$/.test(priority) && template;
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add an assignment rule</DialogTitle>
          <DialogDescription>Leave every condition empty to make this the default rule.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <FormField htmlFor="r-pri" label="Priority">
            <Input id="r-pri" type="number" min={1} max={1000} value={priority} onChange={(e) => setPriority(e.target.value)} />
          </FormField>
          <FormField htmlFor="r-label" label="Label" optional>
            <Input id="r-label" maxLength={128} value={label} onChange={(e) => setLabel(e.target.value)} />
          </FormField>
        </div>
        <FormField htmlFor="r-tpl" label="Competency template">
          <Select value={template} onValueChange={setTemplate}>
            <SelectTrigger id="r-tpl" className="w-full">
              <SelectValue placeholder="Choose a template" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField htmlFor="r-grades" label="Grades" optional hint="Comma-separated, e.g. L5, L6">
          <Input id="r-grades" value={grades} onChange={(e) => setGrades(e.target.value)} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField htmlFor="r-min" label="Min tenure (months)" optional>
            <Input id="r-min" type="number" min={0} value={minTenure} onChange={(e) => setMinTenure(e.target.value)} />
          </FormField>
          <FormField htmlFor="r-max" label="Max tenure (months)" optional>
            <Input id="r-max" type="number" min={0} value={maxTenure} onChange={(e) => setMaxTenure(e.target.value)} />
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
                "save",
                () =>
                  post("/cycle-config/rules", {
                    cycle_id: cycleId,
                    priority: Number(priority),
                    template_id: template,
                    conditions,
                    label: label.trim() || null,
                  }),
                "Rule added.",
              );
              if (r !== undefined) onDone();
            }}
          >
            {busy && <Loader2 className="animate-spin" />} Add rule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Calibration policy: mode, scope, small-group floor and the target distribution. */
export function PolicyCard({ detail, onChanged }: { detail: CycleDetail; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const p = detail.policy;
  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle>Calibration policy</CardTitle>
        <CardDescription>Whether the distribution is shown, enforced at closure, or not computed.</CardDescription>
        {!p && (
          <CardAction>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              Set policy
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {p ? (
          <div className="space-y-2 text-sm">
            <p>
              <Badge variant={p.mode === "enforced" ? "warning" : "secondary"}>{humanize(p.mode)}</Badge> by {p.scope} · groups under{" "}
              {p.min_group_size} are reported but not enforced · calibration {p.disclose_calibration_to_employee ? "is" : "is not"} disclosed to employees
            </p>
            <div className="flex flex-wrap gap-2">
              {p.targets.map((t) => (
                <Badge key={t.rating_value} variant="outline">
                  {t.rating_value}: {t.target_percent}% ± {t.tolerance_percent}
                </Badge>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No policy: no distribution is computed and closure is not gated on one.</p>
        )}
      </CardContent>
      {editing && <PolicyDialog detail={detail} onClose={() => setEditing(false)} onDone={() => { setEditing(false); onChanged(); }} />}
    </Card>
  );
}

function PolicyDialog({ detail, onClose, onDone }: { detail: CycleDetail; onClose: () => void; onDone: () => void }) {
  const [mode, setMode] = useState("advisory");
  const [scope, setScope] = useState<CalibrationScope>("department");
  const [minGroup, setMinGroup] = useState("8");
  const [disclose, setDisclose] = useState(false);
  const [targets, setTargets] = useState(
    (detail.template?.bands ?? []).map((b) => ({ rating_value: b.label, target_percent: "", tolerance_percent: "5" })),
  );
  const { busy, run } = useAction();
  const targetsOk =
    mode === "none" ||
    (targets.length > 0 &&
      targets.every((t) => t.rating_value && DECIMAL.test(t.target_percent) && DECIMAL.test(t.tolerance_percent)) &&
      Math.round(targets.reduce((s, t) => s + Number(t.target_percent), 0) * 100) === 10000);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Calibration policy</DialogTitle>
          <DialogDescription>Targets must add up to 100%. They are named by the ratings in this cycle&apos;s bands.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <FormField htmlFor="p-mode" label="Mode">
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger id="p-mode" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="advisory">Advisory — show the gap</SelectItem>
                <SelectItem value="enforced">Enforced — block closure</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField htmlFor="p-scope" label="Measured by">
            <Select value={scope} onValueChange={(v) => setScope(v as CalibrationScope)}>
              <SelectTrigger id="p-scope" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["company", "department", "manager", "grade"] as CalibrationScope[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {humanize(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField htmlFor="p-min" label="Smallest group enforced">
            <Input id="p-min" type="number" min={1} value={minGroup} onChange={(e) => setMinGroup(e.target.value)} />
          </FormField>
          <div className="flex items-end gap-2 pb-2">
            <Checkbox id="p-disclose" checked={disclose} onCheckedChange={(v) => setDisclose(v === true)} />
            <Label htmlFor="p-disclose" className="text-sm font-normal">
              Tell employees their rating was calibrated
            </Label>
          </div>
        </div>
        {mode !== "none" && (
          <div className="space-y-2">
            {targets.length === 0 && <p className="text-sm text-destructive">Set up scoring bands first; targets are named after them.</p>}
            {targets.map((t, i) => (
              <div key={t.rating_value} className="grid grid-cols-[1fr_6rem_6rem] items-end gap-2">
                <p className="pb-2 text-sm">{t.rating_value}</p>
                <FormField htmlFor={`tg-${i}`} label="Target %">
                  <Input id={`tg-${i}`} inputMode="decimal" value={t.target_percent} onChange={(e) => setTargets((c) => c.map((x, idx) => (idx === i ? { ...x, target_percent: e.target.value } : x)))} />
                </FormField>
                <FormField htmlFor={`tt-${i}`} label="± %">
                  <Input id={`tt-${i}`} inputMode="decimal" value={t.tolerance_percent} onChange={(e) => setTargets((c) => c.map((x, idx) => (idx === i ? { ...x, tolerance_percent: e.target.value } : x)))} />
                </FormField>
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!targetsOk || !/^\d+$/.test(minGroup) || busy !== null}
            onClick={async () => {
              const r = await run(
                "save",
                () =>
                  post("/calibration/policies", {
                    cycle_id: detail.cycle?.id,
                    mode,
                    scope,
                    min_group_size: Number(minGroup),
                    disclose_calibration_to_employee: disclose,
                    targets: mode === "none" ? [] : targets,
                  }),
                "Policy saved.",
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

export { errorText };
