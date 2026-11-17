/** Shapes returned by /consultant-hours. Hours are strings with two decimals. */

export type HoursStatus = "draft" | "submitted" | "approved" | "rejected";

export type DayStatus = "present" | "holiday" | "week_off" | "leave" | "half_day";

export interface HoursDay {
  date: string;
  hours: number;
  status: DayStatus;
}

export interface HoursAttachment {
  id: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  uploaded_at: string;
}

export interface HoursEntry {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string | null;
  period_start: string;
  period_end: string;
  project_id: string | null;
  project_name: string | null;
  total_billable_hours: string;
  non_billable_hours: string | null;
  days: HoursDay[] | null;
  customer_reference: string | null;
  status: HoursStatus;
  entered_by_user_id: string | null;
  last_edited_by_user_id: string | null;
  submitted_at: string | null;
  decided_by_user_id: string | null;
  decided_at: string | null;
  decision_note: string | null;
  attachments: HoursAttachment[];
  /** True when the caller may approve or reject it now. */
  can_approve: boolean;
  /** Why nobody can approve it yet, when that is so. */
  approval_note: string | null;
}

/** What is sent to create or change an entry. */
export interface HoursPayload {
  employee_id: string;
  period_start: string;
  period_end: string;
  project_id: string | null;
  total_billable_hours?: number;
  non_billable_hours: number | null;
  days: HoursDay[] | null;
  customer_reference: string | null;
}
