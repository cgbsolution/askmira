/**
 * Payroll operations: return filings, bank disbursement, arrears, loans and
 * reimbursements, gratuity and encashment, exits and full & final.
 *
 * Mirrors the routers `filings.py`, `disbursement.py`, `arrears.py`,
 * `loans.py`, `exit_benefits.py` and `exit_workflow.py`. Every amount is a
 * decimal string.
 *
 * Financial-year formats differ by module and are the API's, not ours:
 *  - filings (24Q), loans and reimbursements: "2026-2027"
 *  - tax and leave encashment: "2026-27"
 */

// ── Shared ──────────────────────────────────────────────────────────────────

export interface LegalEntity {
  id: string;
  name: string;
  code: string;
  pan: string | null;
  tan: string | null;
  is_active: boolean;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  parent_id: string | null;
  head_employee_id: string | null;
  is_active: boolean;
}

export type PayrollRunStatus =
  | "draft"
  | "processing"
  | "pending_review"
  | "approved"
  | "paid"
  | "failed"
  | "cancelled";

/** From `GET /payroll/runs` (a Page). Only the fields these screens use. */
export interface PayrollRunSummary {
  id: string;
  legal_entity_id: string;
  period_year: number;
  period_month: number;
  run_type: string;
  status: PayrollRunStatus;
  employee_count: number;
}

export interface IssuedDocument {
  letter_id: string;
  reference_number: string;
  status: string;
  issued_at: string | null;
  content_hash: string;
}

// ── Filings (prompt 10) ─────────────────────────────────────────────────────

export type ReturnType = "pf_ecr" | "esic" | "professional_tax" | "tds_24q";
export type FilingStatus = "blocked" | "generated" | "filed" | "rejected";

export interface FilingException {
  severity: "blocking" | "warning";
  code: string;
  /** Usually the employee code, or the state for a PT challan. */
  subject: string;
  field: string;
  message: string;
}

export interface FilingRecord {
  id: string;
  return_type: ReturnType;
  legal_entity_id: string;
  period: string;
  jurisdiction: string | null;
  status: FilingStatus;
  file_name: string | null;
  content_hash: string | null;
  record_count: number;
  total_amount: string;
  generated_at: string | null;
  acknowledgement_number: string | null;
  filed_at: string | null;
  rejection_reason: string | null;
  validation_exceptions: FilingException[];
  has_file: boolean;
  created_at: string;
}

export interface GenerationResult {
  record: FilingRecord;
  warnings: FilingException[];
}

export interface MonthlyReturnInput {
  legal_entity_id: string;
  year: number;
  month: number;
}

export interface QuarterlyReturnInput {
  legal_entity_id: string;
  /** "2026-2027" */
  financial_year: string;
  quarter: number;
}

export interface AcknowledgementInput {
  acknowledgement_number: string;
  filed_at?: string | null;
}

export interface TdsChallan {
  id: string;
  legal_entity_id: string;
  bsr_code: string;
  deposit_date: string;
  challan_serial: string;
  financial_year: string;
  quarter: number;
  tds_amount: string;
  total_amount: string;
  is_book_entry: boolean;
}

export interface TdsChallanInput {
  legal_entity_id: string;
  bsr_code: string;
  deposit_date: string;
  challan_serial: string;
  financial_year: string;
  quarter: number;
  tds_amount: string;
  surcharge: string;
  education_cess: string;
  interest: string;
  late_fee: string;
  /** Must equal the sum of the parts; the API refuses otherwise. */
  total_amount: string;
  is_book_entry: boolean;
}

export interface UnmappedTds {
  payslip_id: string;
  employee_code: string;
  employee_name: string;
  period: string;
  tds_amount: string;
}

export interface ChallanMappingInput {
  challan_id: string;
  payslip_id: string;
  tds_amount: string;
  deduction_date: string;
}

// ── Bank disbursement (prompt 11) ───────────────────────────────────────────

