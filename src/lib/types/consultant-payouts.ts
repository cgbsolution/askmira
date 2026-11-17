/** Shapes returned by /consultant-payouts and /payroll/my-payouts. Money is a string. */

export type PayoutRunStatus = "draft" | "approved" | "paid";

export type TdsSection = "194C" | "194J_professional" | "194J_technical";

export interface PayoutTotals {
  lines_included: number;
  lines_held: number;
  lines_excluded: number;
  hours: string;
  gross: string;
  gst_amount: string;
  tds_due: string;
  tds_amount: string;
  tds_carried_out: string;
  net_payable: string;
}

export interface PayoutRunSummary {
  id: string;
  legal_entity_id: string | null;
  cut_off: string;
  pay_date: string;
  status: PayoutRunStatus;
  created_by_user_id: string | null;
  approved_by_user_id: string | null;
  approved_at: string | null;
  paid_on: string | null;
  payment_reference: string | null;
  created_at: string | null;
  totals: PayoutTotals;
}

export interface PayoutWeek {
  id: string;
  timesheet_id: string;
  week_start: string;
  hours: string;
  gross: string;
  breakdown: {
    work_date: string;
    project_id: string | null;
    hours: string;
    rate: string | null;
    amount: string;
  }[];
}

export interface PayoutLine {
  id: string;
  employee_id: string;
  employee_code: string | null;
  employee_name: string | null;
  hours: string;
  gross: string;
  gst_rate: string;
  gst_amount: string;
  section: TdsSection;
  tds_base: string;
  tds_rate: string;
  tds_due: string;
  tds_amount: string;
  tds_carried_out: string;
  net_payable: string;
  tds_note: string | null;
  problems: string[];
  excluded: boolean;
  excluded_reason: string | null;
  weeks: PayoutWeek[];
}

export interface PayoutRun extends PayoutRunSummary {
  lines: PayoutLine[];
}

export interface AttentionConsultant {
  employee_id: string;
  code: string;
  name: string;
  reasons: string[];
  old_gst_amount: string | null;
}

export interface PendingAdjustment {
  adjustment_id: string;
  employee_code: string;
  name: string;
  amount: string;
}

export interface PayoutAttention {
  consultants: AttentionConsultant[];
  pending_adjustments: PendingAdjustment[];
  /** Approved, unpaid weeks from before payouts began, to add to a draft run. */
  includable_weeks: number;
}

/** An older approved week a run did not take by itself (approved before payouts began). */
export interface IncludableWeek {
  timesheet_id: string;
  employee_id: string;
  employee_code: string;
  name: string;
  week_start: string;
  total_hours: string;
}

export interface MyPayout {
  line_id: string;
  run_id: string;
  pay_date: string;
  status: PayoutRunStatus;
  paid_on: string | null;
  hours: string;
  gross: string;
  gst_amount: string;
  section: TdsSection;
  tds_due: string;
  tds_amount: string;
  tds_carried_out: string;
  net_payable: string;
}
