/**
 * Expense, travel, advance and GST input credit types (slices 31 and 34).
 *
 * These mirror `backend/app/schemas/expenses.py`, `schemas/gst.py` and the
 * dictionaries the expense and GST services return. Every amount is a decimal
 * string and stays a string on screen.
 */

export type CityTier = "a" | "b" | "c" | "international";
export type LimitType = "per_claim" | "per_day" | "per_month" | "per_trip";
export type ViolationAction = "block" | "flag" | "require_justification";
export type ClaimKind = "receipted" | "mileage" | "per_diem";
export type ConversionConvention = "transaction_date" | "settlement_date";

export type PolicyVerdictKind =
  | "within_policy"
  | "needs_justification"
  | "flagged"
  | "blocked"
  | "receipt_required"
  | "pre_approval_required"
  | "no_rule";

/** `submitted` is the finance stage; `pending_manager` comes before it. */
export type ClaimStatus =
  | "draft"
  | "pending_manager"
  | "submitted"
  | "approved"
  | "rejected"
  | "reimbursed"
  | "cancelled";
export type ReportStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "partially_approved"
  | "rejected"
  | "cancelled";
export type TravelRequestStatus =
  | "draft"
  | "pending_manager"
  | "submitted"
  | "approved"
  | "rejected"
  | "cancelled"
  | "completed";
export type AdvanceStatus = "issued" | "settled" | "cancelled";

// ── Policy verdict (returned at capture) ────────────────────────────────────

export interface PolicyRuleSummary {
  category_key: string;
  city_tier: CityTier;
  limit_type: LimitType;
  limit_amount: string;
  violation_action: ViolationAction;
  requires_receipt: boolean;
  receipt_threshold: string;
  requires_pre_approval: boolean;
  is_per_diem: boolean;
}

export interface PolicyVerdict {
  kind: PolicyVerdictKind;
  permits_submission: boolean;
  is_violation: boolean;
  limit_amount: string | null;
  already_claimed: string;
  this_claim: string;
  overage: string;
  message: string;
  rule: PolicyRuleSummary | null;
}

export interface MileageDetail {
  distance_km: string;
  rate_per_km: string;
  amount: string;
  declared_route_km: string | null;
  variance_percent: string | null;
  exceeds_tolerance: boolean;
  note: string;
}

export interface ConversionDetail {
  original_amount: string;
  original_currency: string;
  converted_amount: string;
  converted_currency: string;
  rate: string;
  rate_date: string;
  convention: ConversionConvention;
  rate_source: string;
  note: string;
}

/** `POST /expenses/claims` — the verdict comes back with the capture. */
export interface CaptureResult {
  claim_id: string;
  status: ClaimStatus;
  amount: string;
  original_amount: string;
  original_currency: string;
  verdict: PolicyVerdict;
  mileage: MileageDetail | null;
  conversion: ConversionDetail | null;
  may_submit: boolean;
}

export interface ClaimInput {
  employee_id?: string | null;
  category_key: string;
  city_tier: CityTier;
  amount: string;
  incurred_on: string;
  kind: ClaimKind;
  currency: string;
  settlement_date?: string | null;
  /** Finance only. Everybody else attaches a receipt. */
  has_receipt?: boolean;
  justification?: string | null;
  description?: string | null;
  travel_request_id?: string | null;
  report_id?: string | null;
  receipt_document_id?: string | null;
  distance_km?: string | null;
  route_km?: string | null;
  vehicle_type?: string | null;
  per_diem_days?: number | null;
}