export type BankFileFormat = "hdfc" | "icici" | "sbi" | "axis" | "kotak" | "generic_neft";
export type VerificationMethod = "penny_drop" | "manual" | "none";
export type DisbursementStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "released"
  | "acknowledged"
  | "failed";
export type LineStatus = "pending" | "credited" | "failed" | "reissued";

export interface DisbursementException {
  code: string;
  subject: string;
  field: string;
  message: string;
}

export interface BankProfile {
  id: string;
  legal_entity_id: string;
  bank_name: string;
  ifsc: string;
  corporate_id: string | null;
  file_format: BankFileFormat;
  format_config: Record<string, unknown>;
  active: boolean;
}

export interface BankProfileInput {
  legal_entity_id: string;
  bank_name: string;
  account_number: string;
  ifsc: string;
  corporate_id?: string | null;
  file_format: BankFileFormat;
}

export interface EmployeeBankAccount {
  id: string;
  employee_id: string;
  employee_code: string | null;
  employee_name: string | null;
  ifsc: string;
  account_holder_name: string;
  bank_name: string | null;
  is_primary: boolean;
  verified_at: string | null;
  verification_method: VerificationMethod;
}

export interface BankAccountInput {
  employee_id: string;
  account_number: string;
  ifsc: string;
  account_holder_name: string;
  bank_name?: string | null;
  verification_method: VerificationMethod;
}

export interface DisbursementBatch {
  id: string;
  payroll_run_id: string;
  bank_profile_id: string;
  supplements_batch_id: string | null;
  status: DisbursementStatus;
  total_amount: string;
  employee_count: number;
  value_date: string | null;
  file_name: string | null;
  file_hash: string | null;
  prepared_by_user_id: string | null;
  prepared_by_name: string | null;
  prepared_at: string | null;
  approved_by_user_id: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  released_at: string | null;
  validation_exceptions: DisbursementException[];
  notes: string | null;
}

export interface DisbursementLine {
  id: string;
  employee_id: string;
  employee_code: string | null;
  employee_name: string | null;
  amount: string;
  ifsc: string;
  beneficiary_name: string;
  status: LineStatus;
  failure_reason: string | null;
  bank_reference: string | null;
}

export interface BatchPrepareInput {
  payroll_run_id: string;
  bank_profile_id: string;
  value_date: string;
}

export interface ReconcileOutcome {
  credited: number;
  failed: { line_id: string; employee_id: string; amount: string; reason: string }[];
  unmatched: string[];
  /** People in HR notified about failed credits. */
  notified: number;
  /** Rows of an imported file that could not be read. */
  parse_errors: string[];
}

// ── Arrears (prompt 12) ─────────────────────────────────────────────────────

export type RevisionType = "increment" | "promotion" | "correction" | "arrear_only";
export type ArrearStatus = "preview" | "pending_approval" | "approved" | "paid" | "cancelled";

export interface ArrearComponentDiff {
  code: string;
  name: string;
  component_type: string;
  paid: string;
  should_have_been: string;
  difference: string;
}

export interface ArrearPeriod {
  period: string;
  earnings_arrear: string;
  employee_deduction_arrear: string;
  employer_contribution_arrear: string;
  net_payable: string;
  rule_set_ids: Record<string, string>;
  components: ArrearComponentDiff[];
  notes: string[];
}

export interface ArrearSummary {
  employee_count: number;
  period_count: number;
  earnings: string;
  employee_deductions: string;
  employer_contributions: string;
  net_payable: string;
  affected_filings: string[];
}

export interface ArrearGuardrail {
  employee_id: string;
  employee_code: string | null;
  message: string;
}

export interface ArrearPreview {
  summary: ArrearSummary;
  per_employee: Record<string, ArrearPeriod[]>;
  /** Refusals the commit would raise (before joining, attendance not locked). */
  guardrails: ArrearGuardrail[];
  employees: Record<string, { employee_code: string; employee_name: string }>;
}

