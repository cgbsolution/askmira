"use client";

import { CalendarClock, CheckCircle2, Coins, Info, Loader2, Plus } from "lucide-react";
import React, { useMemo, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import { EncashmentRequestsTable } from "@/components/payroll-ops/gratuity/EncashmentRequestsTable";
import {
  apiErrorMessage,
  financialYearStart,
  InlineProblem,
  isMoneyInput,
  isZero,
  shortFinancialYear,
} from "@/components/payroll-ops/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { LeaveBalance } from "@/lib/types";
import type {
  EncashmentPolicy,
  EncashmentRequest,
  EncashmentRequestInput,
} from "@/lib/types/payroll-ops";
import { formatDays } from "@/lib/utils";

import { Fact } from "./common";
import { QueryPanel } from "./QueryPanel";

/** Encash leave while in service, and follow what you have asked for. */
export function MyEncashment() {
  const policies = useApiQuery<EncashmentPolicy[]>("/encashment/policies");
  const balances = useApiQuery<LeaveBalance[]>("/leave/balances");
  const requests = useApiQuery<EncashmentRequest[]>("/encashment/requests");

  const eligible = useMemo(
    () => (policies.data ?? []).filter((policy) => policy.active && policy.encashable_in_service),
    [policies.data],
  );
  const balanceFor = (code: string) =>
    (balances.data ?? []).find((balance) => balance.leave_type_code === code) ?? null;

  return (
    <div className="space-y-4">
      <Alert>
        <Info />
        <AlertDescription>
          An approved in-service encashment is not paid immediately — it is paid in a future payroll
          run, and shows on that month&apos;s payslip.
        </AlertDescription>
      </Alert>

      <QueryPanel
        query={policies}
        title="Leave you can encash"
        description="Only leave types your company allows to be encashed while you are still working here."
        actions={
          eligible.length > 0 && (
            <RequestEncashmentDialog
              policies={eligible}
              balances={balances.data ?? []}
              onRequested={() => {
                requests.reload();
                balances.reload();
              }}
            />
          )
        }
        isEmpty={() => eligible.length === 0}
        empty={{
          icon: Coins,
          title: "No leave can be encashed in service",
          description:
            "Your company's encashment policies do not allow any leave type to be encashed while you are employed.",
        }}
        footer={balances.error && <InlineProblem>{balances.error.detail}</InlineProblem>}
      >
        {() => (
          <div className="grid gap-4 p-5 md:grid-cols-2">
            {eligible.map((policy) => {
              const balance = balanceFor(policy.leave_type_code);
              return (
                <div key={policy.id} className="space-y-3 rounded-lg border border-border p-4">
                  <p className="font-medium text-foreground">
                    {balance?.leave_type_name ?? policy.leave_type_code}
                  </p>
                  <dl className="grid grid-cols-2 gap-3">
                    <Fact label="Available now">
                      {balances.isLoading && !balances.data
                        ? "…"
                        : balance
                          ? `${formatDays(balance.available)} days`
                          : "No balance"}
                    </Fact>
                    <Fact label="Must keep after encashing">
                      {formatDays(policy.min_balance_after_encashment)} days
                    </Fact>
                    {policy.max_days_per_year && (
                      <Fact label="Most per year">{formatDays(policy.max_days_per_year)} days</Fact>
                    )}
                    {policy.cap_days && (
                      <Fact label="Overall cap">{formatDays(policy.cap_days)} days</Fact>
                    )}
                  </dl>
                  <p className="text-xs text-muted-foreground">
                    {policy.in_service_fully_taxable
                      ? "Encashment in service is fully taxable."
                      : "Tax treatment is worked out per request by the server."}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </QueryPanel>

      <QueryPanel
        query={requests}
        title="My encashment requests"
        description="The server caps the days by policy and your balance when you ask, so the days approved can be fewer than the days you requested."
        isEmpty={(rows) => rows.length === 0}
        empty={{
          icon: CalendarClock,
          title: "No encashment requests",
          description: "Requests you make show here with the amount the server worked out.",
        }}
      >
        {(rows) => <EncashmentRequestsTable rows={rows} />}
      </QueryPanel>
    </div>
  );
}

function RequestEncashmentDialog({
  policies,
  balances,
  onRequested,
}: {
  policies: EncashmentPolicy[];
  balances: LeaveBalance[];
  onRequested: () => void;
}) {
  const financialYear = shortFinancialYear(financialYearStart());
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [days, setDays] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [result, setResult] = useState<EncashmentRequest | null>(null);

  const balance = balances.find((candidate) => candidate.leave_type_code === code) ?? null;

  const reset = () => {
    setCode("");
    setDays("");
    setProblem(null);
    setResult(null);
  };

  const submit = async () => {
    if (!code) return setProblem("Choose a leave type.");
    if (!isMoneyInput(days) || isZero(days)) {
      return setProblem("Enter the number of days, e.g. 5 or 2.5.");
    }
    setProblem(null);
    setIsBusy(true);
    const body: EncashmentRequestInput = {
      leave_type_code: code,
      days: days.trim(),
      financial_year: financialYear,
    };
    try {
      const created = await post<EncashmentRequest>("/encashment/requests", body);
      setResult(created);
      toast.success("Encashment requested");
      onRequested();
    } catch (error) {
      setProblem(apiErrorMessage(error, "The request could not be submitted."));
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
        <Button variant="accent" size="sm">
          <Plus /> Request encashment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request leave encashment</DialogTitle>
          <DialogDescription>
            For FY {financialYear}. If approved, it is paid in a future payroll run.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="grid gap-4">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <CheckCircle2 className="size-4 text-success" />
              Request submitted for approval.
            </div>
            <dl className="grid grid-cols-2 gap-3 rounded-md border border-border bg-muted/50 p-3">
              <Fact label="Days requested">{formatDays(result.days_requested)}</Fact>
              <Fact label="Days allowed">{formatDays(result.days_approved)}</Fact>
              <Fact label="Daily rate">
                <Money value={result.daily_rate} />
              </Fact>
              <Fact label="Gross amount">
                <Money value={result.gross_amount} />
              </Fact>
              <Fact label="Exempt">
                <Money value={result.exempt_amount} />
              </Fact>
              <Fact label="Taxable">
                <Money value={result.taxable_amount} />
              </Fact>
            </dl>
            {result.days_requested !== result.days_approved && (
              <p className="text-xs text-muted-foreground">
                The server capped the days by your policy and balance.
              </p>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            <FormField
              htmlFor="encash-type"
              label="Leave type"
              hint={
                code
                  ? balance
                    ? `${formatDays(balance.available)} days available`
                    : "No balance found for this leave type."
                  : undefined
              }
            >
              <Select value={code} onValueChange={setCode} disabled={isBusy}>
                <SelectTrigger id="encash-type" className="w-full">
                  <SelectValue placeholder="Choose a leave type" />
                </SelectTrigger>
                <SelectContent>
                  {policies.map((policy) => (
                    <SelectItem key={policy.id} value={policy.leave_type_code}>
                      {balances.find((b) => b.leave_type_code === policy.leave_type_code)
                        ?.leave_type_name ?? policy.leave_type_code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField htmlFor="encash-days" label="Days">
              <Input
                id="encash-days"
                inputMode="decimal"
                className="tabular-nums"
                required
                value={days}
                disabled={isBusy}
                onChange={(event) => setDays(event.target.value)}
              />
            </FormField>
            {problem && <InlineProblem>{problem}</InlineProblem>}
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button onClick={() => setOpen(false)}>Done</Button>
          ) : (
            <>
              <Button variant="outline" disabled={isBusy} onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button disabled={isBusy} onClick={() => void submit()}>
                {isBusy && <Loader2 className="animate-spin" />}
                Submit request
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
