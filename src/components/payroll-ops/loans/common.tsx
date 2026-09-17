"use client";

import React from "react";

import { PersonCell } from "@/components/common/PersonCell";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type {
  ClaimStatus,
  InterestType,
  LoanStatus,
  LoanType,
} from "@/lib/types/payroll-ops";
import type { EmployeeSummary, UserRole } from "@/lib/types";

/** Roles, as fixed by the W3 contract. */
export const HR_ROLES: UserRole[] = ["tenant_admin", "hr_admin", "hr_ops"];
export const ADMIN_ROLES: UserRole[] = ["tenant_admin", "hr_admin"];

export const LOAN_STATUS_LABEL: Record<LoanStatus, string> = {
  applied: "Applied",
  approved: "Approved",
  rejected: "Rejected",
  disbursed: "Disbursed",
  active: "Recovering",
  closed: "Closed",
  written_off: "Written off",
};

const LOAN_STATUS_VARIANT: Record<
  LoanStatus,
  "warning" | "secondary" | "destructive" | "accent" | "default" | "muted"
> = {
  applied: "warning",
  approved: "secondary",
  rejected: "destructive",
  disbursed: "accent",
  active: "default",
  closed: "muted",
  written_off: "destructive",
};

export function LoanStatusBadge({ status }: { status: LoanStatus }) {
  return <Badge variant={LOAN_STATUS_VARIANT[status]}>{LOAN_STATUS_LABEL[status]}</Badge>;
}

export const LOAN_TYPE_LABEL: Record<LoanType, string> = {
  salary_advance: "Salary advance",
  company_loan: "Company loan",
};

export const INTEREST_TYPE_LABEL: Record<InterestType, string> = {
  simple: "Simple interest",
  reducing: "Reducing balance",
  interest_free: "Interest-free",
};

/** "10.50% a year, reducing balance" or "Interest-free". */
export function describeRate(rate: string, type: InterestType): string {
  if (type === "interest_free") return INTEREST_TYPE_LABEL.interest_free;
  return `${rate}% a year, ${INTEREST_TYPE_LABEL[type].toLowerCase()}`;
}

export const CLAIM_STATUS_LABEL: Record<ClaimStatus, string> = {
  submitted: "Submitted",
  verified: "Verified",
  partial: "Partly accepted",
  rejected: "Rejected",
};

const CLAIM_STATUS_VARIANT: Record<ClaimStatus, "warning" | "success" | "secondary" | "destructive"> = {
  submitted: "warning",
  verified: "success",
  partial: "secondary",
  rejected: "destructive",
};

export function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  return <Badge variant={CLAIM_STATUS_VARIANT[status]}>{CLAIM_STATUS_LABEL[status]}</Badge>;
}

export function employeeName(employee: EmployeeSummary): string {
  return (
    employee.display_name ?? `${employee.first_name} ${employee.last_name ?? ""}`.trim()
  );
}

/**
 * A decimal money string as integer paise, for comparisons only.
 *
 * BigInt, not Number: "is the accepted amount above the claim" must not be
 * answered by floating point. Assumes the input already passed `isMoneyInput`.
 */
export function toPaise(value: string): bigint {
  const trimmed = value.trim();
  const negative = trimmed.startsWith("-");
  const [whole, fraction = ""] = (negative ? trimmed.slice(1) : trimmed).split(".");
  const paise = BigInt(whole || "0") * BigInt(100) + BigInt((fraction + "00").slice(0, 2));
  return negative ? -paise : paise;
}

/** Whether a string is a whole number within [min, max]. */
export function isWholeNumber(value: string, min = 0, max = Number.MAX_SAFE_INTEGER): boolean {
  if (!/^\d+$/.test(value.trim())) return false;
  const parsed = Number(value.trim());
  return parsed >= min && parsed <= max;
}

/** An employee in a table row: avatar, name and code. */
export function EmployeeCell({
  name,
  code,
}: {
  name: string | null | undefined;
  code?: string | null;
}) {
  return <PersonCell size="sm" name={name ?? "—"} subtitle={code ?? undefined} />;
}

/** A labelled on/off setting with an optional hint. */
export function ToggleRow({
  id,
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2.5">
      <div>
        <Label htmlFor={id}>{label}</Label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}

/** A label/value pair in a definition grid. */
export function Fact({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-foreground tabular-nums">{children}</dd>
    </div>
  );
}
