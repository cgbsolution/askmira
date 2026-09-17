"use client";

import { Calculator, Loader2 } from "lucide-react";
import React, { useState } from "react";

import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import { apiErrorMessage, InlineProblem, isMoneyInput } from "@/components/payroll-ops/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { post } from "@/lib/api";
import type { NoticeRecoveryInput, NoticeRecoveryResult } from "@/lib/types/payroll-ops";

/**
 * Work out a notice-shortfall recovery. The server does the arithmetic; the
 * wage it is based on is whatever the employment contract says.
 */
export function NoticeRecoveryCalculator() {
  const [shortfall, setShortfall] = useState("");
  const [wage, setWage] = useState("");
  const [daysInMonth, setDaysInMonth] = useState("");
  const [basisLabel, setBasisLabel] = useState("");
  const [touched, setTouched] = useState(false);
  const [result, setResult] = useState<NoticeRecoveryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const shortfallProblem = /^\d+$/.test(shortfall.trim()) && Number(shortfall) > 0
    ? null
    : "Enter the shortfall as a whole number of days, at least 1.";
  const wageProblem = isMoneyInput(wage) ? null : "Enter the monthly wage in rupees.";
  const daysProblem =
    /^\d+$/.test(daysInMonth.trim()) && Number(daysInMonth) >= 1 && Number(daysInMonth) <= 31
      ? null
      : "Enter the days in the month, 1 to 31.";
  const basisProblem = basisLabel.trim() ? null : "Name the wage basis, e.g. \"Basic + DA\".";
  const isValid = !shortfallProblem && !wageProblem && !daysProblem && !basisProblem;

  const change = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setResult(null);
  };

  const calculate = async () => {
    setTouched(true);
    if (!isValid) return;
    const input: NoticeRecoveryInput = {
      shortfall_days: Number(shortfall.trim()),
      monthly_wage: wage.trim(),
      days_in_month: Number(daysInMonth.trim()),
      wage_basis_label: basisLabel.trim(),
    };
    setIsBusy(true);
    setError(null);
    try {
      setResult(await post<NoticeRecoveryResult>("/exits/notice-recovery", input));
    } catch (caught) {
      setResult(null);
      setError(apiErrorMessage(caught, "The recovery could not be calculated."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Card tier="tier1" className="max-w-2xl">
      <CardHeader>
        <CardTitle>Notice recovery calculator</CardTitle>
        <CardDescription>
          Which wage the recovery is based on (basic, basic + DA, gross) is a contractual term —
          take it from the employee&apos;s appointment letter, not from habit. The figure is a
          working to use in the settlement; nothing is saved here.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="recovery-shortfall"
            label="Shortfall days"
            value={shortfall}
            onChange={change(setShortfall)}
            problem={touched ? shortfallProblem : null}
            inputMode="numeric"
            disabled={isBusy}
          />
          <Field
            id="recovery-days-in-month"
            label="Days in the month"
            value={daysInMonth}
            onChange={change(setDaysInMonth)}
            problem={touched ? daysProblem : null}
            inputMode="numeric"
            disabled={isBusy}
          />
          <Field
            id="recovery-wage"
            label="Monthly wage (₹)"
            value={wage}
            onChange={change(setWage)}
            problem={touched ? wageProblem : null}
            inputMode="decimal"
            disabled={isBusy}
          />
          <Field
            id="recovery-basis"
            label="Wage basis"
            value={basisLabel}
            onChange={change(setBasisLabel)}
            problem={touched ? basisProblem : null}
            placeholder="As the contract defines it"
            disabled={isBusy}
          />
        </div>

        <Button disabled={isBusy} onClick={() => void calculate()}>
          {isBusy ? <Loader2 className="animate-spin" /> : <Calculator />}
          Calculate
        </Button>

        {error && <InlineProblem>{error}</InlineProblem>}

        {result && (
          <div className="rounded-md border border-border bg-muted/50 px-4 py-3">
            <p className="text-xs text-muted-foreground">Recovery</p>
            <p className="text-xl font-semibold text-foreground">
              <Money value={result.amount} />
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{result.basis}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  problem,
  inputMode,
  placeholder,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  problem: string | null;
  inputMode?: "numeric" | "decimal";
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <FormField htmlFor={id} label={label} error={problem}>
      <Input
        id={id}
        value={value}
        inputMode={inputMode}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={Boolean(problem)}
        className="tabular-nums"
        onChange={(event) => onChange(event.target.value)}
      />
    </FormField>
  );
}
