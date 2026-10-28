"use client";

import { Loader2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { DraftJdButton } from "@/components/ai/DraftJdButton";
import { FormField } from "@/components/common/FormField";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { HR } from "@/lib/access";
import { ApiError, patch, post } from "@/lib/api";
import type { EmployeeSummary, Page } from "@/lib/types";
import type { EmploymentKind, RequisitionDetail, RequisitionInput } from "@/lib/types/hiring";
import { DatePicker } from "@/components/common/DatePicker";

/** Radix Select refuses an empty-string value, so "not chosen" is this sentinel. */
const NONE = "none";

const EMPLOYMENT_KINDS: { value: EmploymentKind; label: string }[] = [
  { value: "full_time", label: "Full time" },
  { value: "part_time", label: "Part time" },
  { value: "contract", label: "Contract" },
  { value: "intern", label: "Intern" },
];

interface NamedRef {
  id: string;
  name: string;
}

interface FormState {
  title: string;
  code: string;
  department_id: string;
  location_id: string;
  hiring_manager_id: string;
  recruiter_id: string;
  openings: string;
  employment_type: EmploymentKind;
  grade: string;
  experience_min_years: string;
  experience_max_years: string;
  budget_ctc_min: string;
  budget_ctc_max: string;
  justification: string;
  description: string;
  skills: string;
  target_joining_date: string;
  target_close_date: string;
}

type Errors = Partial<Record<keyof FormState, string>>;

function fromDetail(detail: RequisitionDetail | null | undefined): FormState {
  return {
    title: detail?.title ?? "",
    code: detail?.code ?? "",
    department_id: detail?.department_id ?? NONE,
    location_id: detail?.location_id ?? NONE,
    hiring_manager_id: detail?.hiring_manager_id ?? NONE,
    recruiter_id: detail?.recruiter_id ?? NONE,
    openings: String(detail?.openings ?? 1),
    employment_type: (detail?.employment_type as EmploymentKind | undefined) ?? "full_time",
    grade: detail?.grade ?? "",
    experience_min_years: detail?.experience_min_years?.toString() ?? "",
    experience_max_years: detail?.experience_max_years?.toString() ?? "",
    budget_ctc_min: detail?.budget_ctc_min ?? "",
    budget_ctc_max: detail?.budget_ctc_max ?? "",
    justification: detail?.justification ?? "",
    description: detail?.description ?? "",
    skills: detail?.skills.join(", ") ?? "",
    target_joining_date: detail?.target_joining_date ?? "",
    target_close_date: detail?.target_close_date ?? "",
  };
}

const MONEY_PATTERN = /^\d{1,12}(\.\d{1,2})?$/;

/** Compare two non-negative decimal strings without turning them into floats. */
function compareDecimal(a: string, b: string): number {
  const [aWhole, aFrac = ""] = a.split(".");
  const [bWhole, bFrac = ""] = b.split(".");
  const aw = aWhole.replace(/^0+(?=\d)/, "");
  const bw = bWhole.replace(/^0+(?=\d)/, "");
  if (aw.length !== bw.length) return aw.length - bw.length;
  if (aw !== bw) return aw < bw ? -1 : 1;
  const af = aFrac.padEnd(2, "0");
  const bf = bFrac.padEnd(2, "0");
  if (af === bf) return 0;
  return af < bf ? -1 : 1;
}

function validate(form: FormState): Errors {
  const errors: Errors = {};
  if (form.title.trim().length < 2) errors.title = "Give the role a title.";
  if (form.code.trim() && !/^[A-Za-z0-9-]{2,32}$/.test(form.code.trim())) {
    errors.code = "Letters, digits and hyphens only (2–32 characters).";
  }
  const openings = Number(form.openings);
  if (!/^\d+$/.test(form.openings) || openings < 1 || openings > 500) {
    errors.openings = "Between 1 and 500.";
  }
  for (const key of ["experience_min_years", "experience_max_years"] as const) {
    const value = form[key];
    if (value && (!/^\d+$/.test(value) || Number(value) > 60)) errors[key] = "Whole years, 0–60.";
  }
  if (
    !errors.experience_min_years &&
    !errors.experience_max_years &&
    form.experience_min_years &&
    form.experience_max_years &&
    Number(form.experience_min_years) > Number(form.experience_max_years)
  ) {
    errors.experience_max_years = "The maximum is below the minimum.";
  }
  for (const key of ["budget_ctc_min", "budget_ctc_max"] as const) {
    const value = form[key].trim();
    if (value && !MONEY_PATTERN.test(value)) errors[key] = "An annual amount in rupees, e.g. 1200000.";
  }
  const min = form.budget_ctc_min.trim();
  const max = form.budget_ctc_max.trim();
  if (!errors.budget_ctc_min && !errors.budget_ctc_max && min && max && compareDecimal(min, max) > 0) {
    errors.budget_ctc_max = "The ceiling is below the floor; no offer could fit it.";
  }
  if (max && !errors.budget_ctc_max && compareDecimal(max, "0") === 0) {
    errors.budget_ctc_max = "The ceiling must be above zero.";
  }
  return errors;
}

function toInput(form: FormState, isHr: boolean, editing: boolean): RequisitionInput {
  const opt = (value: string) => (value.trim() ? value.trim() : null);
  const pick = (value: string) => (value === NONE ? null : value);
  const input: RequisitionInput = {
    title: form.title.trim(),
    code: opt(form.code),
    department_id: pick(form.department_id),
    location_id: pick(form.location_id),
    openings: Number(form.openings),
    employment_type: form.employment_type,
    grade: opt(form.grade),
    experience_min_years: form.experience_min_years ? Number(form.experience_min_years) : null,
    experience_max_years: form.experience_max_years ? Number(form.experience_max_years) : null,
    budget_ctc_min: opt(form.budget_ctc_min),
    budget_ctc_max: opt(form.budget_ctc_max),
    justification: opt(form.justification),
    description: opt(form.description),
    skills: form.skills
      .split(",")
      .map((skill) => skill.trim())
      .filter(Boolean),
    target_joining_date: opt(form.target_joining_date),
    target_close_date: opt(form.target_close_date),
  };
  // The code is fixed once a requisition exists; the update schema has no code field.
  if (editing) delete input.code;
  if (isHr) {
    input.hiring_manager_id = pick(form.hiring_manager_id);
    input.recruiter_id = pick(form.recruiter_id);
  }
  return input;
}

function employeeName(employee: EmployeeSummary): string {
  return (
    employee.display_name ?? [employee.first_name, employee.last_name].filter(Boolean).join(" ")
  );
}

/**
 * Raise a requisition, or edit one that is still a draft or was rejected.
 *
 * HR picks the hiring manager and recruiter; a manager is always the hiring
 * manager of what they raise, so those pickers are hidden for them.
 */
export function RequisitionFormDialog({
  open,
  onOpenChange,
  requisition,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present in edit mode. */
  requisition?: RequisitionDetail | null;
  onSaved: (detail: RequisitionDetail) => void;
}) {
  const { hasRole } = useAuth();
  const isHr = hasRole(...HR);
  const editing = Boolean(requisition);
  const [form, setForm] = useState<FormState>(() => fromDetail(requisition));
  const [errors, setErrors] = useState<Errors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [aiAssisted, setAiAssisted] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(fromDetail(requisition));
      setErrors({});
      setAiAssisted(Boolean(requisition?.description_ai_assisted));
    }
  }, [open, requisition]);

  const departments = useApiQuery<NamedRef[]>(open ? "/org/departments" : null);
  const locations = useApiQuery<NamedRef[]>(open ? "/org/locations" : null);
  const employees = useApiQuery<Page<EmployeeSummary>>(
    open && isHr ? "/employees?page=1&page_size=200" : null,
  );

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const save = async () => {
    const found = validate(form);
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;
    setIsSaving(true);
    try {
      const input = toInput(form, isHr, editing);
      if (editing) input.description_ai_assisted = aiAssisted;
      const saved = editing
        ? await patch<RequisitionDetail>(`/hiring/requisitions/${requisition!.id}`, input)
        : await post<RequisitionDetail>("/hiring/requisitions", input);
      toast.success(editing ? `${saved.code} updated` : `${saved.code} saved as a draft`, {
        description: editing ? undefined : "Submit it for approval when the justification is ready.",
      });
      onOpenChange(false);
      onSaved(saved);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.detail : "The requisition could not be saved.");
    } finally {
      setIsSaving(false);
    }
  };

  const refSelect = (
    id: string,
    key: "department_id" | "location_id" | "hiring_manager_id" | "recruiter_id",
    options: NamedRef[],
    loading: boolean,
    loadError: string | undefined,
  ) => (
    <>
      <Select value={form[key]} onValueChange={(value) => set(key, value)}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={loading ? "Loading…" : "Not set"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Not set</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {loadError && <p className="text-xs text-destructive">{loadError}</p>}
    </>
  );

  const employeeOptions: NamedRef[] = (employees.data?.items ?? []).map((employee) => ({
    id: employee.id,
    name: employee.designation
      ? `${employeeName(employee)} · ${employee.designation}`
      : employeeName(employee),
  }));

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${requisition?.code}` : "Raise requisition"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Only drafts and rejected requisitions can be edited."
              : "It is saved as a draft. Nothing is sent for approval until you submit it."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <FormField htmlFor="req-title" label="Job title" error={errors.title}>
              <Input
                id="req-title"
                value={form.title}
                maxLength={255}
                onChange={(event) => set("title", event.target.value)}
              />
            </FormField>
            <FormField
              htmlFor="req-code"
              label="Code"
              optional
              hint={editing ? undefined : "Generated if left blank."}
              error={errors.code}
            >
              <Input
                id="req-code"
                value={form.code}
                maxLength={32}
                disabled={editing}
                onChange={(event) => set("code", event.target.value)}
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField htmlFor="req-department" label="Department" optional>
              {refSelect(
                "req-department",
                "department_id",
                departments.data ?? [],
                departments.isLoading,
                departments.error?.detail,
              )}
            </FormField>
            <FormField htmlFor="req-location" label="Location" optional>
              {refSelect(
                "req-location",
                "location_id",
                locations.data ?? [],
                locations.isLoading,
                locations.error?.detail,
              )}
            </FormField>
          </div>

          {isHr ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField htmlFor="req-manager" label="Hiring manager" optional>
                {refSelect(
                  "req-manager",
                  "hiring_manager_id",
                  employeeOptions,
                  employees.isLoading,
                  employees.error?.detail,
                )}
              </FormField>
              <FormField htmlFor="req-recruiter" label="Recruiter" optional>
                {refSelect(
                  "req-recruiter",
                  "recruiter_id",
                  employeeOptions,
                  employees.isLoading,
                  employees.error?.detail,
                )}
              </FormField>
            </div>
          ) : (
            !editing && (
              <p className="text-xs text-muted-foreground">
                You will be the hiring manager for this requisition.
              </p>
            )
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <FormField htmlFor="req-openings" label="Openings" error={errors.openings}>
              <Input
                id="req-openings"
                type="number"
                min={1}
                max={500}
                inputMode="numeric"
                value={form.openings}
                onChange={(event) => set("openings", event.target.value)}
              />
            </FormField>
            <FormField htmlFor="req-type" label="Employment type">
              <Select
                value={form.employment_type}
                onValueChange={(value) => set("employment_type", value as EmploymentKind)}
              >
                <SelectTrigger id="req-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT_KINDS.map((kind) => (
                    <SelectItem key={kind.value} value={kind.value}>
                      {kind.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField htmlFor="req-grade" label="Grade" optional>
              <Input
                id="req-grade"
                value={form.grade}
                maxLength={32}
                onChange={(event) => set("grade", event.target.value)}
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              htmlFor="req-exp-min"
              label="Experience from (years)"
              optional
              error={errors.experience_min_years}
            >
              <Input
                id="req-exp-min"
                type="number"
                min={0}
                max={60}
                inputMode="numeric"
                value={form.experience_min_years}
                onChange={(event) => set("experience_min_years", event.target.value)}
              />
            </FormField>
            <FormField
              htmlFor="req-exp-max"
              label="Experience to (years)"
              optional
              error={errors.experience_max_years}
            >
              <Input
                id="req-exp-max"
                type="number"
                min={0}
                max={60}
                inputMode="numeric"
                value={form.experience_max_years}
                onChange={(event) => set("experience_max_years", event.target.value)}
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              htmlFor="req-budget-min"
              label="Budget CTC floor (₹ per year)"
              optional
              error={errors.budget_ctc_min}
            >
              <Input
                id="req-budget-min"
                inputMode="decimal"
                value={form.budget_ctc_min}
                onChange={(event) => set("budget_ctc_min", event.target.value)}
              />
            </FormField>
            <FormField
              htmlFor="req-budget-max"
              label="Budget CTC ceiling (₹ per year)"
              optional
              error={errors.budget_ctc_max}
            >
              <Input
                id="req-budget-max"
                inputMode="decimal"
                value={form.budget_ctc_max}
                onChange={(event) => set("budget_ctc_max", event.target.value)}
              />
            </FormField>
          </div>

          <FormField
            htmlFor="req-justification"
            label="Business justification"
            hint="Needed before the requisition can be submitted for approval."
          >
            <Textarea
              id="req-justification"
              rows={3}
              maxLength={4000}
              value={form.justification}
              onChange={(event) => set("justification", event.target.value)}
            />
          </FormField>

          <FormField
            htmlFor="req-description"
            label="Job description"
            optional
            hint={aiAssisted ? "Started from an AI draft; the published version will say so." : undefined}
          >
            <Textarea
              id="req-description"
              rows={6}
              maxLength={20000}
              value={form.description}
              onChange={(event) => {
                set("description", event.target.value);
                if (!event.target.value.trim()) setAiAssisted(false);
              }}
            />
          </FormField>
          {editing && requisition ? (
            <div className="-mt-2 flex justify-end">
              <DraftJdButton
                requisitionId={requisition.id}
                notes={form.description}
                onDraft={(draft) => {
                  set("description", draft);
                  setAiAssisted(true);
                }}
              />
            </div>
          ) : null}

          <FormField
            htmlFor="req-skills"
            label="Skills"
            optional
            hint="Separate skills with commas."
          >
            <Input
              id="req-skills"
              value={form.skills}
              onChange={(event) => set("skills", event.target.value)}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField htmlFor="req-joining" label="Target joining date" optional>
              <DatePicker
                id="req-joining"
                value={form.target_joining_date}
                onChange={(picked) => set("target_joining_date", picked)}
              />
            </FormField>
            <FormField
              htmlFor="req-close"
              label="Target close date"
              optional
              error={errors.target_close_date}
            >
              <DatePicker
                id="req-close"
                value={form.target_close_date}
                onChange={(picked) => set("target_close_date", picked)}
              />
            </FormField>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="animate-spin" />}
              {editing ? "Save changes" : "Save draft"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
