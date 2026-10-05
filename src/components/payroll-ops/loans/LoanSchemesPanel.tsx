"use client";

import { Landmark, Loader2, Plus } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import { apiErrorMessage, InlineProblem, isMoneyInput } from "@/components/payroll-ops/shared";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { InterestType, LoanScheme, LoanSchemeInput, LoanType } from "@/lib/types/payroll-ops";

import {
  ADMIN_ROLES,
  describeRate,
  INTEREST_TYPE_LABEL,
  isWholeNumber,
  LOAN_TYPE_LABEL,
  ToggleRow,
} from "./common";
import { QueryPanel } from "./QueryPanel";

/** Loan schemes: the limits every application and every EMI is held to. */
export function LoanSchemesPanel() {
  const { hasRole } = useAuth();
  const query = useApiQuery<LoanScheme[]>("/loans/schemes");
  const isAdmin = hasRole(...ADMIN_ROLES);

  return (
    <QueryPanel
      query={query}
      title="Loan schemes"
      description="Each scheme sets the limits an application is checked against, and the minimum net pay an EMI recovery may never push salary below."
      actions={isAdmin && <CreateSchemeDialog onCreated={query.reload} />}
      isEmpty={(rows) => rows.length === 0}
      empty={{
        icon: Landmark,
        title: "No loan schemes yet",
        description: isAdmin
          ? "Create a scheme before anyone can apply for a loan."
          : "An admin has to create a scheme before anyone can apply for a loan.",
      }}
    >
      {(schemes) => (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Scheme</TableHead>
              <TableHead>Interest</TableHead>
              <TableHead className="text-right">Max amount</TableHead>
              <TableHead className="text-right">Max tenure</TableHead>
              <TableHead className="text-right">Service needed</TableHead>
              <TableHead className="text-right">Moratorium</TableHead>
              <TableHead className="text-right">Min net pay</TableHead>
              <TableHead>Rules</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schemes.map((scheme) => (
              <TableRow key={scheme.id}>
                <TableCell>
                  <span className="font-medium text-foreground">{scheme.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {LOAN_TYPE_LABEL[scheme.loan_type]}
                  </span>
                </TableCell>
                <TableCell className="text-sm">
                  {describeRate(scheme.interest_rate, scheme.interest_type)}
                </TableCell>
                <TableCell className="text-right">
                  {scheme.max_amount ? (
                    <Money value={scheme.max_amount} />
                  ) : scheme.max_amount_as_multiple_of_salary ? (
                    <span className="tabular-nums">
                      {scheme.max_amount_as_multiple_of_salary} × salary
                    </span>
                  ) : (
                    <span className="text-muted-foreground">No cap</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{scheme.max_tenure_months} mo</TableCell>
                <TableCell className="text-right tabular-nums">
                  {scheme.eligibility_min_service_months} mo
                </TableCell>
                <TableCell className="text-right tabular-nums">{scheme.moratorium_months} mo</TableCell>
                <TableCell className="text-right">
                  <Money value={scheme.minimum_net_pay} />
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {!scheme.active && <Badge variant="muted">Inactive</Badge>}
                    {scheme.requires_approval && <Badge variant="outline">Needs approval</Badge>}
                    {scheme.allow_partial_recovery && <Badge variant="outline">Partial recovery</Badge>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </QueryPanel>
  );
}

function CreateSchemeDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [loanType, setLoanType] = useState<LoanType>("company_loan");
  const [interestType, setInterestType] = useState<InterestType>("reducing");
  const [rate, setRate] = useState("");
  const [maxTenure, setMaxTenure] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [maxMultiple, setMaxMultiple] = useState("");
  const [minService, setMinService] = useState("0");
  const [moratorium, setMoratorium] = useState("0");
  const [accrueDuringMoratorium, setAccrueDuringMoratorium] = useState(false);
  const [minNetPay, setMinNetPay] = useState("");
  const [partialRecovery, setPartialRecovery] = useState(true);
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [problem, setProblem] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const reset = () => {
    setName("");
    setLoanType("company_loan");
    setInterestType("reducing");
    setRate("");
    setMaxTenure("");
    setMaxAmount("");
    setMaxMultiple("");
    setMinService("0");
    setMoratorium("0");
    setAccrueDuringMoratorium(false);
    setMinNetPay("");
    setPartialRecovery(true);
    setRequiresApproval(true);
    setProblem(null);
  };

  const isFree = interestType === "interest_free";

  const submit = async () => {
    if (!name.trim()) return setProblem("Give the scheme a name.");
    if (!isFree && !/^\d+(\.\d{1,4})?$/.test(rate.trim())) {
      return setProblem("Enter the annual interest rate as a percentage, e.g. 9.5.");
    }
    if (!isWholeNumber(maxTenure, 1)) return setProblem("Maximum tenure must be at least 1 month.");
    if (maxAmount.trim() && !isMoneyInput(maxAmount)) {
      return setProblem("Maximum amount must be in rupees, with at most two decimals.");
    }
    if (maxMultiple.trim() && !/^\d+(\.\d{1,2})?$/.test(maxMultiple.trim())) {
      return setProblem("The salary multiple must be a number such as 2 or 1.5.");
    }
    if (!isWholeNumber(minService)) return setProblem("Service needed must be a whole number of months.");
    if (!isWholeNumber(moratorium)) return setProblem("Moratorium must be a whole number of months.");
    if (!isMoneyInput(minNetPay)) {
      return setProblem("Minimum net pay is required, in rupees with at most two decimals.");
    }
    setProblem(null);
    setIsBusy(true);
    const body: LoanSchemeInput = {
      name: name.trim(),
      loan_type: loanType,
      interest_type: interestType,
      interest_rate: isFree ? "0" : rate.trim(),
      max_tenure_months: Number(maxTenure.trim()),
      max_amount: maxAmount.trim() || null,
      max_amount_as_multiple_of_salary: maxMultiple.trim() || null,
      eligibility_min_service_months: Number(minService.trim()),
      moratorium_months: Number(moratorium.trim()),
      accrue_interest_during_moratorium: accrueDuringMoratorium,
      minimum_net_pay: minNetPay.trim(),
      allow_partial_recovery: partialRecovery,
      requires_approval: requiresApproval,
    };
    try {
      await post<LoanScheme>("/loans/schemes", body);
      toast.success(`Scheme “${body.name}” created`);
      setOpen(false);
      reset();
      onCreated();
    } catch (error) {
      setProblem(apiErrorMessage(error, "The scheme could not be created."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isBusy) return;
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus /> New scheme
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New loan scheme</DialogTitle>
          <DialogDescription>
            Applications under this scheme are checked against these limits by the server.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <FormField htmlFor="scheme-name" label="Name">
            <Input
              id="scheme-name"
              required
              value={name}
              disabled={isBusy}
              onChange={(event) => setName(event.target.value)}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField htmlFor="scheme-type" label="Loan type">
              <Select
                value={loanType}
                disabled={isBusy}
                onValueChange={(value) => setLoanType(value as LoanType)}
              >
                <SelectTrigger id="scheme-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(LOAN_TYPE_LABEL) as LoanType[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {LOAN_TYPE_LABEL[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField htmlFor="scheme-interest-type" label="Interest">
              <Select
                value={interestType}
                disabled={isBusy}
                onValueChange={(value) => setInterestType(value as InterestType)}
              >
                <SelectTrigger id="scheme-interest-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(INTEREST_TYPE_LABEL) as InterestType[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {INTEREST_TYPE_LABEL[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField htmlFor="scheme-rate" label="Annual rate (%)">
              <Input
                id="scheme-rate"
                inputMode="decimal"
                className="tabular-nums"
                required={!isFree}
                value={isFree ? "0" : rate}
                disabled={isBusy || isFree}
                onChange={(event) => setRate(event.target.value)}
              />
            </FormField>
            <FormField htmlFor="scheme-tenure" label="Maximum tenure (months)">
              <Input
                id="scheme-tenure"
                type="number"
                min={1}
                step={1}
                className="tabular-nums"
                required
                value={maxTenure}
                disabled={isBusy}
                onChange={(event) => setMaxTenure(event.target.value)}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField htmlFor="scheme-max-amount" label="Maximum amount (₹)" optional>
              <Input
                id="scheme-max-amount"
                inputMode="decimal"
                className="tabular-nums"
                value={maxAmount}
                disabled={isBusy}
                onChange={(event) => setMaxAmount(event.target.value)}
              />
            </FormField>
            <FormField htmlFor="scheme-multiple" label="Or × monthly salary" optional>
              <Input
                id="scheme-multiple"
                inputMode="decimal"
                className="tabular-nums"
                value={maxMultiple}
                disabled={isBusy}
                onChange={(event) => setMaxMultiple(event.target.value)}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField htmlFor="scheme-service" label="Service needed (months)">
              <Input
                id="scheme-service"
                type="number"
                min={0}
                step={1}
                className="tabular-nums"
                required
                value={minService}
                disabled={isBusy}
                onChange={(event) => setMinService(event.target.value)}
              />
            </FormField>
            <FormField htmlFor="scheme-moratorium" label="Moratorium (months)">
              <Input
                id="scheme-moratorium"
                type="number"
                min={0}
                step={1}
                className="tabular-nums"
                required
                value={moratorium}
                disabled={isBusy}
                onChange={(event) => setMoratorium(event.target.value)}
              />
            </FormField>
          </div>

          <FormField
            htmlFor="scheme-min-net-pay"
            label="Minimum net pay (₹)"
            hint="The floor an EMI may never breach. When recovering the full EMI in a payroll run would leave take-home pay below this amount, the run recovers less (or nothing) and carries the rest forward, rather than leaving the employee short."
          >
            <Input
              id="scheme-min-net-pay"
              inputMode="decimal"
              className="tabular-nums"
              required
              value={minNetPay}
              disabled={isBusy}
              onChange={(event) => setMinNetPay(event.target.value)}
            />
          </FormField>

          <ToggleRow
            id="scheme-accrue"
            label="Charge interest during the moratorium"
            checked={accrueDuringMoratorium}
            disabled={isBusy}
            onChange={setAccrueDuringMoratorium}
          />
          <ToggleRow
            id="scheme-partial"
            label="Allow partial recovery"
            hint="Recover what fits above the net-pay floor instead of skipping the month."
            checked={partialRecovery}
            disabled={isBusy}
            onChange={setPartialRecovery}
          />
          <ToggleRow
            id="scheme-approval"
            label="Requires approval"
            checked={requiresApproval}
            disabled={isBusy}
            onChange={setRequiresApproval}
          />

          {problem && <InlineProblem>{problem}</InlineProblem>}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={isBusy} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={isBusy} onClick={() => void submit()}>
            {isBusy && <Loader2 className="animate-spin" />}
            Create scheme
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
