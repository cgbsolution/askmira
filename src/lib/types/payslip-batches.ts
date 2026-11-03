/** Payslips of chosen people for the last 1, 3, 6 or 12 months, downloaded or emailed. */

export type PayslipPeriodMonths = 1 | 3 | 6 | 12;

export interface PayslipPerson {
  employee_id: string;
  employee_code: string;
  full_name: string;
  department: string | null;
  designation: string | null;
  employment_status: "active" | "on_notice" | "on_leave" | "exited" | "pre_joining";
  date_of_exit: string | null;
  work_email: string | null;
  personal_email: string | null;
  /** Payslips of approved or paid months in the period: what a download holds. */
  payslips: number;
  /** Of those, the ones released to the person: what an email sends. */
  released: number;
}

export interface PayslipPeople {
  /** First day of the latest approved month, or null before the first payroll. */
  latest_month: string | null;
  months: number;
  period_start: string | null;
  period_end: string | null;
  period_label: string;
  /** False while no mail server is set up: emails would reach nobody. */
  email_ready: boolean;
  password_protected: boolean;
  password_rule: string;
  people: PayslipPerson[];
}

export interface PayslipBatchResult {
  employee_id: string;
  employee_code: string | null;
  name: string | null;
  status: "added" | "sent" | "skipped" | "failed";
  payslips: number;
  email: string | null;
  detail: string | null;
}

export interface PayslipBatch {
  id: string;
  action: "download" | "email";
  months: number;
  period_start: string;
  period_end: string;
  period_label: string;
  send_to: "work" | "personal" | null;
  status: "queued" | "running" | "completed" | "failed";
  total_people: number;
  total_payslips: number;
  processed: number;
  succeeded: number;
  skipped: number;
  failed: number;
  error: string | null;
  file_name: string | null;
  file_size: number | null;
  file_available: boolean;
  file_expires_at: string | null;
  requested_by_name: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  results: PayslipBatchResult[];
}