export interface RevisionItemInput {
  employee_id: string;
  new_salary_id: string;
  previous_salary_id?: string | null;
}

export interface ArrearPreviewInput {
  legal_entity_id: string;
  effective_from: string;
  revisions: RevisionItemInput[];
}

export interface RevisionInput extends ArrearPreviewInput {
  revision_type: RevisionType;
  reason?: string | null;
  additional_approval_threshold?: string | null;
}

export interface ArrearBatch {
  id: string;
  legal_entity_id: string;
  from_period: string;
  to_period: string;
  status: ArrearStatus;
  employee_count: number;
  total_earnings_arrear: string;
  total_employee_deduction_arrear: string;
  total_employer_contribution_arrear: string;
  total_net_payable: string;
  affected_filings: string[];
  requires_additional_approval: boolean;
  /** First approval recorded; a second, different approver is still needed. */
  awaiting_additional_approval: boolean;
  computed_at: string | null;
  computed_by_user_id: string | null;
  approved_at: string | null;
  approved_by_user_id: string | null;
  additional_approved_at: string | null;
  additional_approved_by_user_id: string | null;
  paid_in_run_id: string | null;
}

export interface ArrearLine {
  id: string;
  employee_id: string;
  employee_code: string | null;
  employee_name: string | null;
  period: string;
  component_code: string;
  component_name: string;
  component_type: string;
  paid_amount: string;
  should_have_been_amount: string;
  difference: string;
  rule_set_id: string | null;
}

export interface SalaryRevision {
  id: string;
  employee_id: string;
  effective_from: string;
  revision_type: RevisionType;
  reason: string | null;
  processed_at: string | null;
  arrear_batch_id: string | null;
}

/** From `GET /employees/{employee_id}/salary/history`. */
export interface EmployeeSalary {
  id: string;
  employee_id: string;
  structure_id: string;
  ctc_annual: string;
  effective_from: string;
  effective_to: string | null;
  revision_reason: string | null;
}

export interface ReliefYears {
  employee_id: string;
  /** Tax-format financial year of receipt, e.g. "2026-27". */
  receipt_financial_year: string;
  arrear_amount: string;
  /** Earlier years the arrear relates to. Receipt year excluded. */
  years: { financial_year: string; arrear_portion: string }[];
}

export interface ReliefInput {
  employee_id: string;
  receipt_financial_year: string;
  regime: "old" | "new";
  receipt_year_taxable_income: string;
  prior_years: { financial_year: string; regime: "old" | "new"; original_taxable_income: string }[];
}

export interface ReliefAllocation {
  financial_year: string;
  original_income: string;
  arrear_portion: string;
  tax_on_original: string;
  tax_with_arrear: string;
  additional_tax: string;
}

export interface ReliefWorking {
  arrear_amount: string;
  receipt_year: string;
  tax_without_relief: string;
  tax_with_spreading: string;
  relief_amount: string;
  is_beneficial: boolean;
  allocations: ReliefAllocation[];
  notes: string[];
}

export interface SectionRelief {
  id: string;
  employee_id: string;
  employee_code: string | null;
  employee_name: string | null;
  arrear_batch_id: string;
  financial_year: string;
  arrear_amount: string;
  tax_without_relief: string;
  tax_with_spreading: string;
  relief_amount: string;
  is_beneficial: boolean;
  working: ReliefWorking;
  form_10e_letter_id: string | null;
}

// ── Loans and reimbursements (prompt 14) ────────────────────────────────────

export type LoanType = "salary_advance" | "company_loan";
export type InterestType = "simple" | "reducing" | "interest_free";
export type LoanStatus =
  | "applied"
  | "approved"
  | "rejected"
  | "disbursed"
  | "active"
  | "closed"
  | "written_off";
export type ClaimStatus = "submitted" | "verified" | "rejected" | "partial";

