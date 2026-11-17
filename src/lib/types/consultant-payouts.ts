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

/** One priced piece of an hourly entry: a worked day, or the whole period when only a total was given. */
export interface HourlyBreakdownRow {
  date?: string;
  period_start?: string;
  period_end?: string;
  hours: string;
  rate: string | null;
  amount: string;
}

/**
 * One month of a fixed-monthly entry: the days of the period in that month at the
 * fee in force each day, over the days in the month. `fee` is null when the fee
 * changed during the month (see `fees`) or a day had none.
 */
export interface FixedMonthlyBreakdownRow {
  /** "YYYY-MM". */
  month: string;
  days: number;
  days_in_month: number;
  fee: string | null;
  fees: { fee: string; days: number }[];
  amount: string;
}

export type PayoutBreakdownRow = HourlyBreakdownRow | FixedMonthlyBreakdownRow;

export const isFixedMonthlyRow = (row: PayoutBreakdownRow): row is FixedMonthlyBreakdownRow =>
  "month" in row;

export interface PayoutEntryFile {
  id: string;
  file_name: string;
}

/** A finance-entered, approved hours entry paid on a line. */
export interface PayoutEntry {
  id: string;
  entry_id: string;
  period_start: string;
  period_end: string;
  project_id: string | null;
  hours: string;
  gross: string;
  breakdown: PayoutBreakdownRow[];
  attachments: PayoutEntryFile[];
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
  entries: PayoutEntry[];
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
