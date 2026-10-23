import type { ComponentType, PayBasis } from "@/lib/types/payroll";
import { parseISODate, toISODate } from "@/lib/utils";

/** The kinds of wage type, in the order the Salary master lists them. */
export const WAGE_GROUPS: { type: ComponentType; title: string }[] = [
  { type: "earning", title: "Earnings" },
  { type: "reimbursement", title: "Reimbursements" },
  { type: "deduction", title: "Deductions" },
  { type: "employer_contribution", title: "Company contributions" },
];

export const BASIS_LABEL: Record<PayBasis, string> = { monthly: "Monthly", annual: "Yearly" };

/** One wage type's state in the editor. Amounts stay strings end to end. */
export interface WageRow {
  /** Typed for this person, rather than worked out by the structure. */
  manual: boolean;
  amount: string;
  basis: PayBasis;
  remarks: string;
}

/** A wage type as the grid shows it. */
export interface WageLine {
  code: string;
  name: string;
  type: ComponentType;
  /** What the structure leaves over from the CTC: never typed. */
  balance: boolean;
  partOfCtc: boolean;
  inStructure: boolean;
  /** Resolved amounts from the server, or null when it is not paid. */
  monthly: string | null;
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
