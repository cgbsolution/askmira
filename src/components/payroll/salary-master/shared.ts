import type { ComponentType, PayBasis, WageGroup } from "@/lib/types/payroll";
import { parseISODate, toISODate } from "@/lib/utils";

/** The Salary Structure groups, numbered and ordered as on the Employee Salary Master. */
export const SECTIONS: { key: WageGroup; title: string }[] = [
  { key: "regular_earning", title: "Regular earning" },
  { key: "variable_earning", title: "Variable earning" },
  { key: "reimbursement", title: "Reimbursement" },
  { key: "statutory_deduction", title: "Statutory deduction" },
  { key: "non_statutory_deduction", title: "Non-statutory deduction" },
  { key: "company_contribution", title: "Company contribution" },
  { key: "provision", title: "Provision" },
];

/** The Pay Basis choices, in the order the old screen lists them. */
export const BASES: PayBasis[] = ["annual", "monthly", "weekly", "daily", "hourly"];

export const BASIS_LABEL: Record<PayBasis, string> = {
  annual: "Yearly",
  monthly: "Monthly",
  weekly: "Weekly",
  daily: "Daily",
  hourly: "Hourly",
};

/** One wage type's box in the editor. Amounts stay strings end to end. */
export interface WageRow {
  amount: string;
  basis: PayBasis;
  remarks: string;
}

/** A wage type as the grid lists it. */
export interface WageLine {
  code: string;
  name: string;
  type: ComponentType;
  group: WageGroup;
  /** The yearly figure from the server, or null while there is none. */
  annual: string | null;
}

/** Whether a typed amount is something the API will take: digits, up to two decimals. */
export function isTypedAmount(value: string): boolean {
  return /^\d+(\.\d{1,2})?$/.test(value.trim());
}

export function addDays(iso: string, days: number): string {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

/** "2026-08" → "Aug 2026". */
export function periodName(period: string): string {
  const [year, month] = period.split("-").map(Number);
  return parseISODate(`${year}-${String(month).padStart(2, "0")}-01`).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
  });
}

/** "2026-04-01" → "01 Apr 2026", the way revisions are dated on this screen. */
export function revisionDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
