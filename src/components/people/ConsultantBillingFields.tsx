"use client";

import React from "react";

import { DatePicker } from "@/components/common/DatePicker";
import { FormField } from "@/components/common/FormField";
import { NONE } from "@/components/people/labels";
import { usePeople } from "@/components/performance/shared";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  ConsultantPayBasis,
  EmployeeRecord,
  EmploymentType,
  PayeeKind,
  TdsSection,
} from "@/lib/types/people";

/** A consultant's pay, tax and approver details, as the form holds them. */
export type BillingValues = {
  pay_basis: ConsultantPayBasis;
  /** First hourly rate and its start date: asked at onboarding only. */
  hourly_rate: string;
  rate_from: string;
  /** First monthly fee and its start date, for fixed monthly pay: asked at onboarding only. */
  monthly_fee: string;
  fee_from: string;
  tds_section: TdsSection;
  payee_kind: PayeeKind;
  gst_applicable: "yes" | "no";
  gst_rate: string;
  gstin: string;
  contract_end_date: string;
  /** A user id, or NONE. */
  internal_approver_user_id: string;
};

export const DEFAULT_GST_RATE = "18";

export const EMPTY_BILLING: BillingValues = {
  pay_basis: "hourly",
  hourly_rate: "",
  rate_from: "",
  monthly_fee: "",
  fee_from: "",
  tds_section: "194J_professional",
  payee_kind: "individual",
  gst_applicable: "no",
  gst_rate: "",
  gstin: "",
  contract_end_date: "",
  internal_approver_user_id: NONE,
};

export const TDS_SECTION: Record<TdsSection, string> = {
  "194J_professional": "194J: professional fees",
  "194J_technical": "194J: technical fees",
  "194C": "194C: contract work",
};

export const PAY_BASIS: Record<ConsultantPayBasis, string> = {
  hourly: "Hourly",
  fixed_monthly: "Fixed monthly",
};

export const PAYEE_KIND: Record<PayeeKind, string> = {
  individual: "Individual",
  huf: "HUF",
  firm: "Firm",
  company: "Company",
};

const RATE = /^\d{1,8}(\.\d{1,2})?$/;
const FEE = /^\d{1,12}(\.\d{1,2})?$/;
const PERCENT = /^\d{1,3}(\.\d{1,2})?$/;

export function billingFromRecord(record?: EmployeeRecord): BillingValues {
  if (!record) return EMPTY_BILLING;
  return {
    ...EMPTY_BILLING,
    pay_basis: record.pay_basis ?? EMPTY_BILLING.pay_basis,
    tds_section: record.tds_section ?? EMPTY_BILLING.tds_section,
    payee_kind: record.payee_kind ?? EMPTY_BILLING.payee_kind,
    gst_applicable: record.gst_applicable ? "yes" : "no",
    gst_rate: record.gst_rate ?? "",
    gstin: record.gstin ?? "",
    contract_end_date: record.contract_end_date ?? "",
    internal_approver_user_id: record.internal_approver_user_id ?? NONE,
  };
}

export const isConsultant = (type: EmploymentType) => type === "consultant";

/**
 * Problems keyed by field, for a consultant only: nobody else carries these.
 * Mirrors the server's rules, so a problem shows here before a save is refused.
 * `requireRate` is set at onboarding, where the first hourly rate (or, for fixed
 * monthly pay, the first monthly fee) is entered.
 * `checkGst: false` skips the GST checks: a consultant saved before GST rate and
 * GSTIN existed has neither, and is asked only when GST itself is edited.
 */
export function billingErrors(
  values: BillingValues,
  type: EmploymentType,
  options: { requireRate?: boolean; checkGst?: boolean } = {},
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!isConsultant(type)) return errors;
  if (options.requireRate && values.pay_basis === "fixed_monthly") {
    const fee = values.monthly_fee.trim();
    if (!fee) errors.monthly_fee = "Enter their monthly fee.";
    else if (!FEE.test(fee) || Number(fee) <= 0) errors.monthly_fee = "An amount in rupees, like 100000.";
    if (!values.fee_from) errors.fee_from = "Choose the day this fee starts.";
  } else if (options.requireRate) {
    const rate = values.hourly_rate.trim();
    if (!rate) errors.hourly_rate = "Enter their rate for an hour.";
    else if (!RATE.test(rate) || Number(rate) <= 0) errors.hourly_rate = "An amount in rupees, like 1500.";
    if (!values.rate_from) errors.rate_from = "Choose the day this rate starts.";
  }
  if (values.gst_applicable === "yes" && options.checkGst !== false) {
    const rate = values.gst_rate.trim();
    if (!rate) errors.gst_rate = "Enter the GST rate, or set GST applicable to No.";
    else if (!PERCENT.test(rate) || Number(rate) > 100) errors.gst_rate = "A percentage from 0 to 100, like 18.";
    const gstin = values.gstin.trim();
    if (!gstin) errors.gstin = "Enter the consultant's GSTIN, or set GST applicable to No.";
    else if (gstin.length > 15) errors.gstin = "A GSTIN is 15 characters.";
  }
  return errors;
}