export interface LoanScheme {
  id: string;
  name: string;
  loan_type: LoanType;
  interest_type: InterestType;
  interest_rate: string;
  max_tenure_months: number;
  max_amount: string | null;
  max_amount_as_multiple_of_salary: string | null;
  eligibility_min_service_months: number;
  moratorium_months: number;
  minimum_net_pay: string;
  allow_partial_recovery: boolean;
  requires_approval: boolean;
  active: boolean;
}

export interface LoanSchemeInput {
  name: string;
  loan_type: LoanType;
  interest_type: InterestType;
  interest_rate: string;
  max_tenure_months: number;
  max_amount?: string | null;
  max_amount_as_multiple_of_salary?: string | null;
  eligibility_min_service_months: number;
  moratorium_months: number;
  accrue_interest_during_moratorium: boolean;
  minimum_net_pay: string;
  allow_partial_recovery: boolean;
  requires_approval: boolean;
}

export interface LoanAccount {
  id: string;
  employee_id: string;
  employee_code: string | null;
  employee_name: string | null;
  scheme_id: string;
  scheme_name: string | null;
  status: LoanStatus;
  principal: string;
  interest_rate: string;
  interest_type: InterestType;
  tenure_months: number;
  emi_amount: string;
  outstanding_principal: string;
  carried_forward: string;
  purpose: string | null;
  decision_note: string | null;
  applied_at: string | null;
  approved_at: string | null;
  disbursed_at: string | null;
  closed_at: string | null;
}

/** Employee applying for themselves (`POST /loans/mine`). */
export interface LoanApplyInput {
  scheme_id: string;
  principal: string;
  tenure_months: number;
  purpose?: string | null;
}

/** HR applying on someone's behalf (`POST /loans`). */
export interface LoanApplyForInput extends LoanApplyInput {
  employee_id: string;
}

export interface LoanInstalment {
  number: number;
  emi: string;
  principal: string;
  interest: string;
  closing_balance: string;
  is_moratorium: boolean;
}

export interface LoanSchedule {
  principal: string;
  annual_rate: string;
  tenure_months: number;
  emi: string;
  total_principal: string;
  total_interest: string;
  reconciles: boolean;
  instalments: LoanInstalment[];
  notes: string[];
}

export interface LoanRepayment {
  id: string;
  period: string;
  amount: string;
  principal_component: string;
  interest_component: string;
  closing_balance: string;
  is_skipped: boolean;
  is_prepayment: boolean;
  reason: string;
}

export interface LoanDetail {
  loan: LoanAccount;
  schedule: LoanSchedule | null;
  repayments: LoanRepayment[];
}

export interface PrepaymentInput {
  amount: string;
  mode: "reduce_emi" | "reduce_tenure";
}

export interface ReimbursementComponent {
  id: string;
  code: string;
  name: string;
  annual_entitlement: string;
  exemption_basis: string | null;
  bill_required: boolean;
  carry_forward_within_year: boolean;
  reminder_months_before_year_end: number;
  active: boolean;
}

export interface ReimbursementComponentInput {
  code: string;
  name: string;
  annual_entitlement: string;
  exemption_basis?: string | null;
  bill_required: boolean;
  carry_forward_within_year: boolean;
  reminder_months_before_year_end: number;
}

export interface ReimbursementClaim {
  id: string;
  employee_id: string;
  employee_code: string | null;
  employee_name: string | null;
  component_code: string;
  component_name: string | null;
  financial_year: string;
  amount: string;
  accepted_amount: string;
  status: ClaimStatus;
  bill_date: string | null;
  bill_reference: string | null;
  has_bill: boolean;
  verification_note: string | null;
  verified_at: string | null;
  created_at: string;
}

export interface ClaimVerifyInput {
  status: Exclude<ClaimStatus, "submitted">;
  accepted_amount: string;
  verification_note?: string | null;
}

export interface EntitlementPosition {
  component_code: string;
  component_name: string;
  financial_year: string;
  entitlement: string;
  claimed: string;
  accepted: string;
  unclaimed: string;
  excess_accepted: string;
  taxable_if_year_ended_now: string;
  notes: string[];
  should_warn: boolean;
  warning: string;
}

