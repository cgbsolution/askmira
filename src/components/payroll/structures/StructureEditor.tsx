"use client";

import { FileText, Info, Layers, Loader2 } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AmountInput } from "@/components/common/AmountInput";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Money } from "@/components/common/Money";
import { PercentInput } from "@/components/common/PercentInput";
import { apiMessage } from "@/components/payroll/labels";
import { SECTIONS } from "@/components/payroll/salary-master/shared";
import { LimitsPopover } from "@/components/payroll/structures/LimitsPopover";
import {
  EMPTY_RULE,
  FIGURES,
  type RuleDraft,
  STATUTORY_CODES,
  draftProblem,
  figureWord,
  fromDraft,
  toDraft,
} from "@/components/payroll/structures/rules";
import { SlabsDialog } from "@/components/payroll/structures/SlabsDialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { post, put } from "@/lib/api";
import {
  DEFAULT_WAGE_GROUP,
  type SalaryComponent,
  type SalaryTemplate,
  type SalaryTemplateDraft,
  type SalaryTemplateInput,
  type TemplateCalc,
  type TemplateRule,
  type WageGroup,
} from "@/lib/types/payroll";
import { cn } from "@/lib/utils";

export type StructureEditorMode =
  | { kind: "new"; draft: SalaryTemplateDraft }
  | { kind: "edit"; template: SalaryTemplate }
  | { kind: "copy"; template: SalaryTemplate };

const EMPLOYER_KEYS = ["EMPLOYER_PF", "EMPLOYER_ESI"] as const;
type EmployerKey = (typeof EMPLOYER_KEYS)[number];
const EMPLOYER_NAME: Record<EmployerKey, string> = {
  EMPLOYER_PF: "EMPLOYER PF CONTRIBUTION",
  EMPLOYER_ESI: "EMPLOYER ESIC CONTRIBUTION",
};

interface Listed {
  code: string;
  name: string;
  group: WageGroup;
  type: SalaryComponent["component_type"];
  partOfCtc: boolean;
  active: boolean;
}

interface FormState {
  name: string;
  description: string;
  precision: 0 | 2;
  rules: Record<string, RuleDraft>;
  employer: Record<EmployerKey, RuleDraft>;
}

function stateFrom(mode: StructureEditorMode): FormState {
  const source: {
    name: string;
    description: string | null;
    rounding_precision: number;
    lines: { component_code: string; rule: TemplateRule }[];
    employer_pf: TemplateRule | null;
    employer_esi: TemplateRule | null;
  } = mode.kind === "new" ? { ...mode.draft, description: null } : mode.template;
  const rules: Record<string, RuleDraft> = {};
  for (const line of source.lines) rules[line.component_code] = toDraft(line.rule);
  return {
    name: mode.kind === "copy" ? `Copy of ${source.name}`.slice(0, 255) : source.name,
    description: source.description ?? "",
    precision: source.rounding_precision === 2 ? 2 : 0,
    rules,
    employer: { EMPLOYER_PF: toDraft(source.employer_pf), EMPLOYER_ESI: toDraft(source.employer_esi) },
  };
}

function payloadFrom(state: FormState, listed: Listed[]): SalaryTemplateInput {
  return {
    name: state.name.trim(),
    description: state.description.trim() || null,
    rounding_precision: state.precision,
    lines: listed
      .filter((line) => (state.rules[line.code]?.method ?? "none") !== "none")
      .map((line) => ({ component_code: line.code, rule: fromDraft(state.rules[line.code]) as TemplateRule })),
    employer_pf: fromDraft(state.employer.EMPLOYER_PF),
    employer_esi: fromDraft(state.employer.EMPLOYER_ESI),
  };
}

/**
 * A salary structure template in the Salary Master's own layout: CTC wise input,
 * then the numbered wage groups. Each wage type gets a rule — a percentage of the
 * CTC or of another line, a fixed amount, the balance of the CTC, or slabs — with
 * an optional limit and condition. Employer PF and ESIC can be kept inside the
 * CTC. Typing an example CTC shows how it splits, worked out on the server.
 */
