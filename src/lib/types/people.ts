/** Core HR types: employees, organisation, positions, lifecycle. Mirror backend schemas. */

import type { EmploymentStatus } from "@/lib/types";

export type EmploymentType = "full_time" | "part_time" | "contract" | "intern" | "consultant";
export type Gender = "female" | "male" | "non_binary" | "undisclosed";

export interface DirectoryEmployee {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string | null;
  display_name: string | null;
  work_email: string;
  designation: string | null;
  department_id: string | null;
  location_id: string | null;
  manager_id: string | null;
  /** A second, dotted-line manager: informational, no approval rights. */
  dotted_line_manager_id?: string | null;
  photo_url: string | null;
  status: EmploymentStatus;
}

export interface EmployeeRecord {
  id: string;
  /** Set on a single-record read: this person is in the caller's reporting line. */
  in_your_line?: boolean;
  tenant_id: string;
  employee_code: string;
  first_name: string;
  last_name: string | null;
  display_name: string | null;
  work_email: string;
  personal_email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  gender: Gender | null;
  legal_entity_id: string | null;
  location_id: string | null;
  department_id: string | null;
  manager_id: string | null;
  /** A second, dotted-line manager: informational, no approval rights. */
  dotted_line_manager_id?: string | null;
  designation: string | null;
  grade: string | null;
  employment_type: EmploymentType;
  status: EmploymentStatus;
  date_of_joining: string | null;
  date_of_exit: string | null;
  probation_end_date: string | null;
  notice_period_days: number | null;
  photo_url: string | null;
  custom_fields: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** The fields HR edits; every one optional on a PATCH. */
export type EmployeeInput = Partial<
  Pick<
    EmployeeRecord,
    | "first_name"
    | "last_name"
    | "display_name"
    | "work_email"
    | "personal_email"
    | "phone"
    | "date_of_birth"
    | "gender"
    | "legal_entity_id"
    | "location_id"
    | "department_id"
    | "manager_id"
    | "dotted_line_manager_id"
    | "designation"
    | "grade"
    | "employment_type"
    | "status"
    | "date_of_joining"
    | "date_of_exit"
    | "probation_end_date"
    | "notice_period_days"
    | "custom_fields"
  >
> & { employee_code?: string };

export type CustomFieldType = "text" | "number" | "date" | "select" | "multiselect" | "boolean";

export const CUSTOM_FIELD_TYPE: Record<CustomFieldType, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  select: "One choice",
  multiselect: "Several choices",
  boolean: "Yes or no",
};

/** An extra field on every employee record, defined by an admin. */
export interface CustomField {
  id: string;
  key: string;
  label: string;
  field_type: CustomFieldType;
  options: string[] | null;
  is_required: boolean;
  /** Hidden from the person the record is about. */
  is_sensitive: boolean;
  display_order: number;
  is_active: boolean;
  /** The profile tab it sits on; null for the Employment tab's "More details". */
  tab: string | null;
}

export interface SalaryHistoryRow {
  id: string;
  structure_id: string;
  ctc_annual: string;
  currency: string;
  effective_from: string;
  effective_to: string | null;
  revision_reason: string | null;
}

// ── Organisation ───────────────────────────────────────────────────────────

export interface LegalEntity {
  id: string;
  name: string;
  code: string;
  pan: string | null;
  tan: string | null;
  gstin: string | null;
  pf_registration_no: string | null;
  esi_registration_no: string | null;
  pt_registrations: Record<string, string>;
  registered_address: string | null;
  is_active: boolean;
  /** The work week (a shift) for this company's people with no shift of their own. */
  default_shift_id?: string | null;
  /** How a month's salary is divided into days. */
  salary_days_basis?: SalaryDaysBasis;
  /** The divisor for `fixed`, usually 26 or 30. */
  salary_fixed_days?: number | null;
}

export type SalaryDaysBasis = "calendar" | "fixed" | "working_days";

