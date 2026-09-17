"use client";

import { Gauge, Layers, ListChecks, Loader2, Plus, Trash2 } from "lucide-react";
import React, { useState } from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { FormField } from "@/components/common/FormField";
import { PageShell } from "@/components/common/PageShell";
import { SectionNav } from "@/components/common/SectionNav";
import { humanize, useAction } from "@/components/performance/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { patch, post } from "@/lib/api";
import type { Competency, CompetencyCategory, CompetencyTemplate, RatingScale, ScaleType } from "@/lib/types/performance";

const DECIMAL = /^-?\d+(\.\d{1,2})?$/;

export default function CompetenciesPage() {
  const scales = useApiQuery<RatingScale[]>("/competency/scales");
  const competencies = useApiQuery<Competency[]>("/competency/competencies");
  const templates = useApiQuery<CompetencyTemplate[]>("/competency/templates");
  const [dialog, setDialog] = useState<"scale" | "competency" | "template" | null>(null);
  const { busy, run } = useAction();

  return (
    <PageShell title="Competencies & scales" description="What people are rated against, and what each level looks like.">
      <SectionNav section="performance" />
      <Tabs defaultValue="competencies">
        <TabsList>
          <TabsTrigger value="competencies">Competencies</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="scales">Rating scales</TabsTrigger>
        </TabsList>

        <TabsContent value="competencies" className="mt-4">
          <DataPanel
            title="Competencies"
            description="Each has a behaviour description for every level — without them, ratings are not comparable."
            actions={
              <Button size="sm" onClick={() => setDialog("competency")} disabled={(scales.data ?? []).length === 0}>
                <Plus /> New competency
              </Button>
            }
            isLoading={competencies.isLoading}
            error={competencies.error?.detail}
            onRetry={competencies.reload}
            isEmpty={(competencies.data ?? []).length === 0}
            empty={{ icon: ListChecks, title: "No competencies yet", description: "Create a rating scale first, then competencies against it." }}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Competency</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Level indicators</TableHead>
                  <TableHead>Linked values</TableHead>
                  <TableHead>Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {competencies.data?.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.code}</p>
                    </TableCell>
                    <TableCell>{humanize(c.category)}</TableCell>
                    <TableCell className="max-w-md text-xs">
                      {c.indicators.map((i) => (
                        <p key={i.scale_value}>
                          <span className="font-medium tabular-nums">{i.scale_value}</span> — {i.behaviour}
                        </p>
                      ))}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {c.linked_value_codes.length ? c.linked_value_codes.map((v) => <Badge key={v} variant="secondary">{v}</Badge>) : "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={c.active}
                        disabled={busy !== null}
                        aria-label={`${c.name} active`}
                        onCheckedChange={async (checked) => {
                          await run(c.id, () => patch(`/competency/competencies/${c.id}`, { active: checked }));
                          competencies.reload();
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataPanel>
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <DataPanel
            title="Competency templates"
            description="A set of weighted competencies for a kind of role. Weights add up to 100."
            actions={
              <Button size="sm" onClick={() => setDialog("template")} disabled={(competencies.data ?? []).length === 0}>
                <Plus /> New template
              </Button>
            }
            isLoading={templates.isLoading}
            error={templates.error?.detail}
            onRetry={templates.reload}
            isEmpty={(templates.data ?? []).length === 0}
            empty={{ icon: Layers, title: "No templates yet" }}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Template</TableHead>
                  <TableHead>Competencies</TableHead>
                  <TableHead>Grades</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.data?.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <p className="font-medium">{t.name}</p>
                      {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                    </TableCell>
                    <TableCell className="text-xs">
                      {t.items.map((i) => (
                        <p key={i.competency_id}>
                          {i.competency_name} <span className="tabular-nums text-muted-foreground">{i.weight}</span>
                          {!i.is_mandatory && <span className="text-muted-foreground"> (optional)</span>}
                        </p>
                      ))}
                    </TableCell>
                    <TableCell>{t.applicable_grades.join(", ") || "Any"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataPanel>
        </TabsContent>

        <TabsContent value="scales" className="mt-4">
          <DataPanel
            title="Rating scales"
            description="Every level carries a description; it is what makes one manager's 4 the same as another's."
            actions={
              <Button size="sm" onClick={() => setDialog("scale")}>
                <Plus /> New scale
              </Button>
            }
            isLoading={scales.isLoading}
            error={scales.error?.detail}
            onRetry={scales.reload}
            isEmpty={(scales.data ?? []).length === 0}
            empty={{ icon: Gauge, title: "No rating scales yet" }}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Scale</TableHead>
                  <TableHead>Range</TableHead>
                  <TableHead>Levels</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scales.data?.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      {s.name} <span className="text-xs text-muted-foreground">({humanize(s.scale_type)})</span>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {s.min_value}–{s.max_value}
                      {s.allow_decimals ? " · decimals" : ""}
                    </TableCell>
                    <TableCell className="text-xs">
                      {s.levels.map((l) => (
                        <p key={l.value}>
                          <span className="font-medium tabular-nums">{l.value}</span> {l.label} — {l.description}
                        </p>
                      ))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataPanel>
        </TabsContent>
      </Tabs>

      {dialog === "scale" && <ScaleDialog onClose={() => setDialog(null)} onDone={() => { setDialog(null); scales.reload(); }} />}
      {dialog === "competency" && (
        <CompetencyDialog scales={scales.data ?? []} onClose={() => setDialog(null)} onDone={() => { setDialog(null); competencies.reload(); }} />
      )}
      {dialog === "template" && (
        <TemplateDialog competencies={(competencies.data ?? []).filter((c) => c.active)} onClose={() => setDialog(null)} onDone={() => { setDialog(null); templates.reload(); }} />
      )}
    </PageShell>
  );
}

function ScaleDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<ScaleType>("numeric");
  const [decimals, setDecimals] = useState(false);
  const [levels, setLevels] = useState(
    ["Below expectations", "Partly meets", "Meets expectations", "Exceeds expectations", "Outstanding"].map((label, i) => ({
      value: String(i + 1),
      label,
      description: "",
    })),
  );
  const { busy, run } = useAction();
  const valid = name.trim() && levels.length >= 2 && levels.every((l) => DECIMAL.test(l.value) && l.label.trim() && l.description.trim());
  const values = levels.map((l) => Number(l.value));
  const update = (i: number, p: Partial<(typeof levels)[number]>) => setLevels((c) => c.map((l, idx) => (idx === i ? { ...l, ...p } : l)));
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New rating scale</DialogTitle>
          <DialogDescription>A four-point scale removes the middle and forces a choice; a five-point one does not.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <FormField htmlFor="s-name" label="Name">
            <Input id="s-name" maxLength={128} value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField htmlFor="s-type" label="Type">
            <Select value={type} onValueChange={(v) => setType(v as ScaleType)}>
              <SelectTrigger id="s-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="numeric">Numeric</SelectItem>
                <SelectItem value="label">Labels</SelectItem>
                <SelectItem value="percentage">Percentage</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="s-dec" checked={decimals} onCheckedChange={(v) => setDecimals(v === true)} />
          <Label htmlFor="s-dec" className="text-sm font-normal">
            Allow decimal ratings
          </Label>
        </div>
        {levels.map((l, i) => (
          <div key={i} className="grid grid-cols-[4rem_1fr_auto] items-end gap-2">
            <FormField htmlFor={`lv-v-${i}`} label="Value">
              <Input id={`lv-v-${i}`} inputMode="decimal" value={l.value} onChange={(e) => update(i, { value: e.target.value })} />
            </FormField>
            <FormField htmlFor={`lv-l-${i}`} label="Label">
              <Input id={`lv-l-${i}`} maxLength={128} value={l.label} onChange={(e) => update(i, { label: e.target.value })} />
            </FormField>
            <Button variant="ghost" size="icon" aria-label="Remove level" disabled={levels.length <= 2} onClick={() => setLevels((c) => c.filter((_, idx) => idx !== i))}>
              <Trash2 />
            </Button>
            <FormField htmlFor={`lv-d-${i}`} label="What it means" className="col-span-3">
              <Input id={`lv-d-${i}`} maxLength={2000} value={l.description} onChange={(e) => update(i, { description: e.target.value })} />
            </FormField>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={() => setLevels((c) => [...c, { value: "", label: "", description: "" }])}>
          <Plus /> Add level
        </Button>
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
                  post("/competency/scales", {
                    name: name.trim(),
                    scale_type: type,
                    allow_decimals: decimals,
                    min_value: String(Math.min(...values)),
                    max_value: String(Math.max(...values)),
                    levels: levels.map((l) => ({ value: l.value, label: l.label.trim(), description: l.description.trim() })),
                  }),
                "Scale created.",
              );
              if (r !== undefined) onDone();
            }}
          >
            {busy && <Loader2 className="animate-spin" />} Create scale
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CompetencyDialog({ scales, onClose, onDone }: { scales: RatingScale[]; onClose: () => void; onDone: () => void }) {
  const [scaleId, setScaleId] = useState(scales[0]?.id ?? "");
  const scale = scales.find((s) => s.id === scaleId);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<CompetencyCategory>("behavioural");
  const [description, setDescription] = useState("");
  const [values, setValues] = useState("");
  const [indicators, setIndicators] = useState<Record<string, string>>({});
  const { busy, run } = useAction();
  const levels = scale?.levels ?? [];
  const valid = scaleId && /^[A-Za-z0-9_.-]+$/.test(code) && name.trim() && levels.length >= 2 && levels.every((l) => (indicators[l.value] ?? "").trim());
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New competency</DialogTitle>
          <DialogDescription>Describe what each level looks like for this competency.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <FormField htmlFor="cp-code" label="Code" hint="Letters, digits, - _ .">
            <Input id="cp-code" maxLength={64} value={code} onChange={(e) => setCode(e.target.value)} />
          </FormField>
          <FormField htmlFor="cp-name" label="Name">
            <Input id="cp-name" maxLength={128} value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField htmlFor="cp-cat" label="Category">
            <Select value={category} onValueChange={(v) => setCategory(v as CompetencyCategory)}>
              <SelectTrigger id="cp-cat" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="behavioural">Behavioural</SelectItem>
                <SelectItem value="functional">Functional</SelectItem>
                <SelectItem value="leadership">Leadership</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField htmlFor="cp-scale" label="Scale">
            <Select value={scaleId} onValueChange={setScaleId}>
              <SelectTrigger id="cp-scale" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {scales.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
        <FormField htmlFor="cp-desc" label="Description" optional>
          <Textarea id="cp-desc" rows={2} maxLength={4000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </FormField>
        <FormField htmlFor="cp-values" label="Company values it relates to" optional hint="Value codes, comma-separated. Recognition for these values is shown beside this competency.">
          <Input id="cp-values" value={values} onChange={(e) => setValues(e.target.value)} />
        </FormField>
        {levels.map((l) => (
          <FormField key={l.value} htmlFor={`ind-${l.value}`} label={`${l.value} · ${l.label}`}>
            <Input
              id={`ind-${l.value}`}
              maxLength={2000}
              placeholder="What this level looks like here"
              value={indicators[l.value] ?? ""}
              onChange={(e) => setIndicators((c) => ({ ...c, [l.value]: e.target.value }))}
            />
          </FormField>
        ))}
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
                  post("/competency/competencies", {
                    code: code.trim(),
                    name: name.trim(),
                    category,
                    scale_id: scaleId,
                    description: description.trim() || null,
                    indicators: levels.map((l) => ({ scale_value: l.value, behaviour_description: indicators[l.value].trim() })),
                    linked_value_codes: values.split(",").map((v) => v.trim()).filter(Boolean),
                  }),
                "Competency created.",
              );
              if (r !== undefined) onDone();
            }}
          >
            {busy && <Loader2 className="animate-spin" />} Create competency
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TemplateDialog({ competencies, onClose, onDone }: { competencies: Competency[]; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [grades, setGrades] = useState("");
  const [items, setItems] = useState<Record<string, { weight: string; mandatory: boolean }>>({});
  const { busy, run } = useAction();
  const chosen = Object.entries(items);
  const total = chosen.reduce((s, [, i]) => s + (DECIMAL.test(i.weight) ? Number(i.weight) : 0), 0);
  const valid = name.trim() && chosen.length > 0 && chosen.every(([, i]) => DECIMAL.test(i.weight) && Number(i.weight) > 0) && Math.round(total * 100) === 10000;
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New competency template</DialogTitle>
          <DialogDescription>Choose competencies and weight them. Optional ones may be marked not applicable in a review.</DialogDescription>
        </DialogHeader>
        <FormField htmlFor="tp-name" label="Name">
          <Input id="tp-name" maxLength={128} value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <FormField htmlFor="tp-desc" label="Description" optional>
          <Input id="tp-desc" maxLength={4000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </FormField>
        <FormField htmlFor="tp-grades" label="Grades" optional hint="Comma-separated, for reference.">
          <Input id="tp-grades" value={grades} onChange={(e) => setGrades(e.target.value)} />
        </FormField>
        <div className="space-y-2">
          {competencies.map((c) => {
            const item = items[c.id];
            return (
              <div key={c.id} className="grid grid-cols-[auto_1fr_6rem_auto] items-center gap-2">
                <Checkbox
                  id={`tc-${c.id}`}
                  checked={Boolean(item)}
                  onCheckedChange={(v) =>
                    setItems((current) => {
                      const next = { ...current };
                      if (v === true) next[c.id] = { weight: "", mandatory: true };
                      else delete next[c.id];
                      return next;
                    })
                  }
                />
                <Label htmlFor={`tc-${c.id}`} className="font-normal">
                  {c.name}
                </Label>
                <Input
                  aria-label={`${c.name} weight`}
                  inputMode="decimal"
                  placeholder="Weight"
                  disabled={!item}
                  value={item?.weight ?? ""}
                  onChange={(e) => setItems((cur) => ({ ...cur, [c.id]: { ...cur[c.id], weight: e.target.value } }))}
                />
                <div className="flex items-center gap-1.5">
                  <Switch
                    aria-label={`${c.name} mandatory`}
                    disabled={!item}
                    checked={item?.mandatory ?? true}
                    onCheckedChange={(v) => setItems((cur) => ({ ...cur, [c.id]: { ...cur[c.id], mandatory: v } }))}
                  />
                  <span className="text-xs text-muted-foreground">Mandatory</span>
                </div>
              </div>
            );
          })}
        </div>
        <p className={total === 100 ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>
          Weights total <span className="tabular-nums">{total}</span> of 100.
        </p>
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
                  post("/competency/templates", {
                    name: name.trim(),
                    description: description.trim() || null,
                    applicable_grades: grades.split(",").map((g) => g.trim()).filter(Boolean),
                    items: chosen.map(([id, i], index) => ({
                      competency_id: id,
                      weight: i.weight,
                      is_mandatory: i.mandatory,
                      display_order: index,
                    })),
                  }),
                "Template created.",
              );
              if (r !== undefined) onDone();
            }}
          >
            {busy && <Loader2 className="animate-spin" />} Create template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