export function StructureEditor({
  mode,
  components,
  onClose,
  onSaved,
}: {
  mode: StructureEditorMode | null;
  components: SalaryComponent[];
  onClose: () => void;
  onSaved: (template: SalaryTemplate) => void;
}) {
  const [state, setState] = useState<FormState | null>(null);
  const [initialKey, setInitialKey] = useState("");
  const [exampleCtc, setExampleCtc] = useState("");
  const [exampleBasis, setExampleBasis] = useState<"monthly" | "annual">("monthly");
  const [calc, setCalc] = useState<TemplateCalc | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [slabsFor, setSlabsFor] = useState<string | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!mode) {
      setState(null);
      return;
    }
    const start = stateFrom(mode);
    setState(start);
    setInitialKey(JSON.stringify(start));
    setCalc(null);
    setCalcError(null);
    setError(null);
    setConfirmClose(false);
  }, [mode]);

  // Every wage type on, plus any switched off that the structure still uses.
  const listed = useMemo<Listed[]>(() => {
    const used = new Set(Object.entries(state?.rules ?? {}).filter(([, r]) => r.method !== "none").map(([c]) => c));
    return components
      .filter((c) => c.active || used.has(c.code))
      .sort((a, b) => a.display_order - b.display_order || a.code.localeCompare(b.code))
      .map((c) => ({
        code: c.code,
        name: c.name,
        group: c.wage_group ?? DEFAULT_WAGE_GROUP[c.component_type],
        type: c.component_type,
        partOfCtc: c.part_of_ctc,
        active: c.active,
      }));
  }, [components, state?.rules]);

  const names = useMemo(() => Object.fromEntries(listed.map((line) => [line.code, line.name])), [listed]);
  const payload = state ? payloadFrom(state, listed) : null;
  const exampleValid = /^\d+(\.\d{1,2})?$/.test(exampleCtc.trim()) && !/^0+(\.0+)?$/.test(exampleCtc.trim());
  // A rule still being typed waits quietly; the server checks everything on save.
  const unfinished = state
    ? (listed.map((line) => draftProblem(state.rules[line.code] ?? EMPTY_RULE, line.name)).find(Boolean) ??
      EMPLOYER_KEYS.map((key) => draftProblem(state.employer[key], EMPLOYER_NAME[key])).find(Boolean) ??
      null)
    : null;
  const previewKey =
    payload && exampleValid && !unfinished
      ? JSON.stringify([{ ...payload, name: payload.name || "Untitled" }, exampleCtc.trim(), exampleBasis])
      : null;

  useEffect(() => {
    if (!previewKey) {
      setCalc(null);
      setCalcError(null);
      return;
    }
    const [template, amount, basis] = JSON.parse(previewKey) as [SalaryTemplateInput, string, string];
    let cancelled = false;
    setCalculating(true);
    const timer = setTimeout(() => {
      post<TemplateCalc>("/salary-templates/preview", { template, ctc_amount: amount, ctc_basis: basis })
        .then((result) => {
          if (cancelled) return;
          setCalc(result);
          setCalcError(null);
        })
        .catch((caught) => {
          if (cancelled) return;
          setCalc(null);
          setCalcError(apiMessage(caught, "This structure could not split the CTC."));
        })
        .finally(() => {
          if (!cancelled) setCalculating(false);
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [previewKey]);

  if (!mode || !state) return null;

  const dirty = JSON.stringify(state) !== initialKey;
  const requestClose = () => {
    if (saving) return;
    if (dirty) setConfirmClose(true);
    else onClose();
  };

  const setRule = (code: string, patch: Partial<RuleDraft>) => {
    if (patch.method === "balance") {
      const before = Object.entries(state.rules).find(([other, rule]) => other !== code && rule.method === "balance");
      if (before) toast.info(`${names[before[0]] ?? before[0]} no longer takes the balance; ${names[code] ?? code} does.`);
    }
    setState((current) => {
      if (!current) return current;
      const rules = { ...current.rules, [code]: { ...(current.rules[code] ?? EMPTY_RULE), ...patch } };
      if (patch.method === "balance") {
        // One line takes the balance: picking it here moves it from the other.
        for (const [other, rule] of Object.entries(rules)) {
          if (other !== code && rule.method === "balance") rules[other] = { ...rule, method: "none" };
        }
      }
      return { ...current, rules };
    });
  };
  const setEmployer = (key: EmployerKey, patch: Partial<RuleDraft>) =>
    setState((current) =>
      current ? { ...current, employer: { ...current.employer, [key]: { ...current.employer[key], ...patch } } } : current,
    );

  const save = async () => {
    // A second click before the first save answers would save the structure twice.
    if (!payload || savingRef.current) return;
    if (!payload.name) return setError("Give the structure a name.");
    if (unfinished) return setError(`${unfinished}.`);
    if (!payload.lines.length) return setError("Give at least one wage type a rule.");
    if (!payload.lines.some((line) => line.rule.method === "balance")) {
      return setError("Pick one wage type to take the balance of the CTC (usually SPECIAL ALLOWANCE).");
    }
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const saved =
        mode.kind === "edit"
          ? await put<SalaryTemplate>(`/salary-templates/${mode.template.id}`, payload)
          : await post<SalaryTemplate>("/salary-templates", payload);
      toast.success(mode.kind === "edit" ? "Salary structure saved." : "Salary structure created.");
      onSaved(saved);
      onClose();
    } catch (caught) {
      setError(apiMessage(caught, "Could not save the salary structure."));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const calcLine = new Map((calc?.lines ?? []).map((line) => [line.component_code, line]));
  const calcEmployer = new Map((calc?.employer ?? []).map((line) => [line.key, line]));
  const inTemplate = listed.filter((line) => (state.rules[line.code]?.method ?? "none") !== "none");
  const legacy = mode.kind === "edit" && !mode.template.is_template;

  const example = (monthly: string | null | undefined, annual: string | null | undefined, applied = true, note?: string | null) => (
    <>
      <TableCell className="text-right">
        {monthly == null ? null : applied ? (
          <Money value={monthly} />
        ) : (
          <span className="text-xs text-muted-foreground" title={note ?? undefined}>
            Not applied
          </span>
        )}
      </TableCell>
      <TableCell className="text-right">{monthly == null || !applied ? null : <Money value={annual} />}</TableCell>
    </>
  );

  const ruleCells = (
    id: string,
    label: string,
    draft: RuleDraft,
    onPatch: (patch: Partial<RuleDraft>) => void,
    options: { value: RuleDraft["method"]; label: string }[],
    selfCode: string | null,
  ) => {
    const others = inTemplate.filter((line) => line.code !== selfCode).map((line) => ({ code: line.code, name: line.name }));
    return (
      <>
        <TableCell>
          <Select
            value={draft.method}
            onValueChange={(method) =>
              // Slabs are usually on the gross (Professional Tax), not on the CTC.
              onPatch({
                method: method as RuleDraft["method"],
                ...(method === "slab" && draft.of === "CTC" ? { of: "GROSS" } : {}),
              })
            }
          >
            <SelectTrigger size="sm" aria-label={`${label} calculation`} className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell>
          {draft.method === "percent" && (
            <PercentInput
              aria-label={`${label} percentage`}
              value={draft.value}
              placeholder="0"
              className="w-24"
              onValueChange={(value) => onPatch({ value })}
            />
          )}
          {draft.method === "fixed" && (
            <AmountInput
              aria-label={`${label} amount`}
              value={draft.value}
              placeholder="0"
              className="h-9 w-24"
              onValueChange={(value) => onPatch({ value })}
            />
          )}
          {draft.method === "balance" && <span className="text-sm text-muted-foreground">What is left</span>}
          {draft.method === "slab" && (
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => setSlabsFor(id)}>
              <Layers /> {draft.slabs.length} slab{draft.slabs.length === 1 ? "" : "s"}
            </Button>
          )}
        </TableCell>
        <TableCell>
          {draft.method === "percent" && (
            <Select value={draft.of} onValueChange={(of) => onPatch({ of })}>
              <SelectTrigger size="sm" aria-label={`${label} percentage of`} className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIGURES.map((figure) => (
                  <SelectItem key={figure.value} value={figure.value}>
                    of {figure.label}
                  </SelectItem>
                ))}
                {others.map((line) => (
                  <SelectItem key={line.code} value={line.code}>
                    of {line.name}
                  </SelectItem>
                ))}
                {/* A base since taken out of the structure stays visible, so the server can say so. */}
                {draft.of && !FIGURES.some((f) => f.value === draft.of) && !others.some((l) => l.code === draft.of) && (
                  <SelectItem value={draft.of}>of {names[draft.of] ?? draft.of} (not in structure)</SelectItem>
                )}
              </SelectContent>
            </Select>
          )}
          {draft.method === "fixed" && (
            <Select value={draft.basis} onValueChange={(basis) => onPatch({ basis: basis as RuleDraft["basis"] })}>
              <SelectTrigger size="sm" aria-label={`${label} amount per`} className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">a month</SelectItem>
                <SelectItem value="annual">a year</SelectItem>
              </SelectContent>
            </Select>
          )}
          {draft.method === "slab" && (
            <span className="text-sm text-muted-foreground">on {figureWord(draft.of, names)} a month</span>
          )}
        </TableCell>
        <TableCell>
          {(draft.method === "percent" || draft.method === "fixed" || draft.method === "slab") && (
            <LimitsPopover
              id={id}
              lineName={label}
              draft={draft}
              lines={others}
              names={names}
              onChange={onPatch}
            />
          )}
        </TableCell>
      </>
    );
  };

  const nameCell = (label: string, extra?: React.ReactNode) => (
    <TableCell className="min-w-48 whitespace-normal">
      <span className="flex items-center gap-2 text-sm text-foreground">
        <FileText aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <span>{label}</span>
        {extra}
      </span>
    </TableCell>
  );

  const lineRow = (line: Listed) => {
    const draft = state.rules[line.code] ?? EMPTY_RULE;
    const statutory = STATUTORY_CODES.has(line.code);
    const options: { value: RuleDraft["method"]; label: string }[] = [
      { value: "none", label: statutory ? "Payroll works it out" : "Not in structure" },
      { value: "percent", label: "Percentage" },
      { value: "fixed", label: "Fixed amount" },
      ...(line.type === "earning" && line.partOfCtc ? [{ value: "balance" as const, label: "Balance of CTC" }] : []),
      { value: "slab", label: "Slabs" },
    ];
    const result = calcLine.get(line.code);
    return (
      <TableRow key={line.code} className={cn(draft.method === "none" && "text-muted-foreground")}>
        {nameCell(
          line.name,
          !line.active ? (
            <Badge variant="warning" className="ml-1">
              Switched off
            </Badge>
          ) : !line.partOfCtc && draft.method !== "none" ? (
            <Badge variant="outline" className="ml-1">
              Outside CTC
            </Badge>
          ) : null,
        )}
        {ruleCells(line.code, line.name, draft, (patch) => setRule(line.code, patch), options, line.code)}
        {draft.method === "none" ? (
          <>
            <TableCell />
            <TableCell />
          </>
        ) : (
          example(result?.monthly, result?.annual, result?.applied ?? true, result?.note)
        )}
      </TableRow>
    );
  };

  const employerRow = (key: EmployerKey) => {
    const draft = state.employer[key];
    const result = calcEmployer.get(key);
    return (
      <TableRow key={key}>
        {nameCell(
          EMPLOYER_NAME[key],
          <Badge variant="outline" className="ml-1">
            Payroll
          </Badge>,
        )}
        {ruleCells(
          key,
          EMPLOYER_NAME[key],
          draft,
          (patch) => setEmployer(key, patch),
          [
            { value: "none", label: "Not in CTC (on top)" },
            { value: "percent", label: "Percentage" },
            { value: "fixed", label: "Fixed amount" },
            { value: "slab", label: "Slabs" },
          ],
          null,
        )}
        {draft.method === "none" ? (
          <>
            <TableCell />
            <TableCell />
          </>
        ) : (
          example(result?.monthly, result?.annual, result?.applied ?? true, result?.note)
        )}
      </TableRow>
    );
  };

  const sectionRow = (label: string) => (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={7} className="pt-5 pb-2 text-base font-semibold text-foreground">
        {label}
      </TableCell>
    </TableRow>
  );

  const groupTotal = (group: WageGroup) => calc?.group_totals.find((total) => total.wage_group === group);
  const slabTarget =
    slabsFor === null
      ? null
      : (EMPLOYER_KEYS as readonly string[]).includes(slabsFor)
        ? { name: EMPLOYER_NAME[slabsFor as EmployerKey], draft: state.employer[slabsFor as EmployerKey] }
        : { name: names[slabsFor] ?? slabsFor, draft: state.rules[slabsFor] ?? EMPTY_RULE };

  return (
    <Sheet open onOpenChange={(open) => !open && requestClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-7xl">
        <SheetHeader className="border-b border-border px-6 py-4">
          <SheetTitle className="text-lg">Salary Structure</SheetTitle>
          <SheetDescription>
            CTC is 100%. Give each wage type its share; one takes the balance. The Salary master then fills a
            person&apos;s salary from the CTC, for HR to review.
          </SheetDescription>
        </SheetHeader>

        <div className="grid grid-cols-1 gap-5 px-4 py-5 sm:px-6">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_12rem]">
            <div className="grid gap-1.5">
              <Label htmlFor="st-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="st-name"
                value={state.name}
                maxLength={255}
                placeholder="Staff CTC"
                onChange={(event) => setState({ ...state, name: event.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="st-description">Description</Label>
              <Input
                id="st-description"
                value={state.description}
                maxLength={1000}
                placeholder="Who this structure is for"
                onChange={(event) => setState({ ...state, description: event.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="st-round">Round each amount to</Label>
              <Select
                value={String(state.precision)}
                onValueChange={(value) => setState({ ...state, precision: value === "2" ? 2 : 0 })}
              >
                <SelectTrigger id="st-round" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Whole rupees</SelectItem>
                  <SelectItem value="2">Paise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-3">
            <div className="grid gap-1.5">
              <Label htmlFor="st-example">Try it with a CTC (₹)</Label>
              <AmountInput
                id="st-example"
                value={exampleCtc}
                placeholder="50000"
                className="h-9 w-40"
                onValueChange={setExampleCtc}
              />
            </div>
            <Select value={exampleBasis} onValueChange={(value) => setExampleBasis(value as "monthly" | "annual")}>
              <SelectTrigger aria-label="Example CTC pay basis" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="annual">Yearly</SelectItem>
              </SelectContent>
            </Select>
            {calculating && <Loader2 aria-label="Working out" className="mb-2.5 size-4 animate-spin text-muted-foreground" />}
            <p className="mb-2 text-xs text-muted-foreground">
              {unfinished && exampleValid
                ? `The example waits for ${unfinished}.`
                : "Shows each amount in the grid. Nothing is saved to anybody's salary."}
            </p>
          </div>

          {legacy && (
            <Alert>
              <Info />
              <AlertTitle>Made before structure rules</AlertTitle>
              <AlertDescription>
                Its lines are shown as rules below. Saving turns it into a structure template; salaries already saved
                keep their amounts.
                {mode.template.notes.map((note) => (
                  <span key={note} className="mt-1 block">
                    {note}
                  </span>
                ))}
              </AlertDescription>
            </Alert>
          )}
          {calcError && (
            <Alert variant="destructive">
              <AlertDescription>{calcError}</AlertDescription>
            </Alert>
          )}

          <div className="rounded-xl border border-border">
            {/* table-ok: the Salary Structure template grid, in the Salary Master's sections with numbered group and sub-total rows; DataTable has no section or sub-total rows */}
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="text-xs uppercase">Wage type description</TableHead>
                  <TableHead className="text-xs uppercase">Calculation</TableHead>
                  <TableHead className="text-xs uppercase">Value</TableHead>
                  <TableHead className="text-xs uppercase">Of / per</TableHead>
                  <TableHead className="text-xs uppercase">Limits</TableHead>
                  <TableHead className="text-right text-xs uppercase">Example a month</TableHead>
                  <TableHead className="text-right text-xs uppercase">A year</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sectionRow("CTC Wise Input")}
                <TableRow>
                  {nameCell("CTC TOTAL")}
                  <TableCell className="text-sm font-medium">100%</TableCell>
                  <TableCell colSpan={3} className="text-xs text-muted-foreground">
                    Typed for each person on the Salary master
                  </TableCell>
                  {example(calc?.ctc_monthly, calc?.ctc_annual)}
                </TableRow>
                {listed.filter((line) => line.group === "ctc_input").map(lineRow)}
                <TableRow>
                  {nameCell("MONTHLY GROSS")}
                  <TableCell colSpan={4} className="text-xs text-muted-foreground">
                    The earnings added up
                  </TableCell>
                  {example(calc?.gross_monthly, calc?.gross_annual)}
                </TableRow>

                {sectionRow("Salary Structure")}
                {SECTIONS.map((section, index) => {
                  const lines = listed.filter((line) => line.group === section.key);
                  const total = groupTotal(section.key);
                  return (
                    <React.Fragment key={section.key}>
                      <TableRow className="hover:bg-transparent">
                        <TableCell
                          colSpan={7}
                          className="pt-4 pb-1.5 text-xs font-semibold tracking-wide text-primary uppercase"
                        >
                          <span className="mr-5 tabular-nums">{index + 1}</span>
                          {section.title}
                        </TableCell>
                      </TableRow>
                      {section.key === "company_contribution" && EMPLOYER_KEYS.map(employerRow)}
                      {lines.length === 0 && section.key !== "company_contribution" ? (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={7} className="text-sm text-muted-foreground">
                            No wage types in this group.
                          </TableCell>
                        </TableRow>
                      ) : (
                        lines.map(lineRow)
                      )}
                      {total && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell className="font-semibold uppercase">Sub total</TableCell>
                          <TableCell colSpan={4} />
                          <TableCell className="text-right font-semibold">
                            <Money value={total.monthly} />
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            <Money value={total.annual} />
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}

                {calc && (
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableCell className="font-semibold uppercase">Total inside CTC</TableCell>
                    <TableCell colSpan={4} className="text-xs text-muted-foreground">
                      Wage types inside the CTC plus the employer contributions kept in it
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      <Money value={calc.allocated_monthly} />
                    </TableCell>
                    <TableCell />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {calc && calc.notes.length > 0 && (
            <ul className="grid gap-1 text-xs text-muted-foreground">
              {calc.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button disabled={saving} onClick={() => void save()}>
              {saving && <Loader2 className="animate-spin" />}
              SAVE
            </Button>
            <Button variant="outline" disabled={saving} onClick={requestClose}>
              Cancel
            </Button>
          </div>
        </div>
      </SheetContent>

      {slabTarget && slabsFor && (
        <SlabsDialog
          open
          onOpenChange={(open) => !open && setSlabsFor(null)}
          lineName={slabTarget.name}
          draft={slabTarget.draft}
          lines={inTemplate.filter((line) => line.code !== slabsFor).map((line) => ({ code: line.code, name: line.name }))}
          onSave={(patch) =>
            (EMPLOYER_KEYS as readonly string[]).includes(slabsFor)
              ? setEmployer(slabsFor as EmployerKey, patch)
              : setRule(slabsFor, patch)
          }
        />
      )}
      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title="Discard your changes?"
        description="The changes to this salary structure have not been saved."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => {
          setConfirmClose(false);
          onClose();
        }}
      />
    </Sheet>
  );
}
