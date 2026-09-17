"use client";

import { Info, Loader2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { Money } from "@/components/common/Money";
import { pluralCount } from "@/components/exits/common";
import {
  apiErrorMessage,
  InlineProblem,
  isMoneyInput,
  isZero,
  QueryBoundary,
} from "@/components/payroll-ops/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type {
  Settlement,
  SettlementComputeInput,
  SettlementSources,
} from "@/lib/types/payroll-ops";

type Key = keyof SettlementComputeInput;

interface Row {
  amount: Key;
  basis: Key;
  label: string;
  /** May be negative (a tax refund). */
  signed?: boolean;
}

const SECTIONS: { title: string; hint: string; rows: Row[] }[] = [
  {
    title: "Earnings",
    hint: "Paid to the employee.",
    rows: [
      { amount: "final_month_salary", basis: "final_month_basis", label: "Final month salary" },
      { amount: "leave_encashment", basis: "leave_encashment_basis", label: "Leave encashment" },
      { amount: "gratuity", basis: "gratuity_basis", label: "Gratuity" },
      {
        amount: "pending_reimbursements",
        basis: "reimbursement_basis",
        label: "Pending reimbursements",
      },
      { amount: "pro_rata_bonus", basis: "bonus_basis", label: "Pro-rata bonus" },
      { amount: "pending_arrears", basis: "arrears_basis", label: "Pending arrears" },
    ],
  },
  {
    title: "Recoveries",
    hint: "Deducted from what is paid. Clearance recoveries are added by the server.",
    rows: [
      { amount: "notice_shortfall", basis: "notice_basis", label: "Notice shortfall recovery" },
      { amount: "loan_outstanding", basis: "loan_basis", label: "Loan outstanding" },
      { amount: "excess_leave_taken", basis: "excess_leave_basis", label: "Excess leave taken" },
      { amount: "other_recoveries", basis: "other_recovery_basis", label: "Other recoveries" },
    ],
  },
  {
    title: "Tax",
    hint: "Signed: a negative figure is a refund to the employee.",
    rows: [{ amount: "final_tds", basis: "tax_basis", label: "Final TDS", signed: true }],
  },
];

function emptyForm(): SettlementComputeInput {
  const form = {} as SettlementComputeInput;
  for (const section of SECTIONS) {
    for (const row of section.rows) {
      form[row.amount] = "0";
      form[row.basis] = "";
    }
  }
  return form;
}

function rowProblem(form: SettlementComputeInput, row: Row): string | null {
  const amount = form[row.amount].trim();
  if (!isMoneyInput(amount, { allowNegative: row.signed })) {
    return row.signed
      ? "Enter an amount in rupees, up to two decimals; negative for a refund."
      : "Enter an amount in rupees, up to two decimals.";
  }
  if (!isZero(amount) && form[row.basis].trim() === "") {
    return "Give the basis for this figure — the employee reads the statement line by line.";
  }
  return null;
}

/**
 * Compute a full & final settlement. The form is prefilled from figures other
 * modules already hold (labelled with where each came from); every non-zero
 * figure needs a basis before it is sent.
 */