// ── Gratuity and leave encashment (prompt 08) ───────────────────────────────

export type ServiceRounding =
  | "nearest_year_six_month_rule"
  | "always_round_down"
  | "always_round_up"
  | "exact_fraction";
export type ExitReason =
  | "resignation"
  | "retirement"
  | "termination"
  | "death"
  | "disablement"
  | "end_of_contract";
export type EncashmentStatus = "requested" | "approved" | "rejected" | "paid" | "cancelled";

export interface GratuityConfig {
  id: string;
  eligibility_years: number;
  eligibility_days_in_final_year: number | null;
  formula_basis: string[];
  days_per_year_divisor: number;
  days_per_year: string;
  max_exempt_amount: string;
  max_payable_amount: string | null;
  service_rounding: ServiceRounding;
  unpaid_leave_break_threshold_days: number | null;
  include_notice_period_in_service: boolean;
  eligibility_waived_reasons: string[];
  is_approved: boolean;
  approved_at: string | null;
}

export interface GratuityConfigInput {
  eligibility_years: number;
  eligibility_days_in_final_year: number | null;
  formula_basis: string[];
  days_per_year_divisor: number;
  days_per_year: string;
  max_exempt_amount: string;
  max_payable_amount: string | null;
  service_rounding: ServiceRounding;
  unpaid_leave_break_threshold_days: number | null;
  include_notice_period_in_service: boolean;
  eligibility_waived_reasons: string[];
}

export interface GratuityAccrual {
  id: string;
  employee_id: string;
  employee_code: string | null;
  employee_name: string | null;
  department_id: string | null;
  as_of_date: string;
  service_days: number;
  service_years: string;
  is_eligible: boolean;
  monthly_wages: string;
  eligible_amount: string;
  working: Record<string, unknown>;
}

export interface AccrualRunResult {
  as_of: string;
  employees: number;
  total_accrued_liability: string;
}

export interface GratuityLiability {
  as_of: string;
  employee_count: number;
  total_accrued_liability: string;
  eligible_liability: string;
  not_yet_eligible_liability: string;
  by_department: {
    department_id: string;
    department_name: string;
    employee_count: number;
    accrued_liability: string;
  }[];
  by_tenure_band: { band: string; accrued_liability: string }[];
  /** The department and tenure breakdowns tie back to the total, to the rupee. */
  reconciles: boolean;
}

export interface GratuityPayout {
  id: string;
  employee_id: string;
  employee_code: string | null;
  employee_name: string | null;
  exit_date: string;
  exit_reason: ExitReason;
  service_years: string;
  gross_amount: string;
  exempt_amount: string;
  taxable_amount: string;
  eligibility_waived: boolean;
  working: Record<string, unknown>;
}

export interface ExitGratuityInput {
  employee_id: string;
  exit_date: string;
  exit_reason: ExitReason;
  unpaid_leave_days: number;
}

export interface EncashmentPolicy {
  id: string;
  leave_type_code: string;
  encashable_on_exit: boolean;
  encashable_in_service: boolean;
  max_days_per_year: string | null;
  cap_days: string | null;
  min_balance_after_encashment: string;
  formula_basis: string[];
  days_per_month_divisor: number;
  exempt_on_retirement: boolean;
  retirement_exemption_ceiling: string | null;
  in_service_fully_taxable: boolean;
  active: boolean;
}

export interface EncashmentPolicyInput {
  leave_type_code: string;
  encashable_on_exit: boolean;
  encashable_in_service: boolean;
  max_days_per_year: string | null;
  cap_days: string | null;
  min_balance_after_encashment: string;
  formula_basis: string[];
  days_per_month_divisor: number;
  exempt_on_retirement: boolean;
  retirement_exemption_ceiling: string | null;
  in_service_fully_taxable: boolean;
}

