/**
 * HR helpdesk types. These mirror `backend/app/schemas/helpdesk.py` exactly.
 *
 * A requester's `TicketDetail` never carries an internal note or a file on one:
 * the API leaves them out, the portal does not hide them.
 */

import type { UserRole } from "@/lib/types";

export type RequestKind =
  | "general"
  | "letter"
  | "id_card"
  | "asset"
  | "it"
  | "payroll"
  | "policy"
  | "grievance";

export type TicketPriority = "low" | "medium" | "high" | "urgent";

export type TicketStatus =
  | "open"
  | "in_progress"
  | "waiting_on_employee"
  | "resolved"
  | "closed"
  | "cancelled";

export type SlaState = "on_track" | "due_soon" | "overdue" | "met" | "breached" | "none";

export interface HelpdeskCategory {
  id: string;
  name: string;
  description: string | null;
  owner_user_id: string | null;
  owner_name: string | null;
  sla_hours: number;
  is_confidential: boolean;
  request_kind: RequestKind;
  active: boolean;
  sort_order: number;
  /** HR only; null for everyone else. */
  ticket_count: number | null;
}

export interface CategoryInput {
  name: string;
  description: string | null;
  owner_user_id: string | null;
  sla_hours: number;
  is_confidential: boolean;
  request_kind: RequestKind;
  active: boolean;
  sort_order: number;
}

export interface StandardCategory {
  name: string;
  description: string;
  request_kind: RequestKind;
  sla_hours: number;
  is_confidential: boolean;
}

export interface StandardCategoriesResult {
  created: HelpdeskCategory[];
  skipped: string[];
}

export interface TicketAttachment {
  id: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
}

export interface TicketComment {
  id: string;
  author_user_id: string | null;
  author_name: string | null;
  body: string;
  is_internal: boolean;
  is_system: boolean;
  is_from_requester: boolean;
  created_at: string;
  attachments: TicketAttachment[];
}

export interface TicketSummary {
  id: string;
  ticket_number: string;
  subject: string;
  category_id: string;
  category_name: string;
  request_kind: RequestKind;
  priority: TicketPriority;
  status: TicketStatus;
  is_confidential: boolean;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  raised_by_user_id: string | null;
  raised_on_behalf: boolean;
  assignee_user_id: string | null;
  assignee_name: string | null;
  sla_hours: number;
  due_at: string;
  sla_state: SlaState;
  first_response_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  satisfaction_rating: number | null;
  created_at: string;
  last_activity_at: string;
}

export interface TicketDetail extends TicketSummary {
  description: string;
  cancelled_at: string | null;
  reopened_count: number;
  satisfaction_comment: string | null;
  rated_at: string | null;
  attachments: TicketAttachment[];
  comments: TicketComment[];
  viewer: "requester" | "agent";
  can_reply: boolean;
  can_add_internal_note: boolean;
  can_cancel: boolean;
  can_reopen: boolean;
  reopen_until: string | null;
  can_rate: boolean;
  can_manage: boolean;
}

export interface AgentOption {
  user_id: string;
  full_name: string;
  role: UserRole;
  is_category_owner: boolean;
}

export interface QueueSummary {
  open: number;
  overdue: number;
  due_soon: number;
  unassigned: number;
  period_start: string;
  resolved_this_month: number;
  avg_first_response_hours: number | null;
  first_response_sample: number;
  avg_resolution_hours: number | null;
  resolution_sample: number;
  avg_satisfaction: number | null;
  satisfaction_sample: number;
}

export interface MyHelpdeskSummary {
  open_count: number;
  waiting_on_you: number;
  latest: TicketSummary[];
  is_agent: boolean;
}