export interface Claim {
  id: string;
  employee_id: string;
  employee_code: string | null;
  employee_name: string | null;
  report_id: string | null;
  travel_request_id: string | null;
  category_key: string;
  city_tier: CityTier;
  kind: ClaimKind;
  amount: string;
  original_amount: string;
  original_currency: string;
  exchange_rate: string | null;
  exchange_rate_date: string | null;
  conversion_convention: ConversionConvention | null;
  exchange_rate_source: string | null;
  incurred_on: string;
  description: string | null;
  has_receipt: boolean;
  receipt_document_id: string | null;
  distance_km: string | null;
  route_km: string | null;
  vehicle_type: string | null;
  per_diem_days: number | null;
  status: ClaimStatus;
  policy_verdict: PolicyVerdictKind;
  verdict_message: string;
  limit_amount: string | null;
  already_claimed: string;
  overage: string;
  justification: string | null;
  flagged_for_approver: boolean;
  exceeds_route_tolerance: boolean;
  evaluated_at: string;
  submitted_at: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string | null;
  /** The line manager's stage. */
  manager_decided_at: string | null;
  manager_decision_note: string | null;
  manager_decided_by_name: string | null;
  /** How the claim was paid, once it was. */
  reimbursed_in_run_id: string | null;
  reimbursed_at: string | null;
  advance_settlement_id: string | null;
  /** "October 2026" — the payroll month that paid it. */
  reimbursed_in_period: string | null;
  /** The paying run's status: "approved" (not yet sent) or "paid". */
  reimbursed_run_status: string | null;
  /** One sentence for the claimant: where the money is. */
  payment_note: string | null;
}

export interface SubmitClaimResult {
  claim_id: string;
  status: ClaimStatus;
  policy_verdict: PolicyVerdictKind;
  flagged_for_approver: boolean;
  justification: string | null;
}

export interface DecisionInput {
  approve: boolean;
  /** Required when rejecting. */
  note?: string | null;
}

export interface Receipt {
  id: string;
  employee_id: string;
  content_type: string;
  size_bytes: number;
  sha256: string;
  display_name: string;
  created_at: string | null;
}

export interface ExpenseReport {
  id: string;
  employee_id: string;
  employee_name: string | null;
  title: string;
  travel_request_id: string | null;
  status: ReportStatus;
  submitted_at: string | null;
  decided_at: string | null;
  created_at: string | null;
  line_count: number;
  total_amount: string;
  blocked_lines: number;
  lines: Claim[];
}

export interface ReportInput {
  title: string;
  travel_request_id?: string | null;
  employee_id?: string | null;
}

export interface ReportSubmitInput {
  /** Claim id → written reason, for lines whose verdict needs one. */
  justifications: Record<string, string>;
}

// ── Travel and advances ─────────────────────────────────────────────────────

export interface TravelDestination {
  city: string;
  city_tier?: CityTier;
}

export interface TravelRequestInput {
  employee_id?: string | null;
  purpose: string;
  from_date: string;
  to_date: string;
  destinations: TravelDestination[];
  estimated_cost: string;
  advance_requested: string;
}

export interface TravelApproval {
  user_id: string;
  /** Absent on decisions recorded before the manager stage existed. */
  name?: string;
  stage?: "manager" | "finance";
  decision: "approved" | "rejected";
  at: string;
  note: string;
}

export interface TravelRequest {
  id: string;
  employee_id: string;
  employee_code: string | null;
  employee_name: string | null;
  purpose: string;
  from_date: string;
  to_date: string;
  destinations: TravelDestination[];
  estimated_cost: string;
  advance_requested: string;
  advance_issued: string;
  status: TravelRequestStatus;
  approvals: TravelApproval[];
  decided_at: string | null;
  created_at: string | null;
}

export interface Advance {
  id: string;
  travel_request_id: string;
  trip_purpose: string | null;
  trip_to_date: string | null;
  employee_id: string;
  employee_code: string | null;
  employee_name: string | null;
  amount: string;
  issued_on: string;
  status: AdvanceStatus;
  claimed_against: string;
  settled_on: string | null;
  recovered_amount: string;
  refunded_amount: string;
  outstanding: string;
  age_days: number;
  is_blocking: boolean;
  payroll_recovery_ref: string | null;
  /** Null until a payroll run pays a balance owed to the employee. */
  payroll_refund_ref: string | null;
}

export interface AdvanceInput {
  travel_request_id: string;
  amount: string;
  issued_on: string;
}

