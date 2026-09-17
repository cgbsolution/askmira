"use client";

import { BadgeCheck, CircleDollarSign } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { BoardFormDialog } from "@/components/hiring/BoardFormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, post } from "@/lib/api";
import type { ReferralPayout, ReferralRow } from "@/lib/types/hiring";
import { formatMoney, toISODate } from "@/lib/utils";

/** HR records that a referred candidate was hired, which schedules the bonus payouts. */
export function ReferralHireDialog({ referral, onDone }: { referral: ReferralRow; onDone: () => void }) {
  const [hiredOn, setHiredOn] = useState(toISODate(new Date()));
  const [grade, setGrade] = useState("");
  const [errors, setErrors] = useState<{ hiredOn?: string; grade?: string }>({});

  const submit = async (): Promise<boolean> => {
    const next: typeof errors = {};
    if (!hiredOn) next.hiredOn = "Enter the joining date.";
    if (!grade.trim()) next.grade = "Enter the grade the candidate joined at.";
    setErrors(next);
    if (Object.keys(next).length > 0) return false;
    try {
      await post(`/recruiting/referrals/${referral.id}/hired`, {
        hired_on: hiredOn,
        grade: grade.trim(),
      });
      toast.success(`${referral.candidate} marked hired`, {
        description: "Any bonus payouts this schedules appear under the referral.",
      });
      onDone();
      return true;
    } catch (error) {
      toast.error(error instanceof ApiError ? error.detail : "Could not mark the referral hired.");
      return false;
    }
  };

  return (
    <BoardFormDialog
      trigger={
        <Button size="sm" variant="outline">
          <BadgeCheck /> Mark hired
        </Button>
      }
      title={`Mark ${referral.candidate} hired`}
      description="The bonus is worked out from the grade the candidate joined at."
      submitLabel="Mark hired"
      onSubmit={submit}
      onClosed={() => setErrors({})}
    >
      <FormField htmlFor={`hired-on-${referral.id}`} label="Joined on" error={errors.hiredOn}>
        <Input
          id={`hired-on-${referral.id}`}
          type="date"
          value={hiredOn}
          required
          onChange={(event) => setHiredOn(event.target.value)}
        />
      </FormField>
      <FormField htmlFor={`hired-grade-${referral.id}`} label="Grade" error={errors.grade}>
        <Input
          id={`hired-grade-${referral.id}`}
          value={grade}
          maxLength={32}
          required
          onChange={(event) => setGrade(event.target.value)}
        />
      </FormField>
    </BoardFormDialog>
  );
}

/** HR records that one payout went out, under a payroll reference. */
export function ReferralPayDialog({ payout, onDone }: { payout: ReferralPayout; onDone: () => void }) {
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (): Promise<boolean> => {
    if (!reference.trim()) {
      setError("Enter the payroll reference this was paid under.");
      return false;
    }
    setError(null);
    try {
      await post(`/recruiting/referral-payouts/${payout.id}/pay`, {
        payroll_reference: reference.trim(),
      });
      toast.success(`${payout.milestone} payout marked paid`);
      onDone();
      return true;
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "Could not mark the payout paid.");
      return false;
    }
  };

  return (
    <BoardFormDialog
      trigger={
        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs">
          <CircleDollarSign /> Mark paid
        </Button>
      }
      title="Mark payout paid"
      description={`${payout.milestone} · ${formatMoney(payout.amount)}. Payroll does not pick this up automatically — record it only once it has been paid through a run.`}
      submitLabel="Mark paid"
      onSubmit={submit}
      onClosed={() => {
        setReference("");
        setError(null);
      }}
    >
      <FormField htmlFor={`pay-ref-${payout.id}`} label="Payroll reference" error={error}>
        <Input
          id={`pay-ref-${payout.id}`}
          value={reference}
          maxLength={120}
          required
          onChange={(event) => setReference(event.target.value)}
        />
      </FormField>
    </BoardFormDialog>
  );
}
