"use client";

import { AlertTriangle, CheckCircle2, Loader2, Receipt } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/common/EmptyState";
import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import {
  apiErrorMessage,
  formatPeriod,
  InlineProblem,
  isMoneyInput,
  isZero,
  QueryBoundary,
} from "@/components/payroll-ops/shared";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { LoanAccount, LoanDetail, LoanSchedule, PrepaymentInput } from "@/lib/types/payroll-ops";
import { formatDate, formatMoney, toISODate } from "@/lib/utils";

import { ADMIN_ROLES, describeRate, Fact, HR_ROLES, LoanStatusBadge } from "./common";

type Action = "approve" | "reject" | "disburse" | "prepay";

/**
 * One loan: its terms, the repayment schedule and what payroll has recovered.
 *
 * `mode="hr"` adds the decisions HR can take. Approve, reject and disburse are
 * hidden on the person's own loan — nobody decides their own — and the API
 * refuses them anyway.
 */
export function LoanDetailSheet({
  loanId,
  onClose,
  onChanged,
  mode,
}: {
  loanId: string | null;
  onClose: () => void;
  onChanged?: () => void;
  mode: "hr" | "self";
}) {
  const query = useApiQuery<LoanDetail>(loanId ? `/loans/${loanId}` : null);
  const [action, setAction] = useState<Action | null>(null);

  const changed = () => {
    query.reload();
    onChanged?.();
  };

  return (
    <Sheet open={loanId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader className="pr-10">
          <SheetTitle>
            {query.data && query.data.loan.id === loanId
              ? mode === "hr"
                ? `${query.data.loan.employee_name ?? "Employee"} · ${query.data.loan.scheme_name ?? "Loan"}`
                : (query.data.loan.scheme_name ?? "Loan")
              : "Loan"}
          </SheetTitle>
          <SheetDescription>
            Terms, repayment schedule and every recovery payroll has made against it.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-6">
          <QueryBoundary query={query} skeletonRows={6}>
            {(detail) =>
              detail.loan.id !== loanId ? null : (
                <div className="space-y-6">
                  <LoanSummary loan={detail.loan} mode={mode} onAction={setAction} />
                  <Separator />
                  <ScheduleSection schedule={detail.schedule} />
                  <Separator />
                  <RepaymentsSection detail={detail} />
                  {mode === "hr" && (
                    <LoanActionDialog
                      loan={detail.loan}
                      action={action}
                      onClose={() => setAction(null)}
                      onDone={changed}
                    />
                  )}
                </div>
              )
            }
          </QueryBoundary>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function LoanSummary({
  loan,
  mode,
  onAction,
}: {
  loan: LoanAccount;
  mode: "hr" | "self";
  onAction: (action: Action) => void;
}) {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole(...ADMIN_ROLES);
  const isHr = hasRole(...HR_ROLES);
  const isOwn = Boolean(user?.employee_id) && loan.employee_id === user?.employee_id;
  const canDecide = mode === "hr" && isAdmin && !isOwn;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <LoanStatusBadge status={loan.status} />
        {mode === "hr" && loan.employee_code && (
          <span className="text-sm text-muted-foreground">{loan.employee_code}</span>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          {canDecide && loan.status === "applied" && (
            <>
              <Button size="sm" variant="outline" onClick={() => onAction("reject")}>
                Reject
              </Button>
              <Button size="sm" onClick={() => onAction("approve")}>
                Approve
              </Button>
            </>
          )}
          {canDecide && loan.status === "approved" && (
            <Button size="sm" onClick={() => onAction("disburse")}>
              Mark disbursed
            </Button>
          )}
          {mode === "hr" && isHr && (loan.status === "disbursed" || loan.status === "active") && (
            <Button size="sm" variant="outline" onClick={() => onAction("prepay")}>
              Record prepayment
            </Button>
          )}
        </div>
      </div>
      {mode === "hr" && isOwn && loan.status === "applied" && (
        <p className="text-xs text-muted-foreground">
          This is your own loan, so someone else in HR has to decide it.
        </p>
      )}

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
        <Fact label="Principal">
          <Money value={loan.principal} />
        </Fact>
        <Fact label="Interest">{describeRate(loan.interest_rate, loan.interest_type)}</Fact>
        <Fact label="Tenure">{loan.tenure_months} months</Fact>
        <Fact label="Monthly EMI">
          <Money value={loan.emi_amount} />
        </Fact>
        <Fact label="Outstanding principal">
          <Money value={loan.outstanding_principal} />
        </Fact>
        {!isZero(loan.carried_forward) && (
          <Fact label="Carried forward">
            <Money value={loan.carried_forward} className="text-warning" />
          </Fact>
        )}
        <Fact label="Applied">{formatDate(loan.applied_at)}</Fact>
        {loan.approved_at && <Fact label="Approved">{formatDate(loan.approved_at)}</Fact>}
        {loan.disbursed_at && <Fact label="Disbursed">{formatDate(loan.disbursed_at)}</Fact>}
        {loan.closed_at && <Fact label="Closed">{formatDate(loan.closed_at)}</Fact>}
      </dl>
      {!isZero(loan.carried_forward) && (
        <p className="text-xs text-muted-foreground">
          Carried forward is EMI a payroll run could not recover without breaching the scheme&apos;s
          minimum net pay.
        </p>
      )}
      {loan.purpose && (
        <div>
          <p className="text-xs text-muted-foreground">Purpose</p>
          <p className="mt-0.5 text-sm text-foreground">{loan.purpose}</p>
        </div>
      )}
      {loan.decision_note && (
        <div>
          <p className="text-xs text-muted-foreground">Decision note</p>
          <p className="mt-0.5 text-sm text-foreground">{loan.decision_note}</p>
        </div>
      )}
    </div>
  );
}

function ScheduleSection({ schedule }: { schedule: LoanSchedule | null }) {
  if (!schedule) {
    return (
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Repayment schedule</h3>
        <p className="text-sm text-muted-foreground">
          The server returned no repayment schedule for this loan.
        </p>
      </section>
    );
  }
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-foreground">Repayment schedule</h3>
        {schedule.reconciles ? (
          <Badge variant="success">
            <CheckCircle2 /> Instalments tie out to the principal
          </Badge>
        ) : (
          <Badge variant="destructive">
            <AlertTriangle /> Instalments do not add up to the principal
          </Badge>
        )}
      </div>
      {!schedule.reconciles && (
        <InlineProblem>
          The instalments in this schedule do not sum to the principal. Do not recover against it
          until it has been checked.
        </InlineProblem>
      )}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        <Fact label="EMI">
          <Money value={schedule.emi} />
        </Fact>
        <Fact label="Annual rate">{schedule.annual_rate}%</Fact>
        <Fact label="Total principal">
          <Money value={schedule.total_principal} />
        </Fact>
        <Fact label="Total interest">
          <Money value={schedule.total_interest} />
        </Fact>
      </dl>
      {schedule.notes.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          {schedule.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
      <div className="max-h-80 overflow-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead className="text-right">EMI</TableHead>
              <TableHead className="text-right">Principal</TableHead>
              <TableHead className="text-right">Interest</TableHead>
              <TableHead className="text-right">Balance after</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedule.instalments.map((row) => (
              <TableRow key={row.number}>
                <TableCell className="tabular-nums">{row.number}</TableCell>
                <TableCell className="text-right">
                  <Money value={row.emi} />
                </TableCell>
                <TableCell className="text-right">
                  <Money value={row.principal} />
                </TableCell>
                <TableCell className="text-right">
                  <Money value={row.interest} />
                </TableCell>
                <TableCell className="text-right">
                  <Money value={row.closing_balance} />
                </TableCell>
                <TableCell>{row.is_moratorium && <Badge variant="muted">Moratorium</Badge>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

function RepaymentsSection({ detail }: { detail: LoanDetail }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Recoveries</h3>
      {detail.repayments.length === 0 ? (
        <EmptyState
          icon={Receipt}
          className="py-8"
          title="Nothing recovered yet"
          description="EMIs are recovered inside payroll runs. Each recovery, skip or prepayment is recorded here."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Entry</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Principal</TableHead>
                <TableHead className="text-right">Interest</TableHead>
                <TableHead className="text-right">Balance after</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.repayments.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap">{formatPeriod(row.period)}</TableCell>
                  <TableCell>
                    {row.is_prepayment ? (
                      <Badge variant="accent">Prepayment</Badge>
                    ) : row.is_skipped ? (
                      <Badge variant="warning">Skipped</Badge>
                    ) : (
                      <Badge variant="success">Recovered</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={row.amount} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={row.principal_component} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={row.interest_component} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={row.closing_balance} />
                  </TableCell>
                  <TableCell className="max-w-64 text-sm text-muted-foreground">
                    {row.reason || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

const ACTION_COPY: Record<Action, { title: string; description: string; confirm: string }> = {
  approve: {
    title: "Approve this loan?",
    description:
      "The loan moves to Approved. It is not paid out until someone marks it disbursed.",
    confirm: "Approve",
  },
  reject: {
    title: "Reject this loan?",
    description: "The employee sees the reason you give here.",
    confirm: "Reject loan",
  },
  disburse: {
    title: "Mark as disbursed?",
    description:
      "Record the date the money was paid out. EMI recovery then starts in payroll runs, following the schedule.",
    confirm: "Mark disbursed",
  },
  prepay: {
    title: "Record a prepayment",
    description:
      "A lump sum against the outstanding principal. Choose whether it lowers the EMI or shortens the tenure; the schedule is rebuilt.",
    confirm: "Record prepayment",
  },
};

function LoanActionDialog({
  loan,
  action,
  onClose,
  onDone,
}: {
  loan: LoanAccount;
  action: Action | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [note, setNote] = useState("");
  const [disbursedOn, setDisbursedOn] = useState(toISODate(new Date()));
  const [amount, setAmount] = useState("");
  const [prepayMode, setPrepayMode] = useState<PrepaymentInput["mode"]>("reduce_tenure");
  const [problem, setProblem] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const reset = () => {
    setNote("");
    setDisbursedOn(toISODate(new Date()));
    setAmount("");
    setPrepayMode("reduce_tenure");
    setProblem(null);
  };

  const close = () => {
    if (isBusy) return;
    reset();
    onClose();
  };

  const submit = async () => {
    if (!action) return;
    if (action === "reject" && !note.trim()) {
      setProblem("Give a reason for rejecting the loan.");
      return;
    }
    if (action === "prepay" && (!isMoneyInput(amount) || isZero(amount))) {
      setProblem("Enter the prepayment amount in rupees, with at most two decimals.");
      return;
    }
    setProblem(null);
    setIsBusy(true);
    try {
      if (action === "approve") {
        await post(`/loans/${loan.id}/approve`, { note: note.trim() || null });
        toast.success("Loan approved");
      } else if (action === "reject") {
        await post(`/loans/${loan.id}/reject`, { reason: note.trim() });
        toast.success("Loan rejected");
      } else if (action === "disburse") {
        await post(`/loans/${loan.id}/disburse`, { disbursed_on: disbursedOn || null });
        toast.success("Loan marked disbursed");
      } else {
        const body: PrepaymentInput = { amount: amount.trim(), mode: prepayMode };
        const schedule = await post<LoanSchedule>(`/loans/${loan.id}/prepay`, body);
        toast.success("Prepayment recorded", {
          description: `EMI ${formatMoney(schedule.emi)} over ${schedule.tenure_months} months.`,
        });
      }
      setIsBusy(false);
      reset();
      onClose();
      onDone();
    } catch (error) {
      setProblem(apiErrorMessage(error, "The action could not be completed."));
      setIsBusy(false);
    }
  };

  const copy = action ? ACTION_COPY[action] : null;

  return (
    <Dialog open={action !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-md">
        {copy && (
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>{copy.description}</DialogDescription>
          </DialogHeader>
        )}

        <div className="grid gap-4">
          {(action === "approve" || action === "reject") && (
            <FormField
              htmlFor="loan-note"
              label={action === "reject" ? "Reason" : "Note"}
              optional={action === "approve"}
            >
              <Textarea
                id="loan-note"
                rows={3}
                maxLength={2000}
                value={note}
                required={action === "reject"}
                disabled={isBusy}
                onChange={(event) => setNote(event.target.value)}
              />
            </FormField>
          )}

          {action === "disburse" && (
            <FormField htmlFor="loan-disbursed-on" label="Disbursed on">
              <Input
                id="loan-disbursed-on"
                type="date"
                value={disbursedOn}
                disabled={isBusy}
                onChange={(event) => setDisbursedOn(event.target.value)}
              />
            </FormField>
          )}

          {action === "prepay" && (
            <>
              <p className="text-sm text-muted-foreground">
                Outstanding principal:{" "}
                <Money value={loan.outstanding_principal} className="font-medium text-foreground" />
              </p>
              <FormField htmlFor="loan-prepay-amount" label="Amount (₹)">
                <Input
                  id="loan-prepay-amount"
                  inputMode="decimal"
                  className="tabular-nums"
                  value={amount}
                  required
                  disabled={isBusy}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </FormField>
              <FormField htmlFor="loan-prepay-mode" label="Apply it to">
                <Select
                  value={prepayMode}
                  disabled={isBusy}
                  onValueChange={(value) => setPrepayMode(value as PrepaymentInput["mode"])}
                >
                  <SelectTrigger id="loan-prepay-mode" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reduce_tenure">Shorten the tenure, keep the EMI</SelectItem>
                    <SelectItem value="reduce_emi">Lower the EMI, keep the tenure</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </>
          )}

          {problem && <InlineProblem>{problem}</InlineProblem>}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={isBusy} onClick={close}>
            Cancel
          </Button>
          <Button
            variant={action === "reject" ? "destructive" : "default"}
            disabled={isBusy}
            onClick={() => void submit()}
          >
            {isBusy && <Loader2 className="animate-spin" />}
            {copy?.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
