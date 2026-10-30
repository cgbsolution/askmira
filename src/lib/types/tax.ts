/**
 * Income tax declarations, proofs and TDS projection (prompt 07).
 *
 * Mirrors `backend/app/api/v1/routers/tax.py` and `app/schemas/tax.py`.
 * Every amount is a decimal string and stays one: a tax figure that passes
 * through a JavaScript number on its way to the screen is a figure that can
 * drift.
 *
 * Tax financial years are written "2026-27".
 */

export type TaxRegime = "old" | "new";
export type WindowType = "declaration" | "proof";
export type DeclarationStatus = "draft" | "submitted" | "locked";
export type ProofStatus = "pending" | "verified" | "rejected" | "partially_accepted";

export interface DeclarationWindow {
  id: string;
  financial_year: string;
  window_type: WindowType;
  opens_at: string;
  closes_at: string;
  allow_late_submission: boolean;
  /** Open today, or closed but accepting late submissions. */
  is_open: boolean;
  reminder_days_before: number[];
}

export interface WindowUpsertInput {
  financial_year: string;
  window_type: WindowType;
  opens_at: string;
  closes_at: string;
  allow_late_submission: boolean;
  reminder_days_before?: number[];
}

export interface RegimeElection {
  financial_year: string;
  regime: TaxRegime;
  elected_at: string;
  locked_at: string | null;
  switch_count: number;
  previous_regime: TaxRegime | null;
}

export interface RegimeElectionInput {
  financial_year: string;
  regime: TaxRegime;
  employee_id?: string | null;
}

export interface RegimeElectionResult {
  financial_year: string;
  regime: TaxRegime;
  switch_count: number;
  full_year_recomputed: boolean;
  months_recomputed: number;
}

export interface TaxProof {
  id: string;
  declaration_id: string;
  proof_amount: string;
  accepted_amount: string;
  status: ProofStatus;
  verifier_remarks: string | null;
  verified_at: string | null;
  document_name: string | null;
  has_document: boolean;
  created_at: string;
}

export interface TaxDeclaration {
  id: string;
  employee_id: string;
  financial_year: string;
  section: string;
  sub_category: string;
  description: string | null;
  declared_amount: string;
  /** Sum of verified and partially accepted proofs — what actually counts. */
  accepted_amount: string;
  status: DeclarationStatus;
  submitted_at: string | null;
  locked_at: string | null;
  proofs: TaxProof[];
}

export interface DeclarationInput {
  financial_year: string;
  section: string;
  sub_category: string;
  declared_amount: string;
  description?: string | null;
  employee_id?: string | null;
}

export interface RentMonth {
  month: number;
  year: number;
  rent: string;
}

export interface HouseRent {
  id: string;
  employee_id: string;
  financial_year: string;
  monthly_rent: RentMonth[];
  annual_rent: string;
  landlord_name: string | null;
  landlord_pan: string | null;
  property_address: string | null;
  is_metro: boolean;
  status: ProofStatus;
}

export interface HouseRentInput {
  financial_year: string;
  monthly_rent: RentMonth[];
  landlord_name?: string | null;
  landlord_pan?: string | null;
  property_address?: string | null;
  is_metro: boolean;
  employee_id?: string | null;
}

export interface PreviousEmployer {
  id: string;
  employee_id: string;
  financial_year: string;
  employer_name: string | null;
  gross_salary: string;
  tds_deducted: string;
  pf_deducted: string;
  professional_tax: string;
  exempt_allowances: string;
  /** A Form 16 Part B is attached. */
  has_document: boolean;
  status: ProofStatus;
}

export interface PreviousEmployerInput {
  financial_year: string;
  employer_name?: string | null;
  gross_salary: string;
  tds_deducted: string;
  pf_deducted: string;
  professional_tax: string;
  exempt_allowances: string;
}

// ── Projection working ──────────────────────────────────────────────────────

