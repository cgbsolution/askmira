"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { InlineProblem, MONEY_RE, errorDetail, isZero, todayISO } from "@/components/expenses/ReviewCommon";
import { formatMoney } from "@/components/expenses/shared";
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
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, get, post } from "@/lib/api";
import type { Advance, AdvanceBlockCheck, AdvanceInput, TravelRequest } from "@/lib/types/expenses";
import { DatePicker } from "@/components/common/DatePicker";

type Check =
  | { state: "loading" }
  | { state: "permitted"; result: AdvanceBlockCheck }
  | { state: "blocked"; detail: string }
  | { state: "error"; detail: string };

/**
 * Issue an advance against an approved trip.
 *
 * The block check is asked first and its answer shown, so an older unsettled
 * advance is visible before anyone types an amount — and the server's own 409
 * on issue is shown in its words if the picture changed in between.
 */
export function ReviewAdvanceIssueDialog({
  trip,
  onClose,
  onIssued,
}: {
  trip: TravelRequest | null;
  onClose: () => void;
  onIssued: (advance: Advance) => void;
}) {
  const [amount, setAmount] = useState("");
  const [issuedOn, setIssuedOn] = useState(todayISO());
  const [check, setCheck] = useState<Check>({ state: "loading" });
  const [problem, setProblem] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!trip) return;
    setAmount(trip.advance_requested);
    setIssuedOn(todayISO());
    setProblem(null);
    setCheck({ state: "loading" });
    let cancelled = false;
    get<AdvanceBlockCheck>(
      `/expenses/advances/block-check?employee_id=${encodeURIComponent(trip.employee_id)}`,
    )
      .then((result) => !cancelled && setCheck({ state: "permitted", result }))
      .catch((error) => {
        if (cancelled) return;
        const detail = errorDetail(error, "Could not check for older advances.");
        setCheck(
          error instanceof ApiError && error.status === 409
            ? { state: "blocked", detail }
            : { state: "error", detail },
        );
      });
    return () => {
      cancelled = true;
    };
  }, [trip]);

  const valid = MONEY_RE.test(amount) && !isZero(amount) && Boolean(issuedOn);

  const issue = async () => {
    if (!trip || !valid) return;
    setIsSaving(true);
    setProblem(null);
    try {
      const body: AdvanceInput = { travel_request_id: trip.id, amount, issued_on: issuedOn };
      const advance = await post<Advance>("/expenses/advances", body);
      toast.success(`Advance of ${formatMoney(advance.amount)} issued`);
      onIssued(advance);
    } catch (error) {
      setProblem(errorDetail(error, "Could not issue the advance."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={trip !== null} onOpenChange={(open) => !open && !isSaving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Issue an advance</DialogTitle>
          <DialogDescription>
            {trip &&
              `${trip.employee_name ?? "The employee"}: ${trip.purpose}. Requested ${formatMoney(trip.advance_requested)}.`}
          </DialogDescription>
        </DialogHeader>

        {check.state === "loading" && <Skeleton className="h-14 w-full" />}
        {check.state === "blocked" && <InlineProblem>{check.detail}</InlineProblem>}
        {check.state === "error" && <InlineProblem>{check.detail}</InlineProblem>}
        {check.state === "permitted" && (
          <div className="flex items-start gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2.5 text-sm text-success">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <div>
              <p>No older advance blocks this one.</p>
              <p className="tabular-nums">
                Outstanding for this employee: {formatMoney(check.result.ageing.total_outstanding)}. Advances
                block after {check.result.ageing.block_after_days} days unsettled.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="advance-amount">Amount (₹)</Label>
            <Input
              id="advance-amount"
              inputMode="decimal"
              className="tabular-nums"
              value={amount}
              aria-invalid={amount !== "" && !MONEY_RE.test(amount)}
              onChange={(event) => setAmount(event.target.value.trim())}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="advance-issued-on">Issued on</Label>
            <DatePicker
              id="advance-issued-on"
              value={issuedOn}
              onChange={setIssuedOn}
            />
          </div>
        </div>

        {problem && <InlineProblem>{problem}</InlineProblem>}

        <DialogFooter>
          <Button variant="outline" disabled={isSaving} onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!valid || isSaving || check.state === "loading" || check.state === "blocked"}
            onClick={() => void issue()}
          >
            {isSaving && <Loader2 className="animate-spin" />}
            Issue advance
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
