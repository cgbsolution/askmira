"use client";

import { HandCoins, Loader2 } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import {
  apiErrorMessage,
  InlineProblem,
  isMoneyInput,
  isZero,
} from "@/components/payroll-ops/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { get, post } from "@/lib/api";
import type { EmployeeSummary } from "@/lib/types";
import type {
  LoanAccount,
  LoanApplyForInput,
  LoanApplyInput,
  LoanScheme,
} from "@/lib/types/payroll-ops";
import { formatMoney } from "@/lib/utils";

import { describeRate, Fact, isWholeNumber, LOAN_TYPE_LABEL } from "./common";
import { EmployeePicker } from "./EmployeePicker";

/**
 * Apply for a loan — for yourself (`POST /loans/mine`) or, for HR, on someone's
 * behalf (`POST /loans`).
 *
 * The scheme's limits are shown so the person knows them before asking, but
 * the server decides: eligibility such as months of service is checked there,
 * and its refusal is shown word for word.
 */
export function ApplyLoanDialog({
  mode,
  onCreated,
}: {
  mode: "self" | "for";
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [schemes, setSchemes] = useState<LoanScheme[] | null>(null);
  const [schemesError, setSchemesError] = useState<string | null>(null);
  const [employee, setEmployee] = useState<EmployeeSummary | null>(null);
  const [schemeId, setSchemeId] = useState("");
  const [principal, setPrincipal] = useState("");
  const [tenure, setTenure] = useState("");
  const [purpose, setPurpose] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setSchemes(null);
    setSchemesError(null);
    get<LoanScheme[]>("/loans/schemes")
      .then((rows) => {
        if (!cancelled) setSchemes(rows.filter((scheme) => scheme.active));
      })
      .catch((error) => {
        if (!cancelled) setSchemesError(apiErrorMessage(error, "Could not load loan schemes."));
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const scheme = useMemo(
    () => schemes?.find((candidate) => candidate.id === schemeId) ?? null,
    [schemes, schemeId],
  );

  const reset = () => {
    setEmployee(null);
    setSchemeId("");
    setPrincipal("");
    setTenure("");
    setPurpose("");
    setProblem(null);
  };

  const submit = async () => {
    if (mode === "for" && !employee) return setProblem("Choose the employee the loan is for.");
    if (!scheme) return setProblem("Choose a loan scheme.");
    if (!isMoneyInput(principal) || isZero(principal)) {
      return setProblem("Enter the amount in rupees, with at most two decimals.");
    }
    if (!isWholeNumber(tenure, 1, scheme.max_tenure_months)) {
      return setProblem(
        `Tenure must be a whole number of months, from 1 to ${scheme.max_tenure_months}.`,
      );
    }
    setProblem(null);
    setIsSubmitting(true);
    const base: LoanApplyInput = {
      scheme_id: scheme.id,
      principal: principal.trim(),
      tenure_months: Number(tenure.trim()),
      purpose: purpose.trim() || null,
    };
    try {
      const created =
        mode === "for" && employee
          ? await post<LoanAccount>("/loans", {
              ...base,
              employee_id: employee.id,
            } satisfies LoanApplyForInput)
          : await post<LoanAccount>("/loans/mine", base);
      toast.success(`Loan application for ${formatMoney(created.principal)} submitted`, {
        description: `EMI ${formatMoney(created.emi_amount)} over ${created.tenure_months} months.`,
      });
      setOpen(false);
      reset();
      onCreated();
    } catch (error) {
      setProblem(apiErrorMessage(error, "The application could not be submitted."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isSubmitting) return;
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant={mode === "self" ? "accent" : "default"} size="sm">
          <HandCoins /> {mode === "self" ? "Apply for a loan" : "Apply on behalf"}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "self" ? "Apply for a loan" : "Apply for a loan on behalf"}
          </DialogTitle>
          <DialogDescription>
            The EMI is recovered from salary in each payroll run once the loan is disbursed.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {mode === "for" && (
            <FormField htmlFor="apply-employee" label="Employee">
              <EmployeePicker
                id="apply-employee"
                value={employee}
                onChange={setEmployee}
                disabled={isSubmitting}
              />
            </FormField>
          )}

          <FormField htmlFor="apply-scheme" label="Scheme">
            {schemesError ? (
              <InlineProblem>{schemesError}</InlineProblem>
            ) : schemes === null ? (
              <Skeleton className="h-9 w-full" />
            ) : schemes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                There are no active loan schemes. HR has to set one up first.
              </p>
            ) : (
              <Select value={schemeId} onValueChange={setSchemeId} disabled={isSubmitting}>
                <SelectTrigger id="apply-scheme" className="w-full">
                  <SelectValue placeholder="Choose a scheme" />
                </SelectTrigger>
                <SelectContent>
                  {schemes.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          {scheme && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-md border border-border bg-muted/50 p-3">
              <Fact label="Type">{LOAN_TYPE_LABEL[scheme.loan_type]}</Fact>
              <Fact label="Interest">{describeRate(scheme.interest_rate, scheme.interest_type)}</Fact>
              <Fact label="Maximum amount">
                {scheme.max_amount ? (
                  <Money value={scheme.max_amount} />
                ) : scheme.max_amount_as_multiple_of_salary ? (
                  `${scheme.max_amount_as_multiple_of_salary} × monthly salary`
                ) : (
                  "No fixed cap"
                )}
              </Fact>
              <Fact label="Maximum tenure">{scheme.max_tenure_months} months</Fact>
              {scheme.eligibility_min_service_months > 0 && (
                <Fact label="Service needed">{scheme.eligibility_min_service_months} months</Fact>
              )}
              {scheme.moratorium_months > 0 && (
                <Fact label="Moratorium">{scheme.moratorium_months} months before EMIs start</Fact>
              )}
              <Fact label="Approval">
                {scheme.requires_approval ? "Needs HR approval" : "Not required"}
              </Fact>
            </dl>
          )}

          <div className="grid grid-cols-2 gap-3">
            <FormField htmlFor="apply-principal" label="Amount (₹)">
              <Input
                id="apply-principal"
                inputMode="decimal"
                className="tabular-nums"
                required
                value={principal}
                disabled={isSubmitting}
                onChange={(event) => setPrincipal(event.target.value)}
              />
            </FormField>
            <FormField htmlFor="apply-tenure" label="Tenure (months)">
              <Input
                id="apply-tenure"
                type="number"
                min={1}
                max={scheme?.max_tenure_months}
                step={1}
                className="tabular-nums"
                required
                value={tenure}
                disabled={isSubmitting}
                onChange={(event) => setTenure(event.target.value)}
              />
            </FormField>
          </div>

          <FormField htmlFor="apply-purpose" label="Purpose" optional>
            <Textarea
              id="apply-purpose"
              rows={2}
              maxLength={500}
              value={purpose}
              disabled={isSubmitting}
              onChange={(event) => setPurpose(event.target.value)}
            />
          </FormField>

          {problem && <InlineProblem>{problem}</InlineProblem>}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={isSubmitting} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={isSubmitting || !schemes?.length} onClick={() => void submit()}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            Submit application
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