/** What is sent: cleared for anybody who is not a consultant. */
export function billingPayload(values: BillingValues, type: EmploymentType) {
  if (!isConsultant(type)) {
    return {
      gst_applicable: false,
      gst_rate: null,
      gstin: null,
      tds_section: null,
      payee_kind: null,
      contract_end_date: null,
      timesheet_approver_route: null,
      customer_contact_name: null,
      customer_contact_email: null,
      internal_approver_user_id: null,
      pay_basis: null,
    };
  }
  const gstOn = values.gst_applicable === "yes";
  const text = (value: string) => value.trim() || null;
  return {
    gst_applicable: gstOn,
    gst_rate: gstOn ? text(values.gst_rate) : null,
    gstin: gstOn ? text(values.gstin) : null,
    tds_section: values.tds_section,
    payee_kind: values.payee_kind,
    contract_end_date: text(values.contract_end_date),
    // Hours are approved inside the company now; the customer route is retired.
    timesheet_approver_route: "internal" as const,
    internal_approver_user_id: values.internal_approver_user_id === NONE ? null : values.internal_approver_user_id,
    pay_basis: values.pay_basis,
  };
}

/**
 * A consultant's pay basis, their first hourly rate or monthly fee (at
 * onboarding), TDS section, payee kind, GST,
 * contract end and finance approver. Laid out as cells of the
 * surrounding two-column grid.
 */
