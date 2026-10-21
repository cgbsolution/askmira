import type { UserRole } from "@/lib/types";

/**
 * Workspace administration: company settings, logins, module switches, the
 * audit trail and the background jobs.
 *
 * Mirrors `app/api/v1/routers/admin.py` and `app/schemas/platform_admin.py`.
 */

export interface TenantSettings {
  id: string;
  name: string;
  slug: string;
  plan: string;
  data_region: string;
  enabled_modules: Record<string, boolean>;
  settings: Record<string, unknown>;
}

export interface TenantSettingsUpdate {
  name?: string;
  currency?: string;
  timezone?: string;
  fiscal_year_start_month?: number;
  week_start?: "monday" | "sunday" | "saturday";
}

export interface ModuleRow {
  key: string;
  description: string;
  enabled: boolean;
}

export interface ModuleState {
  modules: ModuleRow[];
}

export interface ManagedUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  employee_id: string | null;
  employee_name: string | null;
  employee_code: string | null;
  last_login_at: string | null;
  created_at: string;
  /** The signed-in admin's own row — they may not change their own role or disable themselves. */
  is_you: boolean;
  /** The break-glass account, which survives an SSO lockout and may not be disabled. */
  is_break_glass: boolean;
  /** Still on the password they were given; their welcome email can be resent. */
  invite_pending: boolean;
}

/** What became of a login's welcome email. */
export interface WelcomeEmail {
  /** `no_relay`: no mail relay is set up, so it was only logged on the server. */
  status: "sent" | "queued" | "failed" | "no_relay";
  detail: string;
  sent_to: string;
  /** When its set-password link stops working; null when the company signs in with SSO. */
  link_expires_at: string | null;
}

export interface ManagedUserCreated {
  user: ManagedUser;
  /** Shown once, never retrievable again — only its hash is stored. */
  temporary_password: string;
  /** Null when the admin chose not to send one. */
  welcome_email: WelcomeEmail | null;
}

export interface RolePermission {
  id: string;
  role: string;
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve: boolean;
  can_export: boolean;
  field_restrictions: Record<string, unknown>;
}

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "approve"
  | "reject"
  | "login"
  | "logout"
  | "login_failed"
  | "export"
  /** Reading restricted data without taking a copy — a different question from `export`. */
  | "sensitive_read"
  | "permission_change"
  /** Every AI Companion / MCP action (FS-AIT-01). */
  | "ai_action"
  /** A statutory rule version created or approved. */
  | "rule_change";

export interface AuditLogEntry {
  id: string;
  actor_user_id: string | null;
  actor_type: string;
  action: AuditAction;
  entity_type: string;
  entity_id: string | null;
  changes: Record<string, unknown>;
  summary: string | null;
  ai_context: Record<string, unknown> | null;
  created_at: string;
}

export interface SchedulerRun {
  id: string;
  status: "succeeded" | "failed" | "running" | "skipped";
  started_at: string;
  finished_at: string | null;
  /** How it was started: the scheduler tick, or a named admin. */
  trigger: string | null;
  /** What the job returned — a flat object such as `{date, days_written}`, or `{}`. */
  detail: Record<string, unknown>;
  error: string | null;
}

export interface SchedulerJob {
  key: string;
  name: string;
  description: string;
  cadence: string;
  /** The service function the job calls — so the claim is checkable, not just asserted. */
  source: string;
  scope: "tenant" | "global";
  module: string | null;
  /** False when the job's module is switched off for this workspace. */
  applies: boolean;
  last_run: SchedulerRun | null;
  last_success: SchedulerRun | null;
  last_failure: SchedulerRun | null;
  failures_last_7_days: number;
  can_run_now: boolean;
}

export interface SchedulerRunnerStatus {
  enabled: boolean;
  running_on_this_instance: boolean;
  /** Jobs run on whichever instance holds the advisory lock, so exactly one does. */
  this_instance_is_leader: boolean;
  last_tick_at: string | null;
  last_error: string | null;
  tick_seconds: number;
}

export interface SchedulerJobs {
  runner: SchedulerRunnerStatus;
  jobs: SchedulerJob[];
  /** Requirements that have no job yet — named rather than quietly omitted. */
  not_yet_registered: { requirement: string; reason: string }[];
  note: string;
}
