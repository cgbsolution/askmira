"use client";

import { Loader2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { CANDIDATE_STAGE } from "@/components/hiring/labels";
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
import { ApiError, post } from "@/lib/api";
import type { CandidateCreateResult, CandidateInput, RequisitionSummary } from "@/lib/types/hiring";

const NONE = "none";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MONEY = /^\d{1,12}(\.\d{1,2})?$/;
const YEARS = /^\d{1,2}(\.\d)?$/;
const PHONE = /^[0-9+()\-\s]{6,32}$/;

interface FormState {
  requisition_id: string;
  full_name: string;
  email: string;
  phone: string;
  current_company: string;
  total_experience_years: string;
  current_ctc: string;
  expected_ctc: string;
  notice_period_days: string;
  source_note: string;
}

type Errors = Partial<Record<keyof FormState, string>>;

const blank = (requisitionId: string | null): FormState => ({
  requisition_id: requisitionId ?? NONE,
  full_name: "",
  email: "",
  phone: "",
  current_company: "",
  total_experience_years: "",
  current_ctc: "",
  expected_ctc: "",
  notice_period_days: "",
  source_note: "",
});

function validate(form: FormState): Errors {
  const errors: Errors = {};
  if (form.requisition_id === NONE) errors.requisition_id = "Choose the requisition they apply to.";
  if (form.full_name.trim().length < 2) errors.full_name = "Enter the candidate's name.";
  if (!EMAIL.test(form.email.trim())) errors.email = "Enter a valid email address.";
  if (form.phone.trim() && !PHONE.test(form.phone.trim())) {
    errors.phone = "Digits, spaces, +, ( ) and - only.";
  }
  const years = form.total_experience_years.trim();
  if (years && (!YEARS.test(years) || Number(years) > 60)) {
    errors.total_experience_years = "Years, 0–60, e.g. 4 or 4.5.";
  }
  for (const key of ["current_ctc", "expected_ctc"] as const) {
    if (form[key].trim() && !MONEY.test(form[key].trim())) errors[key] = "Annual rupees, e.g. 1200000.";
  }
  if (form.notice_period_days && (!/^\d{1,3}$/.test(form.notice_period_days) || Number(form.notice_period_days) > 365)) {
    errors.notice_period_days = "Whole days, 0–365.";
  }
  return errors;
}

/**
 * HR: add a candidate by hand against a requisition.
 *
 * The API may link them to a person already on file; its note says which, and
 * any possible duplicates are listed in the confirmation.
 */
export function CandidateFormDialog({
  open,
  onOpenChange,
  requisitions,
  requisitionId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requisitions: RequisitionSummary[];
  requisitionId: string | null;
  onCreated: (result: CandidateCreateResult) => void;
}) {
  const [form, setForm] = useState<FormState>(() => blank(requisitionId));
  const [errors, setErrors] = useState<Errors>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(blank(requisitionId));
      setErrors({});
    }
  }, [open, requisitionId]);

  const set = (key: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const save = async () => {
    const found = validate(form);
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;
    const opt = (value: string) => (value.trim() ? value.trim() : null);
    const input: CandidateInput = {
      requisition_id: form.requisition_id,
      full_name: form.full_name.trim(),
      email: form.email.trim(),
      phone: opt(form.phone),
      current_company: opt(form.current_company),
      total_experience_years: opt(form.total_experience_years),
      current_ctc: opt(form.current_ctc),
      expected_ctc: opt(form.expected_ctc),
      notice_period_days: form.notice_period_days ? Number(form.notice_period_days) : null,
      source_note: opt(form.source_note),
    };
    setIsSaving(true);
    try {
      const result = await post<CandidateCreateResult>("/hiring/candidates", input);
      const duplicates = result.possible_duplicates
        .map((dup) => `${dup.full_name} (${CANDIDATE_STAGE[dup.stage]?.[0] ?? dup.stage})`)
        .join(", ");
      toast.success(`${input.full_name} added`, {
        description: [result.note, duplicates ? `Possible duplicates: ${duplicates}.` : ""]
          .filter(Boolean)
          .join(" "),
        duration: duplicates ? 12_000 : undefined,
      });
      onOpenChange(false);
      onCreated(result);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "The candidate could not be added.");
    } finally {
      setIsSaving(false);
    }
  };

  const text = (
    key: keyof FormState,
    id: string,
    label: string,
    options: { optional?: boolean; type?: string; inputMode?: "decimal" | "numeric" | "email" | "tel" } = {},
  ) => (
    <FormField htmlFor={id} label={label} optional={options.optional} error={errors[key]}>
      <Input
        id={id}
        type={options.type ?? "text"}
        inputMode={options.inputMode}
        value={form[key]}
        onChange={(event) => set(key, event.target.value)}
      />
    </FormField>
  );

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add candidate</DialogTitle>
          <DialogDescription>
            They start at Applied. Salary figures are visible to HR only.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <FormField htmlFor="cand-requisition" label="Requisition" error={errors.requisition_id}>
            <Select value={form.requisition_id} onValueChange={(value) => set("requisition_id", value)}>
              <SelectTrigger id="cand-requisition" className="w-full">
                <SelectValue placeholder="Choose a requisition" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE} disabled>
                  Choose a requisition
                </SelectItem>
                {requisitions.map((requisition) => (
                  <SelectItem key={requisition.id} value={requisition.id}>
                    {requisition.code} · {requisition.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          {text("full_name", "cand-name", "Full name")}
          <div className="grid gap-4 sm:grid-cols-2">
            {text("email", "cand-email", "Email", { type: "email", inputMode: "email" })}
            {text("phone", "cand-phone", "Phone", { optional: true, type: "tel", inputMode: "tel" })}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {text("current_company", "cand-company", "Current company", { optional: true })}
            {text("total_experience_years", "cand-exp", "Experience (years)", {
              optional: true,
              inputMode: "decimal",
            })}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {text("current_ctc", "cand-ctc", "Current CTC (₹)", { optional: true, inputMode: "decimal" })}
            {text("expected_ctc", "cand-ectc", "Expected CTC (₹)", {
              optional: true,
              inputMode: "decimal",
            })}
            {text("notice_period_days", "cand-notice", "Notice (days)", {
              optional: true,
              inputMode: "numeric",
            })}
          </div>
          <FormField htmlFor="cand-source-note" label="Where they came from" optional>
            <Textarea
              id="cand-source-note"
              rows={2}
              maxLength={500}
              value={form.source_note}
              onChange={(event) => set("source_note", event.target.value)}
            />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isSaving} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="animate-spin" />}
              Add candidate
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
