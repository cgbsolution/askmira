/** Shared API types. These mirror the Pydantic schemas in `backend/app/schemas`. */

/**
 * The four login roles. `super_admin` is AskMira staff managing the tenants on
 * the platform; the other three belong to one workspace.
 */
export type UserRole = "super_admin" | "admin" | "sub_admin" | "employee";

/**
 * Who a page or an action is for: a login role, or `manager` — anybody with a
 * direct report (`AuthUser.is_manager`). Managing people follows the org chart;
 * it is not a role anybody is given.
 */
export type Audience = UserRole | "manager";

export type EmploymentStatus = "active" | "on_notice" | "on_leave" | "exited" | "pre_joining";

export interface AuthUser {
  id: string;
  tenant_id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
  is_email_verified: boolean;
  /** Signed in with a temporary password; the portal asks for a new one first. */
  must_change_password: boolean;
  /** Somebody reports to them, so they see their team's pages and approvals. */
  is_manager: boolean;
  /** The workspace requires two-step sign-in of them and it is not set up yet. */
  two_step_required?: boolean;
  employee_id: string | null;
  last_login_at: string | null;
  created_at: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  data_region: string;
  /** Which modules this workspace has switched on. Drives nav gating. */
  enabled_modules: Record<string, boolean>;
  /**
   * Our separate products linked to this workspace, e.g. `{ interview: true }`.
   * Each replaces a module: its section becomes a launcher.
   */
  linked_products?: Partial<Record<ProductKey, boolean>>;
}

/**
 * The company the signed-in person works for: their legal entity's name and
 * logo, the workspace's logo when it has none, the workspace's name when they
 * have no company. Drawn at the top of the navigation.
 */
export interface CompanyBrand {
  name: string;
  /** A path on the API; null shows the name instead. */
  logo_url: string | null;
  legal_entity_id: string | null;
}

/** The separate products a workspace can be linked to. */
export type ProductKey = "interview" | "expense" | "helpdesk";

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: AuthUser;
  tenant: Tenant;
  company?: CompanyBrand | null;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface EmployeeSummary {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string | null;
  display_name: string | null;
  work_email: string;
  designation: string | null;
  department_id: string | null;
  location_id?: string | null;
  manager_id: string | null;
  /** A second, dotted-line manager: informational, no approval rights. */
  dotted_line_manager_id?: string | null;
  photo_url: string | null;
  status: EmploymentStatus;
}

export interface DashboardSummary {
  greeting_name: string;
  headcount: number;
  new_hires_30d: number;
  on_leave_today: number;
  pending_approvals: number;
  shoutouts_this_week: number;
  open_tasks: number;
  /** The workspace's local date. */
  today: string;
  upcoming_holidays: { holiday_date: string; name: string }[];
  /** HR only; null when no run exists yet. */
  latest_payroll_run: {
    id: string;
    period_year: number;
    period_month: number;
    status: string;
    employee_count: number;
    total_net: string;
    payment_date: string | null;
  } | null;
  /** HR only, with payroll on: where last month's returns stand. */
  filings: {
    return_type: "pf_ecr" | "esic" | "professional_tax" | "tds_24q";
    period: string;
    status: "generated" | "filed" | "rejected" | "blocked" | null;
    due_on: string | null;
  }[];
}

// ── Time off ───────────────────────────────────────────────────────────────
// Day quantities arrive as decimal strings ("2.50") and stay strings: a
// half-day balance should not pass through a float on its way to the screen.

export type LeaveRequestStatus = "draft" | "pending" | "approved" | "rejected" | "cancelled";

export type AccrualFrequency = "monthly" | "quarterly" | "annual" | "on_joining";

export type HalfDaySession = "first_half" | "second_half";

export type HolidayScope = "national" | "state" | "location";

export interface LeaveType {
  id: string;
  name: string;
  code: string;
  description: string | null;
  is_paid: boolean;
  allows_half_day: boolean;
  requires_document: boolean;
  is_statutory: boolean;
  is_comp_off: boolean;
  is_active: boolean;
}

export interface LeavePolicy {
  id: string;
  leave_type_id: string;
  name: string;
  location_id: string | null;
  grade: string | null;
  /** "female" | "male"; null is everyone. */
  applies_to_gender: "female" | "male" | null;
  annual_quota_days: string;
  accrual_frequency: AccrualFrequency;
  max_carry_forward_days: string;
  max_consecutive_days: number | null;
  min_notice_days: number;
  allows_negative_balance: boolean;
  sandwich_weekends_holidays: boolean;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
}

export interface Holiday {
  id: string;
  name: string;
  holiday_date: string;
  state_code: string | null;
  location_id: string | null;
  location_name: string | null;
  scope: HolidayScope;
  /** One company of the group only; null for every legal entity. */
  legal_entity_id?: string | null;
  legal_entity_name?: string | null;
  is_optional: boolean;
  /** Unpaid: a day off that is loss of pay unless worked. */
  is_paid?: boolean;
  /** In scope for the viewer's own work location. */
  applies_to_me: boolean;
  /** An optional holiday the viewer opted in to. */
  selected: boolean;
}

export interface OptionalHolidays {
  year: number;
  quota: number;
  chosen: number;
  holidays: Holiday[];
}

