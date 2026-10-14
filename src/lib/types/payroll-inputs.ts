/** Ad-hoc payroll adjustments and overtime. Money crosses the wire as strings. */

export type AdjustmentKind = "earning" | "deduction";

export type AdjustmentCategory =
  | "incentive"
  | "bonus"
  | "commission"
  | "overtime"
  | "shift_allowance"
  | "arrear"
  | "other_earning"
  | "court_attachment"
  | "canteen"
  | "transport"
  | "damage_recovery"
  | "other_deduction";

export type AdjustmentRecurrence = "one_time" | "monthly";

export type AdjustmentStatus = "pending" | "approved" | "rejected" | "cancelled" | "completed";

export interface AdjustmentApplication {
  run_id: string;
  period_year: number;
  period_month: number;
  amount: string;
  created_at: string;
}

export interface Adjustment {
  id: string;
  employee_id: string;
  employee_code: string | null;
  employee_name: string | null;
  kind: AdjustmentKind;
  category: AdjustmentCategory;
  name: string;
  amount: string;
  taxable: boolean;
  counts_as_wages: boolean;
  within_net_pay: boolean;
  recurrence: AdjustmentRecurrence;
  start_year: number;
  start_month: number;
  end_year: number | null;
  end_month: number | null;
  total_cap: string | null;
  amount_applied: string;
  reference: string | null;
  reason: string;
  status: AdjustmentStatus;
  created_by_user_id: string | null;
  created_by_name: string | null;
  decided_by_name: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
  caller_may_decide: boolean;
  applications: AdjustmentApplication[];
}

export interface AdjustmentInput {
  employee_id: string;
  category: AdjustmentCategory;
  name: string;
  amount: string;
  taxable: boolean;
  counts_as_wages: boolean;
  within_net_pay: boolean;
  recurrence: AdjustmentRecurrence;
  start_year: number;
  start_month: number;
  end_year: number | null;
  end_month: number | null;
  total_cap: string | null;
  reference: string | null;
  reason: string;
}

export interface AdjustmentImportResult {
  created: number;
  errors: string[];
}

export type OvertimeStatus = "pending" | "approved" | "rejected" | "paid";

export interface OvertimePolicy {
  id: string;
  name: string;
  location_id: string | null;
  location_name: string | null;
  rate_multiplier: string;
  wage_component_codes: string[];
  days_divisor: number;
  hours_per_day: string;
  minimum_minutes: number;
  rounding_minutes: number;
  daily_cap_minutes: number | null;
  quarterly_cap_minutes: number | null;
  count_rest_days: boolean;
  requires_approval: boolean;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
}

export interface OvertimePolicyInput {
  name: string;
  location_id: string | null;
  rate_multiplier: string;
  wage_component_codes: string[];
  days_divisor: number;
  hours_per_day: string;
  minimum_minutes: number;
  rounding_minutes: number;
  daily_cap_minutes: number | null;
  quarterly_cap_minutes: number | null;
  count_rest_days: boolean;
  requires_approval: boolean;
  effective_from: string;
}

export interface OvertimeEntry {
  id: string;
  employee_id: string;
  employee_code: string | null;
  employee_name: string | null;
  attendance_date: string;
  policy_id: string;
  policy_name: string | null;
  recorded_minutes: number;
  eligible_minutes: number;
  approved_minutes: number | null;
  is_rest_day: boolean;
  hourly_rate: string | null;
  rate_multiplier: string | null;
  amount: string | null;
  basis: string | null;
  status: OvertimeStatus;
  decided_by_name: string | null;
  decided_at: string | null;
  decision_note: string | null;
  paid_in_run_id: string | null;
  caller_may_decide: boolean;
}

export interface OvertimeSyncResult {
  created: number;
  updated: number;
  removed: number;
  auto_approved: number;
  without_policy: string[];
}