export interface BlockStatus {
  employee_id: string;
  permitted: boolean;
  message: string;
  block_after_days: number;
  blocking_count: number;
  total_outstanding: string;
}

export interface AgeingReport {
  as_of: string;
  block_after_days: number;
  total_outstanding: string;
  buckets: Record<"0-30" | "31-45" | "46-90" | "over_90", { count: number; amount: string }>;
  blocking_count: number;
}

export type SettlementOutcome = "square" | "refund_due_to_employee" | "recovery_due_from_employee";

export interface SettlementResult {
  advance_id: string;
  trip_id: string;
  advance_amount: string;
  claims_total: string;
  outcome: SettlementOutcome;
  recovery_amount: string;
  refund_amount: string;
  needs_payroll_recovery: boolean;
  message: string;
  claim_count: number;
  payroll_recovery: {
    required: boolean;
    amount: string;
    reference: string | null;
    note: string;
  } | null;
  /** A trip that cost more than its advance: the balance, paid in payroll. */
  payroll_refund: {
    amount: string;
    reference: string | null;
    note: string;
  } | null;
}

export interface ReviewQueue {
  claims: Claim[];
  travel_requests: TravelRequest[];
  advances_to_settle: Advance[];
  excluded_own: number;
}

/** `GET /expenses/team-queue` — waiting for a line manager's decision. */
export interface TeamQueue {
  claims: Claim[];
  travel_requests: TravelRequest[];
  /** True for HR, who can stand in for any manager. */
  covers_everyone: boolean;
  excluded_own: number;
}

// ── Configuration ───────────────────────────────────────────────────────────

export interface ExpenseMeta {
  reporting_currency: string;
  conversion_convention: ConversionConvention;
  rate_source: string;
  categories: string[];
  vehicle_types: string[];
  currencies: string[];
  city_tiers: CityTier[];
  claim_kinds: ClaimKind[];
  receipt_max_bytes: number;
  receipt_types: string[];
}

export interface PolicyRule extends PolicyRuleSummary {
  id: string;
}

export interface Policy {
  id: string;
  name: string;
  description: string | null;
  effective_from: string;
  applicable_grades: string[];
  applicable_locations: string[];
  is_active: boolean;
  created_at: string | null;
  rules: PolicyRule[];
}

export interface RuleInput {
  category_key: string;
  city_tier: CityTier;
  limit_type: LimitType;
  limit_amount: string;
  violation_action: ViolationAction;
  requires_receipt: boolean;
  receipt_threshold: string;
  requires_pre_approval: boolean;
  is_per_diem: boolean;
}

export interface PolicyInput {
  name: string;
  effective_from: string;
  description?: string | null;
  applicable_grades: string[];
  applicable_locations: string[];
  rules: RuleInput[];
}

export interface CityTierRow {
  location_id: string;
  location_name: string;
  city: string | null;
  city_tier: CityTier | null;
  note: string | null;
}

export interface MileageRate {
  id: string;
  vehicle_type: string;
  rate_per_km: string;
  effective_from: string;
  tolerance_percent: string;
}

export interface PerDiemRate {
  id: string;
  city_tier: CityTier;
  grade: string;
  amount: string;
  effective_from: string;
  includes_meals: boolean;
  includes_accommodation: boolean;
}

export interface ExchangeRate {
  id: string;
  from_currency: string;
  to_currency: string;
  rate: string;
  quote_date: string;
  source: string;
}

export interface ExpenseSettings {
  conversion_convention: ConversionConvention;
  rate_source: string;
  reporting_currency: string;
  advance_block_after_days: number;
}

export interface ViolationRateGroup {
  scope: "employee" | "department" | "category";
  key: string;
  total_claims: number;
  violations: number;
  /** Null below a usable sample size. */
  rate: number | null;
  interpretation: string;
}

export interface ViolationRates {
  scope: "employee" | "department" | "category";
  peer_rate: number | null;
  groups: ViolationRateGroup[];
  note: string;
}

export interface ExpensePosture {
  enforced: string[];
  not_built: string[];
}

