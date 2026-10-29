/**
 * Payroll core: runs, payslips, salaries, structures, rule sets and statutory.
 *
 * Mirrors `app/schemas/payroll.py`, `app/schemas/payroll_run.py` and the
 * contracts in `app/api/v1/routers/statutory.py`. Every amount and day count is
 * a decimal string and stays one.
 */

export type RunStatus =
  | "draft"
  | "processing"
  | "pending_review"
  | "approved"
  | "paid"
  | "failed"
  | "cancelled";

export type RunType = "regular" | "off_cycle" | "arrear" | "full_and_final" | "bonus";

export interface DeductionCeiling {
  wages: string;
  deductions: string;
  share_percent: string;
  ceiling_percent: string;
  ceiling: string;
}

export interface VarianceFlag {
  employee_id: string;
  employee_code: string;
  employee_name: string | null;
  /** Null when the flag is only about the deductions ceiling. */
  previous_net: string | null;
  current_net: string;
  change_percent: string | null;
  /** Days before joining or after leaving: why a joining or leaving month swings. */
  not_employed_days: string;
  /** Set when deductions that cannot wait pass the legal ceiling on their own. */
  deduction_ceiling: DeductionCeiling | null;
  acknowledged: boolean;
  acknowledged_by_user_id: string | null;
  acknowledged_by_name: string | null;
  acknowledged_at: string | null;
  note: string | null;
}

export type InputSourceStatus = "included" | "nothing_due" | "not_available" | "blocked";

export interface InputSource {
  key: string;
  label: string;
  status: InputSourceStatus;
  message: string;
  item_count: number;
}

export interface InputNotice {
  key: string;
  label: string;
  message: string;
}

export interface PayrollRun {
  id: string;
  legal_entity_id: string;
  legal_entity_name: string | null;
  period_year: number;
  period_month: number;
  effective_date: string;
  payment_date: string | null;
  run_type: RunType;
  status: RunStatus;
  employee_count: number;
  total_gross: string;
  total_deductions: string;
  total_net: string;
  total_employer_cost: string;
  variance_flags: VarianceFlag[];
  unacknowledged_variances: number;
  review_flags: string[];
  input_sources: InputSource[];
  input_notices: InputNotice[];
  rule_set_snapshot: Record<string, string>;
  error_log: string | null;
  processed_at: string | null;
  computed_by_user_id: string | null;
  computed_by_name: string | null;
  approved_by_user_id: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  published_at: string | null;
  published_by_name: string | null;
  paid_at: string | null;
  paid_by_name: string | null;
  /** A run discarded before approval: when, by whom and why. */
  cancelled_at?: string | null;
  cancelled_by_name?: string | null;
  cancel_reason?: string | null;
  created_at: string;
  caller_may_approve: boolean;
  /** Off-cycle, bonus and arrear runs: who and what they pay, and why. */
  employee_scope: string[];
  included_sources: string[] | null;
  reason: string | null;
}

export interface PayrollRunInput {
  legal_entity_id: string;
  period_year: number;
  period_month: number;
  payment_date?: string | null;
  run_type?: RunType;
  employee_ids?: string[];
  included_sources?: string[];
  reason?: string | null;
}

/** An input source a supplementary run can draw on. */
export interface InputSourceOption {
  key: string;
  label: string;
}

export interface PayslipLine {
  code: string;
  name: string;
  type: string;
  amount: string;
  basis: string;
  rule_set_id: string | null;
}

export interface PayslipInputLine {
  provider: string;
  code: string;
  name: string;
  kind: "earning" | "reimbursement" | "deduction" | "recovery" | "perquisite" | "employer_contribution";
  amount: string;
  requested: string;
  taxable_amount: string;
  basis: string;
  source: Record<string, unknown>;
  skipped: boolean;
  recovery: Record<string, unknown> | null;
}

export interface RuleSetUsed {
  id: string;
  rule_type: string;
  jurisdiction: string;
  version: number;
  effective_from: string;
  effective_to: string | null;
  approved_at: string | null;
  source_reference: string | null;
}

