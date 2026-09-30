/**
 * Onboarding contracts, matching `app/schemas/onboarding.py` field for field.
 *
 * Progress, overdue counts and each task's phase are computed by the API; the
 * portal never derives one of its own.
 */

export type OnboardingOwnerType = "new_joiner" | "manager" | "hr" | "it" | "buddy" | "finance";

export type OnboardingTaskType =
  | "general"
  | "document_upload"
  | "form"
  | "acknowledge_policy"
  | "meeting";

export type OnboardingPlanStatus = "in_progress" | "completed" | "cancelled";

export type OnboardingTaskStatus = "pending" | "done" | "skipped";

/** Where a task sits relative to the joining date. */
export type OnboardingPhase = "pre_joining" | "week_1" | "later";

/** A vault category value (`DocumentCategory`). */
export type OnboardingDocumentType =
  | "id_proof"
  | "address_proof"
  | "education"
  | "experience"
  | "contract"
  | "offer_letter"
  | "policy_ack"
  | "payslip"
  | "tax"
  | "medical"
  | "other";

// ── Checklists ──────────────────────────────────────────────────────────────

export interface TemplateTaskInput {
  title: string;
  description: string | null;
  owner_type: OnboardingOwnerType;
  owner_user_id: string | null;
  due_offset_days: number;
  task_type: OnboardingTaskType;
  document_type: OnboardingDocumentType | null;
  is_mandatory: boolean;
}

export interface TemplateInput {
  name: string;
  description: string | null;
  department_id: string | null;
  location_id: string | null;
  active: boolean;
  is_default: boolean;
  tasks: TemplateTaskInput[];
}

export interface OnboardingTemplateTask {
  id: string;
  title: string;
  description: string | null;
  owner_type: OnboardingOwnerType;
  owner_user_id: string | null;
  owner_name: string | null;
  due_offset_days: number;
  task_type: OnboardingTaskType;
  document_type: string | null;
  sort_order: number;
  is_mandatory: boolean;
}

export interface OnboardingTemplate {
  id: string;
  name: string;
  description: string | null;
  department_id: string | null;
  department_name: string | null;
  location_id: string | null;
  location_name: string | null;
  active: boolean;
  is_default: boolean;
  task_count: number;
  plan_count: number;
  tasks: OnboardingTemplateTask[];
  created_at: string;
  updated_at: string;
}

// ── Plans ───────────────────────────────────────────────────────────────────

export interface PlanCreateInput {
  employee_id: string;
  template_id: string;
  buddy_employee_id: string | null;
  joining_date: string | null;
}

export interface PlanProgress {
  total: number;
  done: number;
  skipped: number;
  pending: number;
  overdue: number;
  mandatory_pending: number;
  unassigned: number;
  /** Done or skipped over total, 0-100, rounded down. */
  percent: number;
}

export interface OnboardingPlan {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  employee_status: string;
  designation: string | null;
  department_id: string | null;
  department_name: string | null;
  manager_name: string | null;
  template_id: string | null;
  template_name: string;
  joining_date: string;
  buddy_employee_id: string | null;
  buddy_name: string | null;
  status: OnboardingPlanStatus;
  started_by_name: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  progress: PlanProgress;
  created_at: string;
}

export interface OnboardingTask {
  id: string;
  plan_id: string;
  title: string;
  description: string | null;
  owner_type: OnboardingOwnerType;
  assignee_user_id: string | null;
  assignee_name: string | null;
  due_date: string;
  phase: OnboardingPhase;
  is_overdue: boolean;
  task_type: OnboardingTaskType;
  document_type: string | null;
  sort_order: number;
  is_mandatory: boolean;
  status: OnboardingTaskStatus;
  completed_by_name: string | null;
  completed_at: string | null;
  note: string | null;
  document_id: string | null;
  document_title: string | null;
  /** Whether the caller may mark it done (or upload for it). */
  can_complete: boolean;
  /** Whether the caller may skip, reassign or re-date it (HR). */
  can_manage: boolean;
}

export interface OnboardingPlanDetail extends OnboardingPlan {
  tasks: OnboardingTask[];
}

/** A task on somebody else's plan, with whose plan it is. */
export interface MyOnboardingTask extends OnboardingTask {
  employee_id: string;
  employee_name: string;
  employee_code: string;
  designation: string | null;
  joining_date: string;
}

export interface OnboardingMe {
  plan: OnboardingPlanDetail | null;
}

export interface OnboardingNextTask {
  id: string;
  title: string;
  due_date: string;
  is_overdue: boolean;
}

export interface OnboardingSummary {
  has_plan: boolean;
  plan_id: string | null;
  plan_status: OnboardingPlanStatus | null;
  joining_date: string | null;
  progress: PlanProgress | null;
  next_task: OnboardingNextTask | null;
  assigned_pending: number;
  assigned_overdue: number;
  assigned_next: OnboardingNextTask[];
}

export interface TaskUpdateInput {
  assignee_user_id?: string;
  due_date?: string;
}

export interface OnboardingOwnerCandidate {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
}
