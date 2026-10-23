import { ApiError } from "@/lib/api";
import type { RunStatus, RunType, WageGroup } from "@/lib/types/payroll";

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function periodLabel(year: number, month: number): string {
  return `${MONTHS[month - 1]} ${year}`;
}

export const RUN_STATUS: Record<
  RunStatus,
  { label: string; variant: "default" | "accent" | "success" | "warning" | "destructive" | "muted" }
> = {
  draft: { label: "Draft", variant: "muted" },
  processing: { label: "Computing", variant: "muted" },
  pending_review: { label: "Awaiting approval", variant: "warning" },
  approved: { label: "Approved", variant: "accent" },
  paid: { label: "Paid", variant: "success" },
  failed: { label: "Failed", variant: "destructive" },
  cancelled: { label: "Cancelled", variant: "muted" },
};

export const RUN_TYPE: Record<RunType, string> = {
  regular: "Regular",
  off_cycle: "Off-cycle",
  arrear: "Arrears",
  full_and_final: "Full & final",
  bonus: "Bonus",
};

export const RULE_TYPE_LABEL: Record<string, string> = {
  pf: "Provident Fund",
  esi: "ESI",
  professional_tax: "Professional Tax",
  tds: "Income tax (TDS)",
  gratuity: "Gratuity",
  bonus: "Statutory bonus",
  labour_welfare_fund: "Labour Welfare Fund",
  tds_non_salary: "TDS on contractors (194C / 194J)",
  wage_deductions: "Deductions ceiling (% of wages)",
};

export const COMPONENT_TYPE_LABEL: Record<string, string> = {
  earning: "Earning",
  deduction: "Deduction",
  employer_contribution: "Employer",
  reimbursement: "Reimbursement",
};

/** The API's own words for a failure, or a plain fallback. */
export function apiMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.detail : fallback;
}

/** "2026-04-30T10:11:12Z" → "30 Apr 2026, 10:11". */
export function formatMoment(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** A decimal string that is exactly zero ("0", "0.00", "-0.00"). */
export function isZero(value: string | null | undefined): boolean {
  return !value || /^-?0*(\.0*)?$/.test(value.trim());
}

/** A non-negative decimal amount typed by a person, still as a string. */
export function isAmount(value: string): boolean {
  return /^\d+(\.\d{1,2})?$/.test(value.trim());
}

/** The Salary master's wage groups, each implying its component type. */
export const WAGE_GROUP_LABEL: Record<WageGroup, string> = {
  ctc_input: "CTC wise input",
  statutory_deduction: "Statutory deduction",
  regular_earning: "Regular earning",
  variable_earning: "Variable earning",
  reimbursement: "Reimbursement",
  non_statutory_deduction: "Non-statutory deduction",
  company_contribution: "Company contribution",
  provision: "Provision",
};
