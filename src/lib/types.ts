/** Shared API types. These mirror the Pydantic schemas in `backend/app/schemas`. */

export type UserRole =
  | "platform_admin"
  | "tenant_admin"
  | "hr_admin"
  | "hr_ops"
  | "manager"
  | "employee";

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
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: AuthUser;
  tenant: Tenant;
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
  manager_id: string | null;
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
}

// ── Time off ───────────────────────────────────────────────────────────────
// Day quantities arrive as decimal strings ("2.50") and stay strings: a
// half-day balance should not pass through a float on its way to the screen.

export type LeaveRequestStatus = "draft" | "pending" | "approved" | "rejected" | "cancelled";

export type AccrualFrequency = "monthly" | "quarterly" | "annual" | "on_joining";

export interface LeaveType {
  id: string;
  name: string;
  code: string;
  description: string | null;
  is_paid: boolean;
  allows_half_day: boolean;
  requires_document: boolean;
  is_statutory: boolean;
}

export interface LeavePolicy {
  id: string;
  leave_type_id: string;
  name: string;
  location_id: string | null;
  grade: string | null;
  annual_quota_days: string;
  accrual_frequency: AccrualFrequency;
  max_carry_forward_days: string;
  max_consecutive_days: number | null;
  min_notice_days: number;
  allows_negative_balance: boolean;
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
  is_optional: boolean;
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
  reason: string | null;
  document_url: string | null;
  status: LeaveRequestStatus;
  approval_chain: ApprovalStep[];
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
  can_decide: boolean;
  can_cancel: boolean;
}

export interface LeaveRequestInput {
  leave_type_id: string;
  start_date: string;
  end_date: string;
  is_half_day: boolean;
  reason?: string | null;
  employee_id?: string | null;
}

export interface LeavePreview {
  total_days: string;
  working_days: number;
  weekly_offs: string[];
  holidays: { date: string; name: string }[];
  available_before: string | null;
  pending_days: string | null;
  available_after: string | null;
  approvers: string[];
  allowed: boolean;
  problems: string[];
  warnings: string[];
}

export interface LeaveBalance {
  leave_type_id: string;
  leave_type_name: string;
  leave_type_code: string;
  is_paid: boolean;
  is_statutory: boolean;
  year: number;
  policy_name: string | null;
  annual_quota_days: string | null;
  accrual_frequency: AccrualFrequency | null;
  opening: string;
  accrued: string;
  carried_forward: string;
  used: string;
  encashed: string;
  pending: string;
  available: string;
  available_after_pending: string;
}

export interface WhoIsOut {
  employee_id: string;
  employee_name: string;
  photo_url: string | null;
  start_date: string;
  end_date: string;
  is_half_day: boolean;
  status: LeaveRequestStatus;
  leave_type_name: string | null;
}

export interface AccrualRun {
  year: number;
  as_of: string;
  balances_updated: number;
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