export interface TdsWorking {
  financial_year: string;
  rule_set_id: string;
  regime: string;
  declaration_basis: string;
  months_remaining: number;
  projection: Record<string, string | number>;
  annual_liability_excluding_this_month_one_off: string;
  annual_liability: string;
  tds_already_deducted: string;
  /** Tax for months paid on the previous payroll, at the year's steady rate. */
  tds_assumed_deducted_by_previous_payroll?: string;
  recurring_tds: string;
  one_off_tds: string;
  tds: string;
  computation: {
    gross_annual_income: string;
    total_exemptions: string;
    total_deductions: string;
    taxable_income: string;
    tax_before_rebate: string;
    rebate: string;
    surcharge: string;
    cess: string;
    annual_tax_liability: string;
    slabs: { from: string; to: string; rate: string; tax: string }[];
    deductions: {
      section: string;
      declared: string;
      accepted: string;
      allowed: string;
      ceiling: string | null;
      capped: boolean;
      note: string;
    }[];
    notes: string[];
  };
}

export interface Payslip {
  id: string;
  run_id: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  designation: string | null;
  legal_entity_name: string | null;
  period_year: number;
  period_month: number;
  run_type: RunType;
  run_status: RunStatus;
  effective_date: string;
  payment_date: string | null;
  is_published: boolean;
  published_at: string | null;
  /** An off-cycle top-up for a month the regular run already paid. */
  is_supplementary: boolean;
  working_days: string;
  paid_days: string;
  lop_days: string;
  not_employed_days: string;
  gross_earnings: string;
  other_earnings: string;
  total_deductions: string;
  net_pay: string;
  employer_cost: string;
  pf_wage_base: string;
  esi_wage_base: string;
  pf_employee: string;
  pf_employer: string;
  esi_employee: string;
  esi_employer: string;
  professional_tax: string;
  lwf_employee: string;
  lwf_employer: string;
  vpf: string;
  tds: string;
  review_flags: string[];
  lines: PayslipLine[];
  input_lines: PayslipInputLine[];
  tds_working: TdsWorking | null;
  tds_note: string;
  rule_sets: RuleSetUsed[];
  salary: { id: string; structure_name: string | null; ctc_annual: string; effective_from: string } | null;
}

export interface PayslipSummary {
  id: string;
  run_id: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  period_year: number;
  period_month: number;
  run_type: RunType;
  run_status: RunStatus;
  gross_earnings: string;
  other_earnings: string;
  total_deductions: string;
  tds: string;
  net_pay: string;
  is_published: boolean;
  published_at: string | null;
}

export interface RegisterRow {
  payslip_id: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  working_days: string;
  paid_days: string;
  lop_days: string;
  not_employed_days: string;
  gross_earnings: string;
  other_earnings: string;
  pf_employee: string;
  esi_employee: string;
  professional_tax: string;
  lwf_employee: string;
  vpf: string;
  tds: string;
  other_deductions: string;
  total_deductions: string;
  net_pay: string;
  employer_cost: string;
  review_flags: string[];
  skipped_recoveries: number;
  has_variance: boolean;
}

export interface RunRegister {
  run: PayrollRun;
  rows: RegisterRow[];
  totals: Record<string, string>;
}

// ── Rule sets ───────────────────────────────────────────────────────────────

export type RuleType =
  | "pf"
  | "esi"
  | "professional_tax"
  | "tds"
  | "gratuity"
  | "bonus"
  | "labour_welfare_fund"
  | "tds_non_salary"
  | "wage_deductions";

export interface RuleSet {
  id: string;
  rule_type: RuleType | string;
  jurisdiction: string;
  version: number;
  effective_from: string;
  effective_to: string | null;
  rules: Record<string, unknown>;
  source_reference: string | null;
  notes: string | null;
  is_approved: boolean;
  approved_at: string | null;
  approved_by_user_id: string | null;
  approved_by_name: string | null;
  created_by_user_id: string | null;
  created_by_name: string | null;
  created_at: string;
  caller_may_approve: boolean;
}