export function ConsultantBillingFields({
  idPrefix,
  values,
  errors,
  onChange,
  showRate = false,
}: {
  idPrefix: string;
  values: BillingValues;
  errors: Record<string, string>;
  onChange: (values: BillingValues) => void;
  /** Ask for the first hourly rate or monthly fee and its start date (onboarding). */
  showRate?: boolean;
}) {
  const people = usePeople();
  const logins = (people.data ?? []).filter((p) => p.user_id);
  const set = <K extends keyof BillingValues>(key: K, value: BillingValues[K]) =>
    onChange({ ...values, [key]: value });

  return (
    <>
      <FormField
        htmlFor={`${idPrefix}-pay-basis`}
        label="Pay basis"
        hint={
          values.pay_basis === "fixed_monthly"
            ? "A fee each month, prorated by calendar days for a part month. Hours are recorded, not paid."
            : "Each approved hour is paid at their hourly rate."
        }
      >
        <Select value={values.pay_basis} onValueChange={(v) => set("pay_basis", v as ConsultantPayBasis)}>
          <SelectTrigger id={`${idPrefix}-pay-basis`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PAY_BASIS) as ConsultantPayBasis[]).map((key) => (
              <SelectItem key={key} value={key}>
                {PAY_BASIS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
      {showRate && values.pay_basis === "fixed_monthly" && (
        <>
          <FormField
            htmlFor={`${idPrefix}-monthly-fee`}
            label="Monthly fee (₹)"
            required
            hint="A full month pays this; a part month by calendar days."
            error={errors.monthly_fee}
          >
            <Input
              id={`${idPrefix}-monthly-fee`}
              inputMode="decimal"
              placeholder="e.g. 100000"
              value={values.monthly_fee}
              aria-invalid={Boolean(errors.monthly_fee)}
              onChange={(event) => set("monthly_fee", event.target.value)}
            />
          </FormField>
          <FormField
            htmlFor={`${idPrefix}-fee-from`}
            label="Fee applies from"
            required
            hint="Usually the day they start."
            error={errors.fee_from}
          >
            <DatePicker
              id={`${idPrefix}-fee-from`}
              value={values.fee_from}
              onChange={(v) => set("fee_from", v)}
              invalid={Boolean(errors.fee_from)}
            />
          </FormField>
        </>
      )}
      {showRate && values.pay_basis === "hourly" && (
        <>
          <FormField
            htmlFor={`${idPrefix}-hourly-rate`}
            label="Rate an hour (₹)"
            required
            hint="Each approved hour is paid at this rate."
            error={errors.hourly_rate}
          >
            <Input
              id={`${idPrefix}-hourly-rate`}
              inputMode="decimal"
              placeholder="e.g. 1500"
              value={values.hourly_rate}
              aria-invalid={Boolean(errors.hourly_rate)}
              onChange={(event) => set("hourly_rate", event.target.value)}
            />
          </FormField>
          <FormField
            htmlFor={`${idPrefix}-rate-from`}
            label="Rate applies from"
            required
            hint="Usually the day they start."
            error={errors.rate_from}
          >
            <DatePicker
              id={`${idPrefix}-rate-from`}
              value={values.rate_from}
              onChange={(v) => set("rate_from", v)}
              invalid={Boolean(errors.rate_from)}
            />
          </FormField>
        </>
      )}
      <FormField
        htmlFor={`${idPrefix}-tds-section`}
        label="TDS section"
        hint="Tax deducted from each payout."
      >
        <Select value={values.tds_section} onValueChange={(v) => set("tds_section", v as TdsSection)}>
          <SelectTrigger id={`${idPrefix}-tds-section`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(TDS_SECTION) as TdsSection[]).map((key) => (
              <SelectItem key={key} value={key}>
                {TDS_SECTION[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
      <FormField
        htmlFor={`${idPrefix}-payee-kind`}
        label="Paid as"
        hint="Only changes the 194C rate."
      >
        <Select value={values.payee_kind} onValueChange={(v) => set("payee_kind", v as PayeeKind)}>
          <SelectTrigger id={`${idPrefix}-payee-kind`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PAYEE_KIND) as PayeeKind[]).map((key) => (
              <SelectItem key={key} value={key}>
                {PAYEE_KIND[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
      <FormField htmlFor={`${idPrefix}-gst-applicable`} label="GST applicable">
        <Select
          value={values.gst_applicable}
          onValueChange={(v) =>
            onChange({
              ...values,
              gst_applicable: v as BillingValues["gst_applicable"],
              gst_rate: v === "yes" ? values.gst_rate || DEFAULT_GST_RATE : "",
              gstin: v === "yes" ? values.gstin : "",
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
        <>
          <FormField
            htmlFor={`${idPrefix}-gst-rate`}
            label="GST rate (%)"
            required
            hint="Added to each payout. No tax is deducted on the GST."
            error={errors.gst_rate}
          >
            <Input
              id={`${idPrefix}-gst-rate`}
              inputMode="decimal"
              value={values.gst_rate}
              aria-invalid={Boolean(errors.gst_rate)}
              onChange={(event) => set("gst_rate", event.target.value)}
            />
          </FormField>
          <FormField htmlFor={`${idPrefix}-gstin`} label="GSTIN" required error={errors.gstin}>
            <Input
              id={`${idPrefix}-gstin`}
              maxLength={15}
              value={values.gstin}
              aria-invalid={Boolean(errors.gstin)}
              onChange={(event) => set("gstin", event.target.value.toUpperCase())}
            />
          </FormField>
        </>
      )}
      <FormField
        htmlFor={`${idPrefix}-contract-end`}
        label="Contract ends"
        optional
        hint="Shown on their record. Nothing happens automatically."
      >
        <DatePicker
          id={`${idPrefix}-contract-end`}
          value={values.contract_end_date}
          onChange={(v) => set("contract_end_date", v)}
        />
      </FormField>
      <FormField
        htmlFor={`${idPrefix}-internal-approver`}
        label="Finance approver"
        optional
        hint="Enters and approves their billable hours. Without one, HR admins do."
      >
        <Select
          value={values.internal_approver_user_id}
          onValueChange={(v) => set("internal_approver_user_id", v)}
        >
          <SelectTrigger id={`${idPrefix}-internal-approver`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>No one in particular</SelectItem>
            {values.internal_approver_user_id !== NONE &&
              !logins.some((p) => p.user_id === values.internal_approver_user_id) && (
                <SelectItem value={values.internal_approver_user_id}>
                  Current approver (no longer active)
                </SelectItem>
              )}
            {logins.map((person) => (
              <SelectItem key={person.user_id} value={person.user_id as string}>
                {person.name}
                <span className="text-muted-foreground"> · {person.employee_code}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
    </>
  );
}