export interface Location {
  id: string;
  legal_entity_id: string;
  name: string;
  code: string;
  city: string | null;
  state_code: string;
  country_code: string;
  pincode: string | null;
  timezone: string;
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

// ── Positions ──────────────────────────────────────────────────────────────

export type PositionStatus = "approved" | "filled" | "vacant" | "frozen" | "abolished";
export type AssignmentType = "primary" | "acting" | "additional_charge";

export interface Position {
  id: string;
  code: string;
  title: string;
  status: PositionStatus;
  fte: string;
  grade: string | null;
  department_id: string | null;
  location_id: string | null;
  cost_centre_id: string | null;
  reports_to_position_id: string | null;
  budgeted_ctc_min: string | null;
  budgeted_ctc_max: string | null;
  effective_from: string;
  effective_to: string | null;
  vacated_on: string | null;
  status_reason: string | null;
}

export interface OccupancyRow {
  position_id: string;
  code: string;
  title: string;
  status: PositionStatus;
  fte: string;
  occupied: boolean;
  covered_only: boolean;
  primary_holder: string | null;
  covering: string[];
}

export interface Occupancy {
  as_of: string;
  positions: OccupancyRow[];
}

export interface PositionAssignment {
  id: string;
  position_id: string;
  employee_id: string;
  employee_name: string;
  from_date: string;
  to_date: string | null;
  assignment_type: AssignmentType;
  counts_toward_headcount: boolean;
  note: string | null;
}

export interface CostCentre {
  id: string;
  code: string;
  name: string;
  owner_employee_id: string | null;
  is_active: boolean;
}

export interface HeadcountBudget {
  id: string;
  financial_year: string;
  department_id: string | null;
  cost_centre_id: string | null;
  approved_positions: number;
  approved_cost: string;
  note: string | null;
}

export interface BudgetCheck {
  scope: string;
  financial_year: string;
  approved_fte: string;
  fte_after: string;
  approved_cost: string | null;
  cost_after: string | null;
  within_budget: boolean;
  problems: string[];
}

export interface BudgetUpsertResult {
  budget: HeadcountBudget;
  over_budget: BudgetCheck[];
}

export interface HeadcountTotals {
  approved_fte: string;
  filled_fte: string;
  vacant_fte: string;
  frozen_fte: string;
  people: number;
  positions: number;
  covered_only: number;
}

export interface BudgetView {
  as_of: string;
  financial_year: string;
  grouped_by: string;
  totals: Record<string, HeadcountTotals>;
  cost: unknown[] | null;
  cost_note: string | null;
  approved_budget: { department_id: string | null; approved_positions: number; approved_cost: string }[];
}

export interface Vacancy {
  position_id: string;
  code: string;
  title: string;
  status: PositionStatus;
  department: string;
  fte: string;
  days_vacant: number | null;
  since: string | null;
  bucket: string;
  covered_by: string[];
  stale: boolean;
}

export interface VacancyReport {
  as_of: string;
  vacancies: Vacancy[];
  buckets: Record<string, { count: number; fte: string; positions: string[] }>;
  stale_count: number;
}

export interface ChartNode {
  position_id: string;
  code: string;
  title: string;
  status: PositionStatus;
  fte: string;
  department: string;
  grade: string | null;
  holder: string | null;
  vacant: boolean;
  covering: string[];
  reports: number;
  vacant_below: number;
  children: ChartNode[];
}

export interface OrgChart {
  as_of: string;
  roots: ChartNode[];
  problems: string[];
  vacant_seats: number;
  total_seats: number;
}

export type ScenarioChangeKind = "create" | "move" | "freeze" | "unfreeze" | "abolish";

export interface ScenarioSummary {
  scenario_id: string;
  name: string;
  description: string | null;
  status: "draft" | "committed" | "discarded";
  as_of: string;
  changes: number;
}

export interface ScenarioProjection {
  scenario_id: string;
  name: string;
  status: string;
  as_of: string;
  changes: { kind: ScenarioChangeKind; position_id: string | null; values: Record<string, unknown>; reason: string }[];
  warnings: string[];
  comparison: { scope: string; live: unknown; projected: unknown; fte_delta: string; cost_delta: string }[];
  vacancies_after: Vacancy[];
}

// ── Lifecycle ──────────────────────────────────────────────────────────────

export type LifecycleEventType =
  | "confirmation"
  | "probation_extension"
  | "transfer"
  | "promotion"
  | "demotion"
  | "redesignation"
  | "deputation"
  | "grade_change"
  | "department_change"
  | "location_change"
  | "manager_change"
  | "employment_type_change";

export type LifecycleStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "effected"
  | "cancelled"
  | "failed";

export interface Consequence {
  kind: string;
  severity: string;
  message: string;
  action_required: string | null;
}

export interface LifecycleEvent {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  event_type: LifecycleEventType;
  effective_from: string;
  status: LifecycleStatus;
  previous_values: Record<string, unknown>;
  new_values: Record<string, unknown>;
  reason: string;
  new_ctc_annual: string | null;
  consequences_shown: Consequence[];
  approved_at: string | null;
  effected_at: string | null;
  cancelled_reason: string | null;
  failure_reason: string | null;
  letter_id: string | null;
  batch_id: string | null;
  created_at: string;
}

export interface EventPreview {
  event_type: LifecycleEventType;
  effective_from: string;
  is_retrospective: boolean;
  is_future_dated: boolean;
  changes: { field: string; from: unknown; to: unknown }[];
  salary_revision: string | null;
  needs_a_letter: boolean;
  consequences: Consequence[];
  payroll_consequences: number;
  problems: string[];
  letter_template: { id: string; code: string; name: string } | null;
}

export interface EffectResult {
  event_id: string;
  status: LifecycleStatus;
  applied: string[];
  letter: { letter_id: string | null; reference_number: string | null; note: string | null };
}

export interface HistoryEvent {
  event_id: string;
  type: LifecycleEventType;
  effective_from: string;
  status: LifecycleStatus;
  changes: { field: string; from: unknown; to: unknown }[];
  salary_revision: string | null;
  reason: string;
  approved_by_name: string | null;
  approved_at: string | null;
  effected_at: string | null;
  letter_id: string | null;
  failure_reason: string | null;
  cancelled_reason: string | null;
}

export interface EmployeeHistory {
  employee_id: string;
  employee_code: string;
  events: HistoryEvent[];
}

/** The job fields as they stood on a date, rebuilt from effected events. */
export interface EmployeeStateOn {
  employee_id: string;
  as_of: string;
  state: Record<string, string | number | null>;
  manager_name: string | null;
  /** Effected events after the date that were undone to get here. */
  events_undone: number;
}

export interface BulkResult {
  batch_id: string;
  name: string;
  raised: { employee_id: string; event_id: string }[];
  rejected: { employee_id: string; reason: string }[];
  raised_count: number;
  rejected_count: number;
}

export interface LifecycleBatch {
  batch_id: string;
  name: string;
  event_type: LifecycleEventType;
  effective_from: string;
  reason: string;
  events: number;
  approve_individually: boolean;
  created_at: string;
}

export type SilencePolicy = "auto_confirm" | "require_decision" | "auto_extend_once";

export interface ProbationPolicy {
  configured: boolean;
  silence_policy: SilencePolicy | null;
  grace_days: number | null;
  confirmation_raises_salary: boolean | null;
  hr_escalation_user_id: string | null;
  note: string;
}

export interface DriftReport {
  as_of: string;
  policy: SilencePolicy;
  grace_days: number;
  count: number;
  cases: {
    review_id: string;
    employee: string;
    days_overdue: number;
    reminders_sent: number | string[];
    resolution: string;
    auto_outcome: string | null;
    new_probation_end_date: string | null;
  }[];
}

// ── Extended profile and change requests ───────────────────────────────────
// Mirrors backend/app/schemas/employee_profile.py.

export type ProfileSection =
  | "identity"
  | "personal"
  | "addresses"
  | "emergency_contacts"
  | "family_members"
  | "nominees"
  | "education"
  | "previous_employment"
  | "statutory"
  | "bank_account";

export type MaritalStatus = "single" | "married" | "separated" | "divorced" | "widowed" | "undisclosed";
export type BloodGroup = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
export type Relationship =
  | "spouse"
  | "child"
  | "father"
  | "mother"
  | "sibling"
  | "father_in_law"
  | "mother_in_law"
  | "grandparent"
  | "friend"
  | "other";
export type NomineePurpose = "pf" | "eps" | "gratuity" | "insurance";
export type EducationLevel =
  | "secondary"
  | "higher_secondary"
  | "diploma"
  | "graduate"
  | "postgraduate"
  | "doctorate"
  | "certification"
  | "other";

export interface IdentityDetails {
  first_name: string;
  last_name: string | null;
  date_of_birth: string | null;
}

export interface PersonalDetails {
  father_name: string | null;
  spouse_name: string | null;
  marital_status: MaritalStatus | null;
  blood_group: BloodGroup | null;
  nationality: string | null;
  alternate_phone: string | null;
}

export interface Address {
  line1: string;
  line2: string | null;
  city: string;
  district: string | null;
  state_code: string;
  pincode: string;
  country_code: "IN";
}

export interface Addresses {
  current: Address | null;
  permanent: Address | null;
  permanent_same_as_current: boolean;
}

export interface EmergencyContact {
  name: string;
  relationship: Relationship;
  phone: string;
  alternate_phone: string | null;
  email: string | null;
  is_primary: boolean;
}

export interface FamilyMember {
  name: string;
  relationship: Relationship;
  date_of_birth: string | null;
  gender: "female" | "male" | "non_binary" | "undisclosed" | null;
  occupation: string | null;
  is_dependent: boolean;
}

export interface Nominee {
  name: string;
  relationship: Relationship;
  date_of_birth: string | null;
  address: string | null;
  purpose: NomineePurpose;
  /** Decimal as a string. */
  share_percent: string;
  guardian_name: string | null;
}

export interface Education {
  level: EducationLevel;
  qualification: string;
  specialisation: string | null;
  institution: string;
  board_or_university: string | null;
  start_year: number | null;
  end_year: number | null;
  grade: string | null;
}

export interface PreviousEmployment {
  employer: string;
  designation: string | null;
  from_date: string;
  to_date: string;
  location: string | null;
  reason_for_leaving: string | null;
}

/** A write of statutory identifiers: only the fields named change. */
export interface StatutoryInput {
  pan?: string | null;
  uan?: string | null;
  /** The full twelve digits; only the last four are ever stored. */
  aadhaar?: string | null;
  pf_number?: string | null;
  esi_number?: string | null;
}

export interface BankAccountInput {
  account_number: string;
  ifsc: string;
  account_holder_name: string;
  bank_name: string | null;
}

export type SectionWrite =
  | { section: "identity"; data: IdentityDetails }
  | { section: "personal"; data: PersonalDetails }
  | { section: "addresses"; data: Addresses }
  | { section: "emergency_contacts"; data: EmergencyContact[] }
  | { section: "family_members"; data: FamilyMember[] }
  | { section: "nominees"; data: Nominee[] }
  | { section: "education"; data: Education[] }
  | { section: "previous_employment"; data: PreviousEmployment[] }
  | { section: "statutory"; data: StatutoryInput }
  | { section: "bank_account"; data: BankAccountInput };

export interface StatutoryRead {
  pan: string | null;
  uan: string | null;
  pf_number: string | null;
  esi_number: string | null;
  aadhaar: string | null;
  /** True when `aadhaar` is the full number (admin/HR, and the full number is on file). */
  aadhaar_full?: boolean;
  masked: boolean;
}

export interface BankAccountSummary {
  id: string;
  bank_name: string | null;
  ifsc: string;
  account_holder_name: string;
  account_number_masked: string | null;
  /** The full number; sent to admin/HR only, null for everyone else. */
  account_number?: string | null;
  verification_method: string;
  verified_at: string | null;
  created_at: string;
}

export type ProfileChangeStatus = "pending" | "approved" | "rejected" | "withdrawn";

export interface ChangeRequest {
  id: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  section: ProfileSection;
  section_label: string;
  status: ProfileChangeStatus;
  proposed: Record<string, unknown>;
  current_snapshot: Record<string, unknown>;
  reason: string;
  requested_at: string;
  requested_by_name: string | null;
  decided_at: string | null;
  decided_by_name: string | null;
  decision_note: string | null;
  can_decide: boolean;
  can_withdraw: boolean;
}

export interface EmployeeProfile {
  employee_id: string;
  personal: PersonalDetails;
  addresses: Addresses;
  emergency_contacts: EmergencyContact[];
  family_members: FamilyMember[];
  nominees: Nominee[];
  education: Education[];
  previous_employment: PreviousEmployment[];
  statutory: StatutoryRead;
  bank_account: BankAccountSummary | null;
  pending_requests: ChangeRequest[];
  hiring_snapshot: Record<string, unknown> | null;
  direct_sections: ProfileSection[];
  request_sections: ProfileSection[];
  missing: string[];
}

export interface Celebration {
  employee_id: string;
  name: string;
  designation: string | null;
  photo_url: string | null;
  kind: "birthday" | "work_anniversary";
  on_date: string;
  years: number | null;
  scope: string;
}

export interface Celebrations {
  from_date: string;
  to_date: string;
  items: Celebration[];
  note: string;
}

// ── Import from a spreadsheet (`/employees/import`) ─────────────────────────

export type ImportRowOutcome = "ready" | "skip" | "error";

export interface ImportRow {
  /** The row number in the file, as Excel shows it. */
  line: number;
  employee_code: string | null;
  name: string | null;
  status: EmploymentStatus | null;
  date_of_joining: string | null;
  date_of_exit: string | null;
  designation: string | null;
  department: string | null;
  location: string | null;
  manager: string | null;
  outcome: ImportRowOutcome;
  errors: string[];
  warnings: string[];
  employee_id: string | null;
}

export interface ImportPreview {
  filename: string;
  source: string;
  header_row: number;
  total_rows: number;
  ready_current: number;
  ready_leavers: number;
  skipped: number;
  errors: number;
  with_warnings: number;
  new_departments: string[];
  new_locations: { name: string; state_code: string }[];
  columns_used: { header: string; field: string; section: string }[];
  columns_ignored: string[];
  can_create_org: boolean;
  rows: ImportRow[];
  /** People already here who get their full Aadhaar number from this file. */
  aadhaar_fills?: number;
  /** Already here, but the file's Aadhaar ends differently: left alone. "CODE — Name". */
  aadhaar_mismatches?: string[];
}

export interface ImportResult {
  filename: string;
  created: number;
  created_leavers: number;
  skipped: number;
  failed: number;
  departments_created: string[];
  locations_created: string[];
  rows: ImportRow[];
  aadhaar_filled?: number;
  aadhaar_mismatches?: string[];
}