export interface RuleSetInput {
  rule_type: RuleType;
  jurisdiction: string;
  effective_from: string;
  rules: Record<string, unknown>;
  source_reference: string;
  notes?: string | null;
}

// ── Salary structure ────────────────────────────────────────────────────────

export type ComponentType = "earning" | "deduction" | "employer_contribution" | "reimbursement";
export type CalculationType = "fixed" | "percentage_of" | "formula" | "balance";
export type RoundingMode = "half_up" | "half_even" | "ceiling" | "floor";

/** Where a wage type sits on the Salary master; finer than its component type. */
export type WageGroup =
  | "ctc_input"
  | "statutory_deduction"
  | "regular_earning"
  | "variable_earning"
  | "reimbursement"
  | "non_statutory_deduction"
  | "company_contribution"
  | "provision";

/** The kind of component each wage group holds. */
export const WAGE_GROUP_TYPE: Record<WageGroup, ComponentType> = {
  ctc_input: "employer_contribution",
  statutory_deduction: "deduction",
  regular_earning: "earning",
  variable_earning: "earning",
  reimbursement: "reimbursement",
  non_statutory_deduction: "deduction",
  company_contribution: "employer_contribution",
  provision: "employer_contribution",
};

/** A line with no group sits in its kind's usual one. */
export const DEFAULT_WAGE_GROUP: Record<ComponentType, WageGroup> = {
  earning: "regular_earning",
  reimbursement: "reimbursement",
  deduction: "non_statutory_deduction",
  employer_contribution: "company_contribution",
};

export interface SalaryComponent {
  id: string;
  code: string;
  name: string;
  component_type: ComponentType;
  calculation_type: CalculationType;
  base_component_code: string | null;
  value: string | null;
  formula: string | null;
  taxable: boolean;
  part_of_ctc: boolean;
  pro_rate_on_lop: boolean;
  counts_toward_pf: boolean;
  counts_toward_esi: boolean;
  display_order: number;
  is_system: boolean;
  active: boolean;
  wage_group?: WageGroup | null;
}

export interface SalaryComponentInput {
  code: string;
  name: string;
  component_type: ComponentType;
  calculation_type: CalculationType;
  base_component_code?: string | null;
  value?: string | null;
  formula?: string | null;
  taxable: boolean;
  part_of_ctc: boolean;
  pro_rate_on_lop: boolean;
  counts_toward_pf: boolean;
  counts_toward_esi: boolean;
  display_order: number;
  wage_group?: WageGroup | null;
}

export interface SalaryStructure {
  id: string;
  name: string;
  description: string | null;
  effective_from: string;
  effective_to: string | null;
  applicable_grades: string[];
  applicable_locations: string[];
  rounding_mode: RoundingMode;
  rounding_precision: number;
  active: boolean;
}

export interface StructureComponentDetail {
  component_code: string;
  component_name: string;
  component_type: ComponentType;
  calculation_type: CalculationType;
  value: string | null;
  base_component_code: string | null;
  formula: string | null;
  override_value: string | null;
  override_formula: string | null;
  override_base_component_code: string | null;
  counts_toward_pf: boolean;
  counts_toward_esi: boolean;
  part_of_ctc: boolean;
  display_order: number;
}

export interface SalaryStructureDetail extends SalaryStructure {
  components: StructureComponentDetail[];
}

export interface SalaryStructureInput {
  name: string;
  description?: string | null;
  effective_from: string;
  rounding_mode: RoundingMode;
  rounding_precision: number;
  components: {
    component_code: string;
    override_value?: string | null;
    display_order: number;
  }[];
}

export interface ResolvedComponent {
  code: string;
  name: string;
  component_type: ComponentType;
  annual_amount: string;
  monthly_amount: string;
  taxable: boolean;
  part_of_ctc: boolean;
  pro_rate_on_lop: boolean;
  counts_toward_pf: boolean;
  counts_toward_esi: boolean;
  display_order: number;
  /** Typed in for this employee rather than worked out by the structure. */
  is_manual?: boolean;
  wage_group?: WageGroup | null;
}