export function ComputeSettlementDialog({
  exitId,
  employeeLabel,
  onClose,
  onComputed,
}: {
  exitId: string | null;
  employeeLabel: string;
  onClose: () => void;
  onComputed: (settlement: Settlement) => void;
}) {
  const sources = useApiQuery<SettlementSources>(
    exitId ? `/exits/${exitId}/settlement/sources` : null,
  );
  const current = sources.data && sources.data.exit_id === exitId ? sources.data : null;

  const [form, setForm] = useState<SettlementComputeInput>(emptyForm);
  const [prefilledFrom, setPrefilledFrom] = useState<Partial<Record<Key, string>>>({});
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!current) return;
    const next = emptyForm();
    const from: Partial<Record<Key, string>> = {};
    for (const suggestion of current.suggestions) {
      next[suggestion.field] = suggestion.amount;
      next[suggestion.basis_field] = suggestion.basis;
      from[suggestion.field] = suggestion.source;
    }
    setForm(next);
    setPrefilledFrom(from);
    setTouched(false);
    setError(null);
  }, [current]);

  const problems = SECTIONS.flatMap((section) =>
    section.rows.map((row) => [row.amount, rowProblem(form, row)] as const),
  );
  const problemFor = new Map(problems);
  const isValid = problems.every(([, problem]) => problem === null);

  const close = () => {
    if (isSaving) return;
    setTouched(false);
    setError(null);
    onClose();
  };

  const submit = async () => {
    setTouched(true);
    if (!exitId || !isValid) return;
    const payload = Object.fromEntries(
      Object.entries(form).map(([key, value]) => [key, value.trim()]),
    ) as unknown as SettlementComputeInput;
    setIsSaving(true);
    setError(null);
    try {
      const settlement = await post<Settlement>(`/exits/${exitId}/settlement`, payload);
      toast.success(`Settlement computed for ${settlement.employee_name ?? employeeLabel}`);
      setTouched(false);
      onComputed(settlement);
    } catch (caught) {
      setError(apiErrorMessage(caught, "The settlement could not be computed."));
    } finally {
      setIsSaving(false);
    }
  };

  const set = (key: Key, value: string) => setForm((previous) => ({ ...previous, [key]: value }));

  return (
    <Dialog open={exitId !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Compute full &amp; final settlement</DialogTitle>
          <DialogDescription>{employeeLabel}</DialogDescription>
        </DialogHeader>

        <QueryBoundary query={{ ...sources, data: current }} skeletonRows={6}>
          {(data) => (
            <div className="grid gap-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-border px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">Notice</p>
                  <p className="text-sm text-foreground tabular-nums">
                    {data.notice.shortfall_days > 0
                      ? `Short by ${pluralCount(data.notice.shortfall_days, "day")}`
                      : "No shortfall"}
                  </p>
                  {data.notice.shortfall_days > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {data.notice.waived
                        ? `Recovery waived${data.notice.waiver_reason ? `: ${data.notice.waiver_reason}` : ""}`
                        : "Not waived — enter the recovery below, with its basis."}
                    </p>
                  )}
                </div>
                <div className="rounded-md border border-border px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">
                    Clearance recovery (added by the server)
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    <Money value={data.clearance_recovery} />
                  </p>
                  {data.clearance_basis && (
                    <p className="text-xs text-muted-foreground">{data.clearance_basis}</p>
                  )}
                </div>
              </div>

              {data.notes.length > 0 && (
                <Alert>
                  <Info />
                  <AlertTitle>Notes</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc space-y-0.5 pl-4">
                      {data.notes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {SECTIONS.map((section) => (
                <fieldset key={section.title} className="grid gap-3">
                  <legend className="mb-1">
                    <span className="text-sm font-semibold text-foreground">{section.title}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{section.hint}</span>
                  </legend>
                  {section.rows.map((row) => {
                    const problem = touched ? problemFor.get(row.amount) : null;
                    const source = prefilledFrom[row.amount];
                    return (
                      <div
                        key={row.amount}
                        className="grid gap-2 rounded-md border border-border px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_9rem_minmax(0,1.4fr)] sm:items-start"
                      >
                        <div className="flex flex-wrap items-center gap-1.5 sm:pt-2">
                          <Label htmlFor={`settlement-${row.amount}`}>{row.label}</Label>
                          {source && <Badge variant="secondary">From {source}</Badge>}
                        </div>
                        <Input
                          id={`settlement-${row.amount}`}
                          inputMode="decimal"
                          value={form[row.amount]}
                          disabled={isSaving}
                          aria-label={`${row.label} amount`}
                          aria-invalid={Boolean(problem)}
                          className="text-right tabular-nums"
                          onChange={(event) => set(row.amount, event.target.value)}
                        />
                        <Input
                          id={`settlement-${row.basis}`}
                          value={form[row.basis]}
                          disabled={isSaving}
                          maxLength={500}
                          aria-label={`${row.label} basis`}
                          aria-invalid={Boolean(problem) && !isZero(form[row.amount])}
                          placeholder="Basis, e.g. 18 days at ₹2,000/day"
                          onChange={(event) => set(row.basis, event.target.value)}
                        />
                        {problem && (
                          <p className="text-xs text-destructive sm:col-span-3">{problem}</p>
                        )}
                      </div>
                    );
                  })}
                </fieldset>
              ))}

              <p className="text-xs text-muted-foreground">
                Tax on the settlement is recomputed from the actual figures and needs Compliance
                SME review before it is relied on.
              </p>

              {touched && !isValid && (
                <InlineProblem>Some figures need attention before this can be computed.</InlineProblem>
              )}
              {error && <InlineProblem>{error}</InlineProblem>}
            </div>
          )}
        </QueryBoundary>

        <DialogFooter>
          <Button variant="outline" disabled={isSaving} onClick={close}>
            Cancel
          </Button>
          <Button disabled={isSaving || !current} onClick={() => void submit()}>
            {isSaving && <Loader2 className="animate-spin" />}
            Compute settlement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
