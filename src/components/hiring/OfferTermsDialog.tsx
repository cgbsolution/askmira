"use client";

import React, { useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { OFFER_AMOUNT } from "@/components/hiring/OfferFormDialog";
import { ActionDialog } from "@/components/hiring/OfferActionDialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApiQuery } from "@/hooks/useApiQuery";
import { patch } from "@/lib/api";
import type { OfferDetail, TermsUpdateResult } from "@/lib/types/hiring";
import type { SalaryStructure } from "@/lib/types/payroll";
import { DatePicker } from "@/components/common/DatePicker";

/**
 * Edit an offer's terms. Only the fields that changed are sent. A material
 * change voids approvals already given, and the toast says which change did it.
 */
export function OfferTermsDialog({
  offer,
  open,
  onOpenChange,
  onSaved,
}: {
  offer: OfferDetail["offer"];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const structures = useApiQuery<SalaryStructure[]>(open ? "/salary-structures" : null);
  const initial = {
    ctc: offer.ctc_annual,
    structureId: offer.salary_structure_id,
    grade: offer.grade ?? "",
    designation: offer.designation,
    joiningDate: offer.joining_date,
    probation: String(offer.probation_months),
    notice: String(offer.notice_period_days),
    validUntil: offer.valid_until ?? "",
  };
  const [form, setForm] = useState(initial);
  const set = (changes: Partial<typeof initial>) => setForm((current) => ({ ...current, ...changes }));

  const validate = () => {
    if (!OFFER_AMOUNT.test(form.ctc.trim()) || Number(form.ctc) <= 0) return "Annual CTC must be a positive amount.";
    if (!form.structureId) return "Choose a salary structure.";
    if (!form.designation.trim()) return "Enter the designation.";
    if (!form.joiningDate) return "Choose the joining date.";
    if (!/^\d+$/.test(form.probation) || Number(form.probation) > 24) return "Probation must be 0 to 24 months.";
    if (!/^\d+$/.test(form.notice) || Number(form.notice) > 365) return "Notice period must be 0 to 365 days.";
    return null;
  };

  const submit = async () => {
    const body: Record<string, string | number | null> = {};
    if (form.ctc.trim() !== initial.ctc) body.ctc_annual = form.ctc.trim();
    if (form.structureId !== initial.structureId) body.salary_structure_id = form.structureId;
    if (form.grade.trim() !== initial.grade) body.grade = form.grade.trim() || null;
    if (form.designation.trim() !== initial.designation) body.designation = form.designation.trim();
    if (form.joiningDate !== initial.joiningDate) body.joining_date = form.joiningDate;
    if (form.probation !== initial.probation) body.probation_months = Number(form.probation);
    if (form.notice !== initial.notice) body.notice_period_days = Number(form.notice);
    if (form.validUntil !== initial.validUntil) body.valid_until = form.validUntil || null;
    if (Object.keys(body).length === 0) {
      toast.info("Nothing changed");
      return;
    }
    const result = await patch<TermsUpdateResult>(`/offers/${offer.id}/terms`, body);
    if (result.approvals_voided > 0) {
      toast.warning(`Terms saved. ${result.approvals_voided} approval(s) voided`, {
        description: `Material changes: ${result.material_changes.join(", ")}. The offer needs approving again.`,
      });
    } else {
      toast.success("Terms saved", {
        description: result.material_changes.length
          ? `Changed: ${result.material_changes.join(", ")}`
          : undefined,
      });
    }
    onSaved();
  };

  return (
    <ActionDialog
      open={open}
      onOpenChange={(next) => {
        if (next) setForm(initial);
        onOpenChange(next);
      }}
      title="Edit offer terms"
      description="Changing pay, grade, designation or joining details voids approvals already given."
      submitLabel="Save terms"
      wide
      validate={validate}
      onSubmit={submit}
      errorFallback="The terms could not be saved."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField htmlFor="terms-ctc" label="Annual CTC (₹)">
          <Input
            id="terms-ctc"
            inputMode="decimal"
            className="tabular-nums"
            value={form.ctc}
            onChange={(e) => set({ ctc: e.target.value })}
          />
        </FormField>
        <FormField htmlFor="terms-structure" label="Salary structure" error={structures.error?.detail}>
          <Select value={form.structureId} onValueChange={(value) => set({ structureId: value })}>
            <SelectTrigger id="terms-structure" className="w-full">
              <SelectValue placeholder={structures.isLoading ? "Loading…" : "Choose a structure"} />
            </SelectTrigger>
            <SelectContent>
              {(structures.data ?? []).map((structure) => (
                <SelectItem key={structure.id} value={structure.id}>
                  {structure.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField htmlFor="terms-designation" label="Designation">
          <Input
            id="terms-designation"
            maxLength={255}
            value={form.designation}
            onChange={(e) => set({ designation: e.target.value })}
          />
        </FormField>
        <FormField htmlFor="terms-grade" label="Grade" optional>
          <Input id="terms-grade" maxLength={32} value={form.grade} onChange={(e) => set({ grade: e.target.value })} />
        </FormField>
        <FormField htmlFor="terms-joining" label="Joining date">
          <DatePicker
            id="terms-joining"
            value={form.joiningDate}
            onChange={(picked) => set({ joiningDate: picked })}
          />
        </FormField>
        <FormField htmlFor="terms-valid" label="Valid until" optional>
          <DatePicker
            id="terms-valid"
            value={form.validUntil}
            onChange={(picked) => set({ validUntil: picked })}
          />
        </FormField>
        <FormField htmlFor="terms-probation" label="Probation (months)">
          <Input
            id="terms-probation"
            type="number"
            min={0}
            max={24}
            value={form.probation}
            onChange={(e) => set({ probation: e.target.value })}
          />
        </FormField>
        <FormField htmlFor="terms-notice" label="Notice period (days)">
          <Input
            id="terms-notice"
            type="number"
            min={0}
            max={365}
            value={form.notice}
            onChange={(e) => set({ notice: e.target.value })}
          />
        </FormField>
      </div>
    </ActionDialog>
  );
}
