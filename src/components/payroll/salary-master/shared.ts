import type { ComponentType, PayBasis, WageGroup } from "@/lib/types/payroll";
import { parseISODate, toISODate } from "@/lib/utils";

/**
 * The Salary master's sections, in the order the grid lists them. Statutory
 * deductions are a section of their own but hold no wage types: payroll works
 * them out each month from the statutory rules.
 */
export const SECTIONS: { key: WageGroup | "statutory"; title: string }[] = [
  { key: "regular_earning", title: "Regular earning" },
  { key: "variable_earning", title: "Variable earning" },
  { key: "reimbursement", title: "Reimbursement" },
  { key: "statutory", title: "Statutory deduction" },
  { key: "non_statutory_deduction", title: "Non-statutory deduction" },
  { key: "company_contribution", title: "Company contribution" },
  { key: "provision", title: "Provision" },
];

/** What payroll deducts by law. Shown for completeness; never typed here. */
export const STATUTORY_LINES = [
  "Provident fund (employee)",
  "ESI (employee)",
  "Professional tax",
  "Labour welfare fund",
  "Income tax (TDS)",
];

export const BASIS_LABEL: Record<PayBasis, string> = {
  monthly: "Monthly",
  annual: "Yearly",
};

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
  group: WageGroup;
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
  return parseISODate(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