export interface EncashmentRequest {
  id: string;
  employee_id: string;
  employee_code: string | null;
  employee_name: string | null;
  leave_type_code: string;
  financial_year: string;
  days_requested: string;
  days_approved: string;
  daily_rate: string;
  gross_amount: string;
  exempt_amount: string;
  taxable_amount: string;
  is_exit_encashment: boolean;
  status: EncashmentStatus;
  decision_note: string | null;
  decided_at: string | null;
  created_at: string;
  working: Record<string, unknown>;
}

export interface EncashmentRequestInput {
  leave_type_code: string;
  days: string;
  /** "2026-27" */
  financial_year: string;
  employee_id?: string | null;
}

// ── Exits and full & final (prompt 13) ──────────────────────────────────────

export type ExitType =
  | "resignation"
  | "termination"
  | "retirement"
  | "absconding"
  | "death"
  | "end_of_contract";
export type ExitStatus =
  | "initiated"
  | "notice_period"
  | "clearance_pending"
  | "settlement_pending"
  | "settled"
  | "on_hold"
  | "cancelled";
export type ClearanceStatus = "pending" | "cleared" | "cleared_with_recovery" | "waived";
export type SettlementStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "on_hold"
  | "paid"
  | "demand_raised";
/**
 * Who signs a clearance item off.
 *  - "hr": anyone in HR
 *  - "reporting_manager": the leaver's line manager (or HR)
 *  - "named_user": the specific person in `owner_user_id` (or HR)
 */
export type ClearanceOwnerRole = "hr" | "reporting_manager" | "named_user";

export interface ExitRecord {
  id: string;
  employee_id: string;
  employee_code: string | null;
  employee_name: string | null;
  exit_type: ExitType;
  status: ExitStatus;
  resignation_date: string;
  requested_last_working_day: string | null;
  approved_last_working_day: string | null;
  notice_period_days: number;
  notice_shortfall_days: number;
  notice_waived: boolean;
  notice_waiver_reason: string | null;
  reason: string | null;
  access_revoked_at: string | null;
  clearance_total: number;
  clearance_pending_mandatory: number;
  settlement_id: string | null;
  settlement_status: SettlementStatus | null;
  created_at: string;
  /** Self-resignation: submitted by the employee, waiting to be accepted. */
  initiated_by_employee: boolean;
  employee_comments: string | null;
  accepted_at: string | null;
  accepted_by_name: string | null;
  withdrawn_at: string | null;
  awaiting_acceptance: boolean;
  /** HR only; null for anybody else. */
  is_rehire_eligible?: boolean | null;
  rehire_note?: string | null;
  has_interview?: boolean;
}

export interface ExitCreateInput {
  employee_id: string;
  exit_type: ExitType;
  resignation_date: string;
  requested_last_working_day?: string | null;
  approved_last_working_day?: string | null;
  notice_period_days?: number | null;
  reason?: string | null;
}

export interface ClearanceTemplate {
  id: string;
  department: string;
  description: string;
  is_mandatory: boolean;
  display_order: number;
  active: boolean;
  owner_role: ClearanceOwnerRole;
  owner_user_id: string | null;
  owner_name: string | null;
}

export interface ClearanceTemplateInput {
  department: string;
  description: string;
  is_mandatory: boolean;
  display_order: number;
  owner_role: ClearanceOwnerRole;
  owner_user_id?: string | null;
}

export interface ClearanceItem {
  id: string;
  exit_record_id: string;
  department: string;
  description: string;
  is_mandatory: boolean;
  status: ClearanceStatus;
  recovery_amount: string;
  cleared_at: string | null;
  cleared_by_name: string | null;
  waiver_reason: string | null;
  notes: string | null;
  owner_role: ClearanceOwnerRole;
  owner_user_id: string | null;
  owner_name: string | null;
  /** Set on a "return this asset" item: not returned with no amount recovers its book value. */
  asset_assignment_id?: string | null;
  /** The caller may sign this item off. */
  can_update: boolean;
}

