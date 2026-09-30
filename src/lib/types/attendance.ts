/**
 * Attendance, shifts, rosters and device types (slices 02 and 04).
 *
 * These mirror `backend/app/schemas/attendance.py` and `schemas/devices.py`.
 * Decimal figures (payable days, LOP) arrive as strings and stay strings.
 */

export type PunchDirection = "in" | "out";
export type PunchSource = "biometric" | "mobile_geo" | "web" | "manual" | "import";

export type AttendanceStatus =
  | "present"
  | "absent"
  | "half_day"
  | "week_off"
  | "holiday"
  | "on_leave"
  | "lop"
  | "needs_regularisation";

/** What a regularisation may ask for. Leave is requested as leave. */
export const REGULARISABLE_STATUSES: AttendanceStatus[] = ["present", "half_day", "absent", "lop"];

export type RegularisationStatus = "pending" | "approved" | "rejected" | "cancelled";

/**
 * What a request asks for. Missed punch applies the corrected in/out times;
 * on duty and work from home count as present and may be asked ahead of time.
 */
export type RegularisationKind = "missed_punch" | "status_change" | "on_duty" | "work_from_home";

export interface PunchInput {
  direction: PunchDirection;
  latitude?: number | null;
  longitude?: number | null;
  /** HR only. */
  employee_id?: string | null;
  punched_at?: string | null;
  source?: PunchSource | null;
}

export interface Punch {
  id: string;
  employee_id: string;
  punched_at: string;
  direction: PunchDirection;
  source: PunchSource;
  device_id: string | null;
  outside_geofence: boolean;
  /** Metres beyond the nearest work location's edge; negative inside it. */
  nearest_location_metres: number | null;
  latitude: number | null;
  longitude: number | null;
  /** The nearest work location's name when the punch was made. */
  location_label: string | null;
}

/** How punches record location in this workspace. */
export type LocationMode = "off" | "optional" | "required";

export interface AttendanceSettings {
  location_mode: LocationMode;
}

export interface AttendanceDay {
  id: string;
  employee_id: string;
  attendance_date: string;
  shift_id: string | null;
  status: AttendanceStatus;
  /** "1.00", "0.50" or "0.00". */
  payable_fraction: string;
  worked_minutes: number;
  first_in: string | null;
  last_out: string | null;
  late_by_minutes: number;
  early_by_minutes: number;
  overtime_minutes: number;
  is_regularised: boolean;
  computation_note: string | null;
}

export interface EmployeeAttendanceSummary {
  employee_id: string;
  employee_code: string;
  employee_name: string;
  payable_days: string;
  lop_days: string;
  present_days: number;
  half_days: number;
  absent_days: number;
  on_leave_days: number;
  late_count: number;
  needs_regularisation: number;
  days_computed: number;
}

export interface AttendanceSummaryResponse {
  period_start: string;
  period_end: string;
  is_locked: boolean;
  employees: EmployeeAttendanceSummary[];
}

/** A shift as the person working it sees it. Times are "HH:MM:SS". */
export interface ShiftBrief {
  id: string;
  code: string;
  name: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  grace_in_minutes: number;
  is_night_shift: boolean;
  weekly_off_days: number[];
}

export interface CalendarHoliday {
  holiday_date: string;
  name: string;
}

export interface CalendarLeave {
  leave_date: string;
  leave_type: string;
  is_half_day: boolean;
  status: "approved" | "pending";
}

export interface MyAttendancePeriod {
  period_start: string;
  period_end: string;
  is_locked: boolean;
  summary: EmployeeAttendanceSummary;
  days: AttendanceDay[];
  /** The workspace's local date. */
  today: string;
  date_of_joining: string | null;
  shift_today: ShiftBrief | null;
  shift_today_is_default: boolean;
  has_no_shift: boolean;
  shifts: ShiftBrief[];
  holidays: CalendarHoliday[];
  leaves: CalendarLeave[];
}

export type TeamMemberState =
  | "in"
  | "out"
  | "not_in"
  | "on_leave"
  | "holiday"
  | "week_off"
  | "on_duty"
  | "work_from_home";

export interface TeamMemberToday {
  employee_id: string;
  employee_code: string;
  employee_name: string;
  designation: string | null;
  state: TeamMemberState;
  first_in: string | null;
  last_punch_at: string | null;
  last_direction: PunchDirection | null;
  last_punch_location: string | null;
  last_punch_outside: boolean;
  shift_name: string | null;
  shift_start: string | null;
  late_by_minutes: number;
  detail: string | null;
}

export interface TeamToday {
  today: string;
  members: TeamMemberToday[];
  counts: Partial<Record<TeamMemberState | "late", number>>;
}

export interface RegularisationInput {
  attendance_date: string;
  kind: RegularisationKind;
  requested_status: AttendanceStatus;
  reason: string;
  requested_first_in?: string | null;
  requested_last_out?: string | null;
  employee_id?: string | null;
}

export interface RegularisationRangeInput {
  kind: "on_duty" | "work_from_home";
  start_date: string;
  end_date: string;
  reason: string;
  employee_id?: string | null;
}

export interface Regularisation {
  id: string;
  employee_id: string;
  attendance_date: string;
  kind: RegularisationKind;
  requested_status: AttendanceStatus;
  requested_first_in: string | null;
  requested_last_out: string | null;
  reason: string;
  status: RegularisationStatus;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string | null;
}