// ── GST ─────────────────────────────────────────────────────────────────────

export type GstEligibility = "eligible" | "ineligible" | "uncertain";
export type Gstr2bMatch = "not_reconciled" | "matched" | "missing_in_2b" | "value_mismatch";

export interface GstinVerdict {
  gstin: string;
  is_valid: boolean;
  problem: string;
  state_code: string | null;
  state_name: string | null;
  pan: string | null;
  portal_status: string;
  blocks_the_expense: boolean;
  message: string;
}

export interface GstCaptureInput {
  vendor_gstin: string;
  invoice_number: string;
  invoice_date: string;
  category_key: string;
  taxable_value: string;
  expense_claim_id?: string | null;
  employee_id?: string | null;
  legal_entity_id?: string | null;
  cgst: string;
  sgst: string;
  igst: string;
  cess: string;
  supplier_state_code?: string | null;
  place_of_supply_state_code?: string | null;
  hsn_sac?: string | null;
}

export interface GstAssessment {
  eligibility: GstEligibility;
  reason: string;
  reference: string;
  tax_split: string | null;
  claimable_amount: string;
  amount_at_stake: string;
  needs_review: boolean;
}

export interface GstCaptureResult {
  credit_id: string;
  gstin: GstinVerdict;
  assessment: GstAssessment;
  duplicate_of: string[];
  duplicate_across_employees: boolean;
  expense_recorded: boolean;
  note: string;
}

export interface GstCredit {
  id: string;
  legal_entity_id: string | null;
  expense_claim_id: string | null;
  employee_id: string | null;
  vendor_gstin: string;
  gstin_is_valid: boolean;
  gstin_problem: string | null;
  gstin_portal_status: string;
  invoice_number: string;
  invoice_date: string;
  category_key: string;
  taxable_value: string;
  cgst: string;
  sgst: string;
  igst: string;
  cess: string;
  hsn_sac: string | null;
  supplier_state_code: string | null;
  place_of_supply_state_code: string | null;
  recipient_state_code: string | null;
  tax_split: string | null;
  eligibility: GstEligibility;
  eligibility_reason: string;
  eligibility_reference: string;
  claimable_amount: string;
  amount_at_stake: string;
  reconciliation_status: Gstr2bMatch;
  gstr2b_matched_at: string | null;
  created_at: string | null;
}

export interface GstReviewQueue {
  count: number;
  total_at_stake: string;
  lines: {
    credit_id: string;
    vendor_gstin: string;
    invoice_number: string;
    invoice_date: string;
    category_key: string;
    amount_at_stake: string;
    reason: string;
  }[];
  note: string;
}

export interface GstReviewInput {
  decision: "eligible" | "ineligible";
  rationale: string;
  decided_on: string;
}

export interface GstDashboard {
  period: string;
  captured_tax: string;
  eligible_tax: string;
  ineligible_tax: string;
  uncertain_tax: string;
  uncertain_lines: number;
  confirmed_claimable_tax: string;
  at_risk_from_unfiled_vendors: string;
  reconciled: boolean;
  note: string;
}

export interface GstRegisterLine {
  vendor_gstin: string;
  invoice_number: string;
  invoice_date: string;
  taxable_value: string;
  cgst: string;
  sgst: string;
  igst: string;
  cess: string;
  hsn_sac: string | null;
  place_of_supply: string | null;
  eligibility: GstEligibility;
  eligibility_reason: string;
  reconciliation_status: Gstr2bMatch;
}

export interface GstRegister {
  period_start: string;
  period_end: string;
  eligible: GstRegisterLine[];
  eligible_total_tax: string;
  awaiting_review: GstRegisterLine[];
  note: string;
}

export interface GstDuplicateGroup {
  vendor_gstin: string;
  normalised_invoice_number: string;
  claim_count: number;
  credit_ids: string[];
  employee_ids: string[];
  total_tax: string;
  across_employees: boolean;
  detail: string;
}

export interface GstDuplicates {
  duplicate_groups: number;
  across_employees: number;
  duplicates: GstDuplicateGroup[];
  note: string;
}