/** What one wage group adds up to. */
export interface SalaryGroupTotal {
  wage_group: WageGroup;
  monthly: string;
  annual: string;
}

/** What one kind of component (earnings, deductions…) adds up to. */
export interface SalaryTypeTotal {
  component_type: ComponentType;
  monthly: string;
  annual: string;
}

export interface SalaryBreakdown {
  structure_id: string;
  structure_name: string;
  ctc_annual: string;
  annual_total_in_ctc: string;
  monthly_total_in_ctc: string;
  components: ResolvedComponent[];
  totals?: SalaryTypeTotal[];
  group_totals?: SalaryGroupTotal[];
  /** MONTHLY GROSS: as typed when it was, else the earnings' sum. */
  gross_monthly?: string | null;
  gross_annual?: string | null;
  /** The earnings' own sum a month. */
  earnings_monthly?: string | null;
  /** What would stop these amounts from saving. */
  warnings?: string[];
}

export interface SalaryComponentAmount {
  component_code: string;
  component_name: string;
  component_type: ComponentType;
  annual_amount: string;
  monthly_amount: string;
  taxable: boolean;
  part_of_ctc: boolean;
  counts_toward_pf: boolean;
  counts_toward_esi: boolean;
  display_order: number;
  is_manual?: boolean;
  remarks?: string | null;
  /** How a typed amount was entered, so the editor shows it back as typed. */
  pay_basis?: PayBasis;
  /** The amount as typed, in its pay basis (a day's figure for a daily one). */
  entered_amount?: string | null;
  wage_group?: WageGroup | null;
}

export interface SalaryRecord {
  id: string;
  employee_id: string;
  structure_id: string;
  structure_name?: string | null;
  ctc_annual: string;
  currency: string;
  effective_from: string;
  effective_to: string | null;
  revision_reason: string | null;
  components: SalaryComponentAmount[];
}

export interface SalaryOverview {
  employee_id: string;
  employee_code: string;
  employee_name: string;
  designation: string | null;
  status: string;
  work_email?: string | null;
  photo_url?: string | null;
  current_salary: SalaryRecord | null;
}

export interface SalaryAssignInput {
  structure_id: string;
  ctc_annual: string;
  effective_from: string;
  revision_reason?: string | null;
}

// ── Salary master ───────────────────────────────────────────────────────────

/** Whether a typed amount is a month's or a year's figure. */
/** The Salary master's Pay Basis: what period a typed amount is for. */
export type PayBasis = "annual" | "monthly" | "weekly" | "daily" | "hourly";

/** One card on the Salary master timeline. */
export interface SalaryRevision {
  id: string;
  employee_id: string;
  structure_id: string;
  structure_name: string | null;
  ctc_annual: string;
  ctc_monthly: string;
  /** The CTC as typed: monthly when the year is exactly twelve months of it. */
  ctc_basis?: PayBasis;
  ctc_amount?: string | null;
  /** Every amount on it was typed by hand. */
  manual_entry?: boolean;
  /** MONTHLY GROSS as typed, in its pay basis; null when left to the earnings. */
  gross_amount?: string | null;
  gross_basis?: PayBasis | null;
  gross_annual?: string | null;
  earnings_monthly?: string | null;
  gross_monthly: string;
  basic_monthly: string | null;
  currency: string;
  effective_from: string;
  effective_to: string | null;
  revision_reason: string | null;
  attachment_name: string | null;
  components: SalaryComponentAmount[];
  totals: SalaryTypeTotal[];
  group_totals?: SalaryGroupTotal[];
  /** Payroll has used this revision, so it is history and cannot change. */
  locked: boolean;
  locked_reason: string | null;
  updated_at: string;
}

export interface SalaryComponentAmountInput {
  component_code: string;
  /** Empty lets the structure work it out. A string, never a JS number. */
  amount?: string | null;
  basis: PayBasis;
  remarks?: string | null;
}

