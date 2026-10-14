import type {
  AdjustmentCategory,
  AdjustmentStatus,
} from "@/lib/types/payroll-inputs";

export const EARNING_CATEGORIES: AdjustmentCategory[] = [
  "incentive",
  "bonus",
  "commission",
  "overtime",
  "shift_allowance",
  "arrear",
  "other_earning",
];

export const DEDUCTION_CATEGORIES: AdjustmentCategory[] = [
  "court_attachment",
  "canteen",
  "transport",
  "damage_recovery",
  "other_deduction",
];

export const CATEGORY_LABEL: Record<AdjustmentCategory, string> = {
  incentive: "Incentive",
  bonus: "Bonus",
  commission: "Commission",
  overtime: "Overtime (manual)",
  shift_allowance: "Shift allowance (manual)",
  arrear: "Arrear (manual)",
  other_earning: "Other earning",
  court_attachment: "Court attachment",
  canteen: "Canteen",
  transport: "Transport",
  damage_recovery: "Damage recovery",
  other_deduction: "Other deduction",
};

export const STATUS_LABEL: Record<
  AdjustmentStatus,
  { label: string; variant: "warning" | "accent" | "success" | "muted" | "destructive" }
> = {
  pending: { label: "Awaiting approval", variant: "warning" },
  approved: { label: "Approved", variant: "accent" },
  completed: { label: "Paid", variant: "success" },
  rejected: { label: "Rejected", variant: "destructive" },
  cancelled: { label: "Cancelled", variant: "muted" },
};