export interface Gstr2bImport {
  id: string;
  legal_entity_id: string | null;
  period_label: string;
  line_count: number;
  total_tax: string;
  imported_on: string;
  source_note: string | null;
  created_at: string | null;
}

export interface Gstr2bCsvResult {
  imported: { import_id: string; period_label: string; line_count: number; total_tax: string } | null;
  rows_read: number;
  errors: { row: number; error: string }[];
}

export interface GstReconcileInput {
  period_label: string;
  period_start: string;
  period_end: string;
  legal_entity_id?: string | null;
}

/** `POST /gst/reconciliations` — the engine's report. */
export interface GstReconciliationReport {
  period_label?: string;
  captured_lines: number;
  portal_lines: number;
  matched_tax: string;
  missing_in_2b_tax: string;
  missing_in_register_tax: string;
  at_risk_from_unfiled_vendors: string;
  counts: Record<string, number>;
  lines: { credit_id: string | null; state: Gstr2bMatch | string; [key: string]: unknown }[];
  [key: string]: unknown;
}

export interface GstReconciliation {
  id: string;
  legal_entity_id: string | null;
  period_label: string;
  captured_lines: number;
  portal_lines: number;
  matched_tax: string;
  missing_in_2b_tax: string;
  missing_in_register_tax: string;
  at_risk_tax: string;
  counts: Record<string, number>;
  run_on: string;
  created_at: string | null;
}

export interface GstEntityRegistration {
  id: string;
  legal_entity_id: string;
  gstin: string;
  state_code: string;
  state_name: string | null;
  is_active: boolean;
}

export interface GstBlockedCategory {
  id: string;
  category_key: string;
  reason: string;
  reference: string;
  has_exceptions: boolean;
  exception_note: string | null;
  reviewed: boolean;
  reviewed_by: string | null;
  reviewed_on: string | null;
}

export interface GstPosture {
  enforced: string[];
  not_built: string[];
  [key: string]: unknown;
}

// ── Additions for the finance, policy and GST screens ───────────────────────

/** `GET /expenses/advances/block-check` when permitted (a block is a 409). */
export interface AdvanceBlockCheck {
  permitted: true;
  ageing: AgeingReport;
}

export interface SettleInput {
  settled_on: string;
}

export interface CityTierInput {
  location_id: string;
  city_tier: CityTier;
  note?: string | null;
}

export interface MileageRateInput {
  vehicle_type: string;
  rate_per_km: string;
  effective_from: string;
  tolerance_percent?: string | null;
}

export interface PerDiemRateInput {
  city_tier: CityTier;
  grade: string;
  amount: string;
  effective_from: string;
  includes_meals: boolean;
  includes_accommodation: boolean;
}

export interface ExchangeRateInput {
  from_currency: string;
  to_currency: "INR";
  rate: string;
  quote_date: string;
  source: string;
}

export interface ExpenseSettingsInput {
  conversion_convention?: ConversionConvention;
  rate_source?: string;
  advance_block_after_days?: number;
}

export interface EntityRegistrationInput {
  legal_entity_id: string;
  gstin: string;
}

export interface BlockedCategoryInput {
  category_key: string;
  reason: string;
  reference: string;
  has_exceptions: boolean;
  exception_note: string | null;
  reviewed: boolean;
  reviewed_by: string | null;
  reviewed_on: string | null;
}

/** `GET /gst/blocked-categories/defaults` — the shipped, unreviewed reading. */
export interface BlockedCategoryDefaults {
  rules: {
    category_key: string;
    reason: string;
    reference: string;
    has_exceptions: boolean;
    exception_note: string | null;
    reviewed: boolean;
  }[];
  warning: string;
}

/** `GET /org/locations`, the fields these screens read. */
export interface OrgLocation {
  id: string;
  name: string;
  city: string | null;
  state_code: string;
}

/** `GET /org/legal-entities`, the fields these screens read. */
export interface OrgLegalEntity {
  id: string;
  name: string;
  code: string;
}
