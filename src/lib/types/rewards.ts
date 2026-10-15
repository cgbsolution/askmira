/**
 * Rewards API types. Mirror `backend/app/schemas/rewards.py` and the report
 * dictionaries in `app/services/rewards`. Points are integers; rupees are
 * decimal strings and stay strings.
 */

export type LedgerType = "awarded" | "redeemed" | "expired" | "adjusted" | "reversed";

export interface StatementRow {
  entry_id: string;
  type: LedgerType;
  points: number;
  value: string;
  occurred_at: string;
  balance_after: number;
}

export interface ExpiringLot {
  awarded_at: string;
  points: number;
  rupees: string;
  days_left: number;
  expires_on: string;
}

export interface TaxAssessment {
  employee_id: string;
  financial_year: string;
  reward_type: string;
  cumulative_value: string;
  threshold: string;
  taxable_value: string;
  treatment: string;
  is_taxable: boolean;
  reviewed: boolean;
  note: string;
}

export interface RewardStatement {
  employee_id: string;
  financial_year: string;
  balance_points: number;
  balance_rupees: string;
  rows: StatementRow[];
  expiring: ExpiringLot[];
  expiry_disclosure: string;
  tax: {
    financial_year: string;
    total_value: string;
    taxable_value: string;
    non_taxable_value: string;
    rewards: { reward_type: string; value: string; given_on: string; description: string }[];
    by_type: TaxAssessment[];
    any_provisional: boolean;
    note: string;
  };
}

export interface Valuation {
  id: string;
  points_per_rupee: string;
  effective_from: string;
  note: string | null;
  created_at: string;
}

export interface ExpiryPolicy {
  configured: boolean;
  enabled: boolean;
  expire_after_days: number | null;
  notify_days_before: number | null;
  disclosure: string;
}

export type TaxTreatment = "perquisite" | "exempt" | "gift_rule";

export interface TaxRule {
  id: string;
  reward_type: string;
  treatment: TaxTreatment;
  exemption_threshold_per_year: string;
  effective_from: string;
  basis: string | null;
  reviewed: boolean;
  reviewed_by: string | null;
  reviewed_on: string | null;
}

export type BudgetScope = "company" | "department" | "manager";
export type Enforcement = "hard_stop" | "soft_warning";

export interface BudgetRow {
  budget_id: string;
  scope: BudgetScope;
  scope_key: string;
  scope_label: string;
  allocated_points: number;
  consumed_points: number;
  remaining_points: number;
  utilisation: number | null;
  allocated_rupees: string;
  consumed_rupees: string;
  enforcement: Enforcement;
  exhausted: boolean;
}

export interface BudgetReport {
  as_of: string;
  rate_per_point: string;
  budgets: BudgetRow[];
  exhausted_count: number;
  note: string;
}

export interface LiabilityReport {
  as_of: string;
  liability: { balance_points: number; rupees: string; unmatched_consumption: number; note: string };
  ageing: {
    total_points: number;
    total_rupees: string;
    buckets: Record<string, { points: number; rupees: string }>;
  };
  by_group: {
    grouped_by: string;
    groups: { balance_points: number; rupees: string; [key: string]: string | number }[];
    total_points: number;
    total_rupees: string;
  };
  expected_redemption: { awarded: number; redeemed: number; expired: number; rate: number | null; note: string };
  chain: { intact: boolean; derived_balance?: number; [key: string]: unknown };
}

export interface MovementReport {
  period_start: string;
  period_end: string;
  opening: number;
  awarded: number;
  redeemed: number;
  expired: number;
  reversed: number;
  adjusted: number;
  closing: number;
  reconciles: boolean;
  note: string;
}

export type RedemptionStatus = "requested" | "ordered" | "fulfilled" | "cancelled";

export interface Redemption {
  id: string;
  employee_id: string;
  employee_name: string;
  points: number;
  rupee_value: string;
  item_sku: string | null;
  item_description: string | null;
  status: RedemptionStatus;
  requested_on: string;
}

export interface ReconciliationGap {
  kind: string;
  detail?: string;
  [key: string]: unknown;
}

export interface ReconciliationRun {
  id: string;
  period_label: string;
  status: "clean" | "gaps_found";
  redemption_count: number;
  fulfilment_count: number;
  invoice_line_count: number;
  redeemed_value: string;
  invoiced_value: string;
  gap_count: number;
  gaps: ReconciliationGap[];
  run_on: string;
  created_at: string;
}

export interface PerquisiteReport {
  employee_id: string;
  financial_year: string;
  assessments: TaxAssessment[];
  payroll: { handed_over: boolean; runs: string[]; events_waiting: number; note: string };
}

export interface ImportResult {
  fulfilments_imported: number;
  fulfilments_skipped: string[];
  invoice_lines_imported: number;
  note: string;
}

export interface AwardPointsResult {
  entry_id: string;
  points: number;
  monetary_value: string;
  balance_after: number;
  budget: { permitted: boolean; message: string; overspend_points: number };
  expiry_disclosure: string;
}

export interface RewardsPosture {
  enforced: string[];
  not_built: string[];
}