export interface LeaveSettings {
  optional_holiday_quota: number;
  comp_off_expiry_days: number;
  comp_off_leave_type_id: string | null;
  comp_off_leave_type_name: string | null;
}

export interface ApprovalStep {
  step: number;
  role: string;
  approver_name: string;
  status: "pending" | "approved" | "rejected" | "skipped";
  decided_by_name: string | null;
  decided_at: string | null;
  note: string | null;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_photo_url: string | null;
  leave_type_id: string;
  leave_type_name: string;
  start_date: string;
  end_date: string;
  total_days: string;
  is_half_day: boolean;
  half_day_session: HalfDaySession | null;
  reason: string | null;
  document_url: string | null;
  has_document: boolean;
  status: LeaveRequestStatus;
  approval_chain: ApprovalStep[];
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
  can_decide: boolean;
  can_cancel: boolean;
  /** In the approvals inbox only, for a paid type with a balance to draw on. */
  balance?: RequestBalance | null;
}

/** The requester's balance of the type asked for, as whoever decides sees it. */
export interface RequestBalance {
  year: number;
  /** What the ledger says today, before this request. */
  available: string;
  /** Their other undecided requests of this type in the same year. */
  other_pending: string;
  /** `available` less this request. */
  after_approval: string;
  projected_carry_forward: string | null;
}

export interface LeaveRequestInput {
  leave_type_id: string;
  start_date: string;
  end_date: string;
  is_half_day: boolean;
  half_day_session?: HalfDaySession | null;
  reason?: string | null;
  document_url?: string | null;
  employee_id?: string | null;
}

export interface LeavePreview {
  total_days: string;
  working_days: number;
  weekly_offs: string[];
  holidays: { date: string; name: string }[];
  sandwiched: string[];
  available_before: string | null;
  pending_days: string | null;
  available_after: string | null;
  projected_carry_forward: string | null;
  approvers: string[];
  allowed: boolean;
  problems: string[];
  warnings: string[];
}

export interface LeaveAttachment {
  document_url: string;
  mime_type: string;
  size_bytes: number;
}

export interface LeaveBalance {
  leave_type_id: string;
  leave_type_name: string;
  leave_type_code: string;
  is_paid: boolean;
  is_statutory: boolean;
  is_comp_off: boolean;
  year: number;
  policy_name: string | null;
  annual_quota_days: string | null;
  accrual_frequency: AccrualFrequency | null;
  opening: string;
  accrued: string;
  carried_forward: string;
  adjusted: string;
  used: string;
  encashed: string;
  pending: string;
  available: string;
  available_after_pending: string;
}

export type ManualAdjustmentKind = "opening" | "credit" | "debit";

/** A leave type, as a column of the team table. */
export interface TeamBalanceColumn {
  leave_type_id: string;
  name: string;
  code: string;
  is_paid: boolean;
  is_statutory: boolean;
  is_comp_off: boolean;
}

export interface TeamBalanceCell {
  leave_type_id: string;
  /** Opening + accrued + carried forward + adjustments. */
  entitled: string;
  used: string;
  encashed: string;
  pending: string;
  available: string;
}

export interface TeamBalanceRow {
  employee_id: string;
  employee_code: string;
  employee_name: string;
  photo_url: string | null;
  designation: string | null;
  department_name: string | null;
  /** Only the types a policy or a ledger row gives this person. */
  balances: TeamBalanceCell[];
}

export interface TeamBalances {
  year: number;
  /** Every active leave type, so the columns do not move between pages. */
  leave_types: TeamBalanceColumn[];
  items: TeamBalanceRow[];
  total: number;
  page: number;
  page_size: number;
}

export interface BalanceAdjustment {
  id: string;
  employee_id: string;
  leave_type_id: string;
  year: number;
  kind: string;
  days: string;
  reason: string;
  effective_on: string;
  created_at: string;
}

export interface BalanceHistoryEntry {
  on: string;
  kind: string;
  label: string;
  days: string;
  running_balance: string;
  note: string | null;
}

export interface BalanceHistory {
  employee_id: string;
  employee_name: string;
  leave_type_id: string;
  leave_type_name: string;
  year: number;
  entries: BalanceHistoryEntry[];
  available: string;
}

export interface WhoIsOut {
  employee_id: string;
  employee_name: string;
  photo_url: string | null;
  start_date: string;
  end_date: string;
  is_half_day: boolean;
  half_day_session: HalfDaySession | null;
  status: LeaveRequestStatus;
  leave_type_name: string | null;
}

export interface AccrualRun {
  year: number;
  as_of: string;
  balances_updated: number;
}

export interface YearEndRun {
  year: number;
  balances_closed: number;
  days_carried: string;
  days_lapsed: string;
  already_closed: number;
}

export type CompOffStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface CompOffClaim {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_photo_url: string | null;
  worked_date: string;
  worked_day_label: string | null;
  days: string;
  reason: string;
  status: CompOffStatus;
  approver_name: string;
  decided_by_name: string | null;
  decided_at: string | null;
  decision_note: string | null;
  expires_on: string | null;
  created_at: string;
  can_decide: boolean;
  can_cancel: boolean;
}

export interface Shoutout {
  id: string;
  from_employee_id: string;
  to_employee_id: string;
  message: string;
  value_tag: string | null;
  visibility: "company" | "department" | "private";
  is_pinned: boolean;
  points_awarded: number;
  created_at: string;
}
