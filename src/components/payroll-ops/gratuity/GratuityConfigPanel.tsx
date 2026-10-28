"use client";

import { Scale, ShieldCheck } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { FormField } from "@/components/common/FormField";
import { isWholeNumber, ToggleRow } from "@/components/payroll-ops/loans/common";
import { InlineProblem, isMoneyInput, toastApiError } from "@/components/payroll-ops/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { post, put } from "@/lib/api";
import type {
  ExitReason,
  GratuityConfig,
  GratuityConfigInput,
  ServiceRounding,
} from "@/lib/types/payroll-ops";
import { formatDate } from "@/lib/utils";

import { EXIT_REASON_LABEL, SERVICE_ROUNDING_LABEL } from "./common";
import { TextField } from "./TextField";
import { FieldLegend, FieldSet } from "@/components/ui/field";

interface FormState {
  eligibilityYears: string;
  daysInFinalYear: string;
  formulaBasis: string;
  divisor: string;
  daysPerYear: string;
  maxExempt: string;
  maxPayable: string;
  rounding: ServiceRounding | "";
  breakThreshold: string;
  includeNotice: boolean;
  waived: ExitReason[];
}

function toForm(config: GratuityConfig | null): FormState {
  return {
    eligibilityYears: config ? String(config.eligibility_years) : "",
    daysInFinalYear:
      config?.eligibility_days_in_final_year === null || !config
        ? ""
        : String(config.eligibility_days_in_final_year),
    formulaBasis: config ? config.formula_basis.join(", ") : "",
    divisor: config ? String(config.days_per_year_divisor) : "",
    daysPerYear: config?.days_per_year ?? "",
    maxExempt: config?.max_exempt_amount ?? "",
    maxPayable: config?.max_payable_amount ?? "",
    rounding: config?.service_rounding ?? "",
    breakThreshold:
      config?.unpaid_leave_break_threshold_days === null || !config
        ? ""
        : String(config.unpaid_leave_break_threshold_days),
    includeNotice: config?.include_notice_period_in_service ?? false,
    waived: config?.eligibility_waived_reasons.filter(
      (reason): reason is ExitReason => reason in EXIT_REASON_LABEL,
    ) ?? [],
  };
}

/**
 * The gratuity rules. Every number here is configuration, and nothing computes
 * until a Compliance SME has approved the saved version.
 */