export interface RegularisationQueueItem extends Regularisation {
  employee_code: string;
  employee_name: string;
  current_status: AttendanceStatus | null;
  current_note: string | null;
  period_locked: boolean;
}

export type AttendanceExceptionKind =
  | "needs_regularisation"
  | "absent"
  | "late"
  | "early_out"
  | "outside_geofence";

export interface AttendanceException {
  employee_id: string;
  employee_code: string;
  employee_name: string;
  attendance_date: string;
  kind: AttendanceExceptionKind;
  status: AttendanceStatus | null;
  late_by_minutes: number;
  early_by_minutes: number;
  detail: string;
  has_pending_regularisation: boolean;
}

export interface AttendanceExceptionReport {
  period_start: string;
  period_end: string;
  employees_in_scope: number;
  exceptions: AttendanceException[];
}

export interface PeriodLock {
  id: string;
  period_start: string;
  period_end: string;
  locked_at: string;
  locked_by_user_id: string | null;
  unlocked_at: string | null;
  unlocked_by_user_id: string | null;
  unlock_reason: string | null;
}

export interface PunchImportRowError {
  row: number;
  employee_code: string | null;
  error: string;
}

export interface PunchImportResult {
  imported: number;
  duplicates: number;
  skipped_unknown_employee: string[];
  errors: PunchImportRowError[];
}

// ── Shifts, rosters, assignments ────────────────────────────────────────────

export interface ShiftInput {
  name: string;
  /** "HH:MM" or "HH:MM:SS". */
  start_time: string;
  end_time: string;
  break_minutes: number;
  grace_in_minutes: number;
  grace_out_minutes: number;
  half_day_threshold_minutes: number;
  full_day_threshold_minutes: number;
  is_night_shift: boolean;
  /** ISO weekdays, 1 = Monday … 7 = Sunday. */
  weekly_off_days: number[];
}

export interface ShiftCreateInput extends ShiftInput {
  code: string;
}

export interface ShiftUpdateInput extends ShiftInput {
  active: boolean;
}

export interface Shift extends ShiftInput {
  id: string;
  code: string;
  active: boolean;
  /** Applies to anyone with no shift or roster assignment. */
  is_default: boolean;
}

export interface RosterDay {
  day_index: number;
  /** Null is a week off on that day of the rotation. */
  shift_id: string | null;
}

export interface RosterInput {
  name: string;
  description: string | null;
  cycle_days: number;
  days: RosterDay[];
}

export interface Roster extends RosterInput {
  id: string;
  active: boolean;
}

export interface ShiftAssignmentInput {
  employee_id: string;
  shift_id: string;
  effective_from: string;
  effective_to?: string | null;
}

export interface RosterAssignmentInput {
  employee_id: string;
  roster_id: string;
  cycle_start_date: string;
  effective_from: string;
  effective_to?: string | null;
}

export interface Assignment {
  id: string;
  kind: "shift" | "roster";
  employee_id: string;
  employee_code: string;
  employee_name: string;
  shift_id: string | null;
  roster_id: string | null;
  target_name: string;
  cycle_start_date: string | null;
  effective_from: string;
  effective_to: string | null;
}

export interface WorkLocationInput {
  name: string;
  location_id?: string | null;
  latitude: string;
  longitude: string;
  radius_metres: number;
}

/** The fields of `GET /org/locations` a work-location picker needs. */
export interface OrgLocationOption {
  id: string;
  name: string;
  city: string | null;
  state_code: string | null;
}

export interface WorkLocation {
  id: string;
  name: string;
  location_id: string | null;
  latitude: string;
  longitude: string;
  radius_metres: number;
  active: boolean;
}

// ── Devices ─────────────────────────────────────────────────────────────────

export type DeviceVendor = "essl" | "matrix" | "zkteco" | "generic";
export type DeviceStatus = "active" | "silent" | "disabled";

export interface DeviceInput {
  device_id: string;
  name: string;
  vendor: DeviceVendor;
  work_location_id?: string | null;
  assumed_timezone: string;
  silence_threshold_minutes: number;
}

export interface DeviceUpdateInput {
  name?: string;
  work_location_id?: string | null;
  clear_work_location?: boolean;
  assumed_timezone?: string;
  silence_threshold_minutes?: number;
  enabled?: boolean;
}

export interface Device {
  id: string;
  device_id: string;
  name: string;
  vendor: DeviceVendor;
  status: DeviceStatus;
  work_location_id: string | null;
  assumed_timezone: string;
  last_seen_at: string | null;
  silence_threshold_minutes: number;
  push_token_hint: string | null;
}

/** Returned by register and rotate only. The token is never shown again. */
export interface DeviceWithToken extends Device {
  push_token: string;
}

export interface DevicePunchException {
  id: string;
  device_id: string;
  employee_code: string | null;
  punched_at: string;
  reason: string;
  resolved_at: string | null;
  resolved_employee_id: string | null;
  created_at: string | null;
}

export interface DeviceIngestionRow {
  device: Device;
  is_silent: boolean;
  minutes_since_seen: number | null;
  punches_last_24h: number;
  punches_last_7d: number;
  open_exceptions: number;
}

export interface IngestionStatus {
  generated_at: string;
  device_count: number;
  silent_count: number;
  open_exceptions: number;
  punches_last_24h: number;
  devices: DeviceIngestionRow[];
  pull_ingestion_built: boolean;
  silence_alerts_sent: boolean;
  notes: string[];
}