/** A clearance item waiting on the caller (`GET /exits/clearance/mine`). */
export interface ClearanceTask {
  item_id: string;
  exit_id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  photo_url: string | null;
  last_working_day: string | null;
  department: string;
  description: string;
  is_mandatory: boolean;
  owner_role: ClearanceOwnerRole;
  created_at: string;
}

export interface ClearanceUpdateInput {
  outcome: Exclude<ClearanceStatus, "pending">;
  recovery_amount: string;
  waiver_reason?: string | null;
  notes?: string | null;
}

/** Users who can own a clearance item (`GET /exits/clearance-owners`). */
export interface ClearanceOwnerCandidate {
  user_id: string;
  full_name: string;
  role: string;
}

export interface NoticeRecoveryInput {
  shortfall_days: number;
  monthly_wage: string;
  days_in_month: number;
  wage_basis_label: string;
}

export interface NoticeRecoveryResult {
  amount: string;
  basis: string;
}

export interface SettlementComputeInput {
  final_month_salary: string;
  final_month_basis: string;
  leave_encashment: string;
  leave_encashment_basis: string;
  gratuity: string;
  gratuity_basis: string;
  pending_reimbursements: string;
  reimbursement_basis: string;
  pro_rata_bonus: string;
  bonus_basis: string;
  pending_arrears: string;
  arrears_basis: string;
  notice_shortfall: string;
  notice_basis: string;
  loan_outstanding: string;
  loan_basis: string;
  excess_leave_taken: string;
  excess_leave_basis: string;
  other_recoveries: string;
  other_recovery_basis: string;
  /** Signed: negative is a refund to the employee. */
  final_tds: string;
  tax_basis: string;
}

/**
 * A figure another module already holds for this leaver, offered to prefill
 * the settlement form. `field` names the `SettlementComputeInput` amount key
 * it belongs to; the basis goes into the matching `*_basis` key.
 */
export interface SettlementSource {
  field: keyof SettlementComputeInput;
  basis_field: keyof SettlementComputeInput;
  label: string;
  amount: string;
  basis: string;
  source: string;
  source_id: string | null;
}

export interface SettlementSources {
  exit_id: string;
  suggestions: SettlementSource[];
  notice: { shortfall_days: number; waived: boolean; waiver_reason: string | null };
  /** Recovery from clearance items; added by the server, not typed in. */
  clearance_recovery: string;
  clearance_basis: string;
  notes: string[];
  /** Leave encashable on exit whose encashment has not been computed yet. */
  encashable_leave: { leave_type_code: string; days: string }[];
}

export interface Settlement {
  id: string;
  exit_record_id: string;
  employee_id: string;
  employee_code: string | null;
  employee_name: string | null;
  exit_type: ExitType | null;
  last_working_day: string | null;
  status: SettlementStatus;
  total_earnings: string;
  total_recoveries: string;
  total_tax: string;
  net_amount: string;
  is_demand: boolean;
  hold_reason: string | null;
  computed_at: string | null;
  approved_at: string | null;
  paid_at: string | null;
  /** The payment as finance recorded it: the day and the bank reference. */
  paid_on: string | null;
  payment_reference: string | null;
  paid_by_name: string | null;
  statement_letter_id: string | null;
}

export interface SettlementPaymentInput {
  paid_on: string;
  payment_reference: string;
}

export interface SettlementLine {
  id: string;
  line_type: "earning" | "recovery" | "tax";
  code: string;
  label: string;
  amount: string;
  basis: string;
  source: string | null;
  display_order: number;
}

export interface LetterGate {
  allowed: boolean;
  reason: string;
  requires_settlement: boolean;
  settlement_status: SettlementStatus | null;
  hold_reason: string | null;
}

export interface ExitPolicy {
  letters_require_settlement: boolean;
}

export interface ExitLetterInput {
  kind: "relieving" | "experience";
}