export function GratuityConfigPanel({
  config,
  isAdmin,
  onChanged,
}: {
  config: GratuityConfig | null;
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => toForm(config));
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, setPending] = useState<GratuityConfigInput | null>(null);
  const [confirmApprove, setConfirmApprove] = useState(false);

  useEffect(() => {
    setForm(toForm(config));
  }, [config]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const validate = (): GratuityConfigInput | null => {
    const fail = (message: string) => {
      setProblem(message);
      return null;
    };
    if (!isWholeNumber(form.eligibilityYears)) {
      return fail("Years of service needed must be a whole number.");
    }
    if (form.daysInFinalYear.trim() && !isWholeNumber(form.daysInFinalYear, 0, 366)) {
      return fail("Days in the final year must be a whole number up to 366, or left blank.");
    }
    const basis = form.formulaBasis
      .split(",")
      .map((code) => code.trim())
      .filter(Boolean);
    if (basis.length === 0) return fail("List at least one salary component code for the wage basis.");
    if (!isWholeNumber(form.divisor, 1)) return fail("The days divisor must be a whole number above 0.");
    if (!/^\d+(\.\d{1,2})?$/.test(form.daysPerYear.trim())) {
      return fail("Days of wages per year must be a number, e.g. 15.");
    }
    if (!isMoneyInput(form.maxExempt)) {
      return fail("The exemption ceiling is required, in rupees with at most two decimals.");
    }
    if (form.maxPayable.trim() && !isMoneyInput(form.maxPayable)) {
      return fail("The payable ceiling must be in rupees, or left blank for none.");
    }
    if (!form.rounding) return fail("Choose how part-years of service are rounded.");
    if (form.breakThreshold.trim() && !isWholeNumber(form.breakThreshold)) {
      return fail("The unpaid-leave threshold must be a whole number of days, or left blank.");
    }
    setProblem(null);
    return {
      eligibility_years: Number(form.eligibilityYears.trim()),
      eligibility_days_in_final_year: form.daysInFinalYear.trim()
        ? Number(form.daysInFinalYear.trim())
        : null,
      formula_basis: basis,
      days_per_year_divisor: Number(form.divisor.trim()),
      days_per_year: form.daysPerYear.trim(),
      max_exempt_amount: form.maxExempt.trim(),
      max_payable_amount: form.maxPayable.trim() || null,
      service_rounding: form.rounding,
      unpaid_leave_break_threshold_days: form.breakThreshold.trim()
        ? Number(form.breakThreshold.trim())
        : null,
      include_notice_period_in_service: form.includeNotice,
      eligibility_waived_reasons: form.waived,
    };
  };

  const save = async () => {
    if (!pending) return;
    try {
      await put<GratuityConfig>("/gratuity/config", pending);
      toast.success("Gratuity configuration saved", {
        description: "It needs Compliance SME approval before anything computes.",
      });
      onChanged();
    } catch (error) {
      toastApiError(error, "The configuration could not be saved.");
      throw error;
    }
  };

  const approve = async () => {
    try {
      await post("/gratuity/config/approve");
      toast.success("Configuration approved");
      onChanged();
    } catch (error) {
      toastApiError(error, "The configuration could not be approved.");
      throw error;
    }
  };

  const disabled = !isAdmin;

  return (
    <div className="space-y-4">
      <Alert>
        <Scale />
        <AlertTitle>Every number here is configuration</AlertTitle>
        <AlertDescription>
          AskMira does not assume any statutory figure. The service needed, the wage basis, the
          divisor and the ceilings are what your company enters, and the Compliance SME signs off.
        </AlertDescription>
      </Alert>

      {config && (
        <Card tier="tier1">
          <CardHeader>
            <CardTitle>Approval</CardTitle>
            <CardDescription>
              {config.is_approved
                ? `Approved by the Compliance SME${config.approved_at ? ` on ${formatDate(config.approved_at)}` : ""}. Accruals and payouts use this version.`
                : "Not approved. Accruals, liability and payouts are refused until the Compliance SME approves this version."}
            </CardDescription>
            {isAdmin && !config.is_approved && (
              <div className="col-start-2 row-span-2 row-start-1 self-start justify-self-end">
                <Button onClick={() => setConfirmApprove(true)}>
                  <ShieldCheck /> Record SME approval
                </Button>
              </div>
            )}
          </CardHeader>
        </Card>
      )}

      <Card tier="tier1">
        <CardHeader>
          <CardTitle>{config ? "Configuration" : "Set up gratuity"}</CardTitle>
          <CardDescription>
            {isAdmin
              ? "Saving any change clears the SME approval."
              : "Only an admin can change the configuration."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              id="gc-years"
              label="Years of service needed"
              value={form.eligibilityYears}
              disabled={disabled}
              required
              numeric
              onChange={(value) => set("eligibilityYears", value)}
            />
            <TextField
              id="gc-final-year"
              label="Days in the final year that count as a full year"
              value={form.daysInFinalYear}
              disabled={disabled}
              numeric
              optional
              hint="Whether part of a final year of service counts towards eligibility is contested ground. Enter what your company's counsel has decided; leave blank to count completed years only."
              onChange={(value) => set("daysInFinalYear", value)}
            />
            <TextField
              id="gc-basis"
              className="md:col-span-2"
              label="Wage basis (salary component codes, comma-separated)"
              value={form.formulaBasis}
              disabled={disabled}
              required
              onChange={(value) => set("formulaBasis", value)}
            />
            <TextField
              id="gc-days-per-year"
              label="Days of wages per year of service"
              value={form.daysPerYear}
              disabled={disabled}
              required
              numeric
              onChange={(value) => set("daysPerYear", value)}
            />
            <TextField
              id="gc-divisor"
              label="Divisor for a day's wage"
              value={form.divisor}
              disabled={disabled}
              required
              numeric
              onChange={(value) => set("divisor", value)}
            />
            <TextField
              id="gc-max-exempt"
              label="Tax-exempt ceiling (₹)"
              value={form.maxExempt}
              disabled={disabled}
              required
              numeric
              onChange={(value) => set("maxExempt", value)}
            />
            <TextField
              id="gc-max-payable"
              label="Payable ceiling (₹)"
              value={form.maxPayable}
              disabled={disabled}
              numeric
              optional
              onChange={(value) => set("maxPayable", value)}
            />
            <FormField htmlFor="gc-rounding" label="Rounding part-years of service">
              <Select
                value={form.rounding}
                disabled={disabled}
                onValueChange={(value) => set("rounding", value as ServiceRounding)}
              >
                <SelectTrigger id="gc-rounding" className="w-full">
                  <SelectValue placeholder="Choose a rule" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SERVICE_ROUNDING_LABEL) as ServiceRounding[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {SERVICE_ROUNDING_LABEL[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <TextField
              id="gc-break"
              label="Unpaid leave that breaks continuous service (days)"
              value={form.breakThreshold}
              disabled={disabled}
              numeric
              optional
              onChange={(value) => set("breakThreshold", value)}
            />
          </div>

          <ToggleRow
            id="gc-notice"
            label="Count the notice period as service"
            checked={form.includeNotice}
            disabled={disabled}
            onChange={(checked) => set("includeNotice", checked)}
          />

          <FieldSet className="gap-2">
            <FieldLegend className="text-sm font-medium text-foreground">
              Exit reasons that waive the service requirement
            </FieldLegend>
            <div className="grid gap-2 sm:grid-cols-3">
              {(Object.keys(EXIT_REASON_LABEL) as ExitReason[]).map((reason) => (
                <div key={reason} className="flex items-center gap-2">
                  <Checkbox
                    id={`gc-waive-${reason}`}
                    checked={form.waived.includes(reason)}
                    disabled={disabled}
                    onCheckedChange={(checked) =>
                      set(
                        "waived",
                        checked === true
                          ? [...form.waived, reason]
                          : form.waived.filter((item) => item !== reason),
                      )
                    }
                  />
                  <Label htmlFor={`gc-waive-${reason}`} className="font-normal">
                    {EXIT_REASON_LABEL[reason]}
                  </Label>
                </div>
              ))}
            </div>
          </FieldSet>

          {problem && <InlineProblem>{problem}</InlineProblem>}

          {isAdmin && (
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setForm(toForm(config));
                  setProblem(null);
                }}
              >
                Discard changes
              </Button>
              <Button
                onClick={() => {
                  const input = validate();
                  if (input) setPending(input);
                }}
              >
                Save configuration
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title="Save the gratuity configuration?"
        description={
          config?.is_approved
            ? "Saving clears the Compliance SME approval. Accruals, liability and payouts stop computing until this version is approved again."
            : "The saved version needs Compliance SME approval before anything computes."
        }
        confirmLabel="Save configuration"
        destructive={Boolean(config?.is_approved)}
        onConfirm={save}
      />
      <ConfirmDialog
        open={confirmApprove}
        onOpenChange={setConfirmApprove}
        title="Record Compliance SME approval?"
        description="Record this only once the Compliance SME has reviewed and signed off this exact configuration. Accruals and payouts start using it straight away."
        confirmLabel="Record approval"
        onConfirm={approve}
      />
    </div>
  );
}
