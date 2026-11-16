"use client";

import React from "react";

import { FormField } from "@/components/common/FormField";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EmployeeRecord, EmploymentType } from "@/lib/types/people";

/** A consultant's GST and TDS, as the form holds them. */
export type BillingValues = {
  gst_applicable: "yes" | "no";
  gst_amount: string;
  fixed_tds_amount: string;
};

export const EMPTY_BILLING: BillingValues = {
  gst_applicable: "no",
  gst_amount: "",
  fixed_tds_amount: "",
};

const AMOUNT = /^\d{1,12}(\.\d{1,2})?$/;

export function billingFromRecord(record?: EmployeeRecord): BillingValues {
  if (!record) return EMPTY_BILLING;
  return {
    gst_applicable: record.gst_applicable ? "yes" : "no",
    gst_amount: record.gst_amount ?? "",
    fixed_tds_amount: record.fixed_tds_amount ?? "",
  };
}

export const isConsultant = (type: EmploymentType) => type === "consultant";

/** Problems keyed by field, for a consultant only: nobody else carries these. */
export function billingErrors(values: BillingValues, type: EmploymentType): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!isConsultant(type)) return errors;
  const gst = values.gst_amount.trim();
  const tds = values.fixed_tds_amount.trim();
  if (values.gst_applicable === "yes") {
    if (!gst) errors.gst_amount = "Enter the GST amount, or set GST applicable to No.";
    else if (!AMOUNT.test(gst) || Number(gst) <= 0) errors.gst_amount = "An amount in rupees, like 1800.";
  }
  if (tds && !AMOUNT.test(tds)) errors.fixed_tds_amount = "An amount in rupees, like 1000.";
  return errors;
}

/** What is sent: cleared for anybody who is not a consultant. */
export function billingPayload(values: BillingValues, type: EmploymentType) {
  if (!isConsultant(type)) {
    return { gst_applicable: false, gst_amount: null, fixed_tds_amount: null };
  }
  const gstOn = values.gst_applicable === "yes";
  return {
    gst_applicable: gstOn,
    gst_amount: gstOn && values.gst_amount.trim() ? values.gst_amount.trim() : null,
    fixed_tds_amount: values.fixed_tds_amount.trim() || null,
  };
}

/**
 * GST applicable, GST amount and TDS amount, shown for a consultant. Laid out
 * as cells of the surrounding two-column grid.
 */
export function ConsultantBillingFields({
  idPrefix,
  values,
  errors,
  onChange,
}: {
  idPrefix: string;
  values: BillingValues;
  errors: Record<string, string>;
  onChange: (values: BillingValues) => void;
}) {
  const set = <K extends keyof BillingValues>(key: K, value: BillingValues[K]) =>
    onChange({ ...values, [key]: value });

  return (
    <>
      <FormField htmlFor={`${idPrefix}-gst-applicable`} label="GST applicable">
        <Select
          value={values.gst_applicable}
          onValueChange={(v) =>
            onChange({
              ...values,
              gst_applicable: v as BillingValues["gst_applicable"],
              gst_amount: v === "yes" ? values.gst_amount : "",
            })
          }
        >
          <SelectTrigger id={`${idPrefix}-gst-applicable`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="yes">Yes</SelectItem>
            <SelectItem value="no">No</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      {values.gst_applicable === "yes" && (
        <FormField
          htmlFor={`${idPrefix}-gst-amount`}
          label="GST amount (per month)"
          required
          hint="Paid on top of their fee in every payroll run. No tax is deducted on it."
          error={errors.gst_amount}
        >
          <Input
            id={`${idPrefix}-gst-amount`}
            inputMode="decimal"
            placeholder="e.g. 1800"
            value={values.gst_amount}
            aria-invalid={Boolean(errors.gst_amount)}
            onChange={(event) => set("gst_amount", event.target.value)}
          />
        </FormField>
      )}
      <FormField
        htmlFor={`${idPrefix}-tds-amount`}
        label="TDS amount (per month)"
        optional
        hint="Deducted in every payroll run instead of salary TDS. Leave blank to work out salary TDS."
        error={errors.fixed_tds_amount}
      >
        <Input
          id={`${idPrefix}-tds-amount`}
          inputMode="decimal"
          placeholder="e.g. 1000"
          value={values.fixed_tds_amount}
          aria-invalid={Boolean(errors.fixed_tds_amount)}
          onChange={(event) => set("fixed_tds_amount", event.target.value)}
        />
      </FormField>
    </>
  );
}
