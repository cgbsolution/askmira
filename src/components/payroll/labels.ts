import { ApiError } from "@/lib/api";
import type { PayrollOrigin, RunStatus, RunType, WageGroup } from "@/lib/types/payroll";

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
  pending_review: { label: "Computed · not locked", variant: "warning" },
  approved: { label: "Locked", variant: "accent" },
  paid: { label: "Paid", variant: "success" },
  failed: { label: "Failed", variant: "destructive" },
  cancelled: { label: "Cancelled", variant: "muted" },
};

/** Approval is the lock: from then on a run is history, never recomputed or deleted. */
export function isRunLocked(status: RunStatus): boolean {
  return status === "approved" || status === "paid";
}

/** A run that is not locked (and not mid-compute) can be deleted, so the month can run again. */
export function isRunDeletable(status: RunStatus): boolean {
  return ["draft", "pending_review", "failed", "cancelled"].includes(status);
}

/**
 * A run or payslip imported as paid on the previous payroll (factoHR): its
 * figures are the register's, never recomputed, published, paid or posted again.
 */
export function isImported(item: { origin?: PayrollOrigin | null } | null | undefined): boolean {
  return item?.origin === "imported";
}

/** The provider of the input lines that carry an imported register's own differences. */
export const REGISTER_PROVIDER = "factohr_register";

/** What an imported payslip says instead of an income-tax working. */
export const IMPORTED_TDS_NOTE =
  "TDS as deducted on factoHR (imported). No income-tax working was imported.";

/** "Row 12" / "Rows 12, 13" of a register, as written in the spreadsheet. */
export function registerRowsLabel(rows: readonly number[] | null | undefined): string {
  if (!rows || rows.length === 0) return "";
  return `${rows.length === 1 ? "Row" : "Rows"} ${rows.join(", ")}`;
}

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