export interface TaxDeductionLine {
  section: string;
  declared: string;
  accepted: string;
  allowed: string;
  ceiling: string | null;
  capped: boolean;
  note: string;
}

export interface TaxSlabLine {
  from: string;
  to: string;
  rate: string;
  tax: string;
}

export interface HraWorking {
  actual_hra_received: string;
  rent_less_basic_percentage: string;
  percentage_of_basic: string;
  exemption: string;
  binding_constraint: "actual_hra" | "rent_less_basic" | "percentage_of_basic";
  is_metro: boolean;
  explanation: string;
}

/**
 * Taxable income that reaches TDS from another module: the taxable part of a
 * gratuity or leave encashment, arrears received this year, a concessional
 * loan perquisite, unclaimed reimbursement entitlement after year end.
 */
export interface OtherIncomeLine {
  code: string;
  label: string;
  amount: string;
  /** "exit_benefits" | "arrears" | "loans" | "reimbursements" */
  source: string;
  basis: string;
}

export interface TaxWorking {
  regime: TaxRegime;
  gross_annual_income: string;
  total_exemptions: string;
  total_deductions: string;
  taxable_income: string;
  tax_before_rebate: string;
  rebate: string;
  surcharge: string;
  cess: string;
  annual_tax_liability: string;
  slabs: TaxSlabLine[];
  deductions: TaxDeductionLine[];
  hra: HraWorking | null;
  notes: string[];
  other_income: OtherIncomeLine[];
  /** Amounts that would become taxable if still unclaimed at year end. Informational. */
  pending_if_unclaimed: OtherIncomeLine[];
}

export interface RegimeComparison {
  regimes: Record<string, TaxWorking>;
  lower_liability_regime: TaxRegime;
  saving: string;
  note: string;
}

export interface TaxSnapshot {
  id: string;
  financial_year: string;
  regime: TaxRegime;
  computed_for_month: number;
  gross_annual_income: string;
  taxable_income: string;
  annual_tax_liability: string;
  monthly_tds: string;
  working: TaxWorking;
  created_at: string;
}

// ── HR proof queue ──────────────────────────────────────────────────────────

export interface ProofQueueItem {
  id: string;
  declaration_id: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  financial_year: string;
  section: string;
  sub_category: string;
  declared_amount: string;
  proof_amount: string;
  accepted_amount: string;
  status: ProofStatus;
  verifier_remarks: string | null;
  verified_at: string | null;
  document_name: string | null;
  has_document: boolean;
  created_at: string;
}

export interface ProofDecisionInput {
  decision: Exclude<ProofStatus, "pending">;
  accepted_amount: string;
  remarks: string;
}

// ── Documents (Form 12BB) ───────────────────────────────────────────────────

export interface IssuedDocument {
  letter_id: string;
  reference_number: string;
  status: string;
  issued_at: string | null;
  content_hash: string;
}

export interface Form12BBIssueInput {
  financial_year: string;
  parent_name: string;
  place: string;
  employee_id?: string | null;
}

export interface Form12BBPreview {
  /**
   * Server-built, escaped HTML. Render only inside
   * `<iframe sandbox="" srcDoc={...}>`, never into the portal DOM.
   */
  claims_table: string;
}

export interface ReminderRun {
  windows_checked: number;
  notifications_raised: number;
  events: string[];
}

/** `GET /tax/form-16` — a financial year with approved payroll, and its Part B. */
export interface Form16Year {
  financial_year: string;
  assessment_year: string;
  available: boolean;
  /** "available", "not_ready", or "issued_elsewhere" (a year paid on the previous payroll). */
  status?: "available" | "not_ready" | "issued_elsewhere";
  /** For a year issued elsewhere: the system that issued it (e.g. "factoHR"). */
  issued_by?: string | null;
  /** Why Part B cannot be produced yet, when it cannot. */
  reason: string | null;
  taxable_income: string | null;
  tax_payable: string | null;
  tds_deducted: string | null;
}
