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