/** A CTC (as a year or a month) and the wage types typed against it. */
export interface SalaryAmountsInput {
  /** "manual": every amount exactly as typed, the Salary master's way. */
  entry?: "structure" | "manual";
  ctc_amount?: string;
  ctc_basis?: PayBasis;
  gross_amount?: string | null;
  gross_basis?: PayBasis;
  ctc_annual?: string;
  ctc_monthly?: string;
  components: SalaryComponentAmountInput[];
}

export interface SalaryRevisionInput extends SalaryAmountsInput {
  structure_id: string;
  effective_from: string;
  revision_reason?: string | null;
  /** Edit only: carry the typed changes into every later revision. */
  apply_to_later_revisions?: boolean;
}

/** One change to a person's salary, from the audit log. */
export interface SalaryTrailEntry {
  id: string;
  at: string;
  action: "create" | "update" | "delete" | "export" | string;
  actor_name: string | null;
  summary: string | null;
  changes: Record<string, unknown>;
}

export interface StandardStatus {
  complete: boolean;
  missing: string[];
  outdated: string[];
  has_structure: boolean;
}

export interface StandardSetupResult {
  components_added: string[];
  components_renamed?: string[];
  structure_name: string | null;
  /** Why no structure was made: the workspace's own wage types differ. */
  structure_skipped?: string | null;
}

export interface SalaryImportRow {
  row: number;
  employee_code: string | null;
  employee_name: string | null;
  effective_from: string | null;
  structure_name: string | null;
  ctc_annual: string | null;
  gross_monthly: string | null;
  typed: number;
  status: "ready" | "error" | "skipped";
  message: string | null;
  /** On a ready row: what to know before saving (a CTC that differs, columns not used…). */
  notes?: string[];
}

export interface SalaryImportResult {
  filename: string;
  rows: SalaryImportRow[];
  ready: number;
  errors: number;
  skipped: number;
  /** Ready rows that carry notes. */
  noted?: number;
  applied: boolean;
}

export interface SalarySaveResult {
  id: string;
  effective_from: string;
  /** Months payroll already paid at the earlier amounts ("2026-08"): raise arrears. */
  paid_months_affected?: string[];
  /** Open runs worked out on the old amounts ("2026-08"): recompute them. */
  runs_to_recompute?: string[];
  /** Later revisions an "update later revisions" save reached. */
  carried_forward_to?: string[];
}

// ── Statutory ───────────────────────────────────────────────────────────────

export interface PfElection {
  id: string;
  employee_id: string;
  effective_from: string;
  effective_to: string | null;
  pf_on_actual_wage: boolean;
  vpf_percentage: string | null;
  vpf_fixed_amount: string | null;
}

export interface WorkLocation {
  id: string;
  employee_id: string;
  location_id: string;
  effective_from: string;
  effective_to: string | null;
  reason: string | null;
}

export interface EsiCoverage {
  id: string;
  employee_id: string;
  period_label: string;
  period_start_month: number;
  period_end_month: number;
  was_contributing_at_start: boolean;
  opening_wage: string;
  ceiling_crossed_on: string | null;
}

export type BonusStatus = "draft" | "approved" | "paid";

export interface BonusComputation {
  id: string;
  employee_id: string;
  financial_year: string;
  is_eligible: boolean;
  ineligibility_reason: string | null;
  eligible_wage: string;
  days_worked: string;
  total_working_days: string;
  percentage: string;
  amount: string;
  status: BonusStatus;
  paid_on: string | null;
  paid_in_run_id: string | null;
  working: Record<string, unknown>;
}

export interface RegisterFormat {
  code: string;
  title: string;
  prescribed_by: string;
  columns: string[];
}

export interface RenderedRegister {
  code: string;
  title: string;
  prescribed_by: string;
  heading_lines: string[];
  headings: string[];
  rows: string[][];
  totals: Record<string, string>;
  row_count: number;
  notes: string[];
  excluded: string[];
}

// ── Org ─────────────────────────────────────────────────────────────────────

export interface EntityOption {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
}

export interface LocationOption {
  id: string;
  legal_entity_id: string;
  name: string;
  code: string;
  city: string | null;
  state_code: string;
  is_active: boolean;
}
