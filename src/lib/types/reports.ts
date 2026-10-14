/**
 * The report builder, as the API exposes it.
 *
 * Mirrors `app/api/v1/routers/reports.py` and the catalogue in
 * `app/services/reporting/semantic.py`. A definition carries catalogue keys
 * only — there is no field in it that can name a table or a column.
 */

export type DataType = "string" | "integer" | "decimal" | "date" | "datetime" | "boolean" | "enum";
export type Sensitivity = "public" | "hr_only" | "payroll_only";
export type ChartType = "table" | "bar" | "line" | "pie" | "stacked";
export type ReportVisibility = "private" | "shared" | "tenant";
export type ReportCadence = "daily" | "weekly" | "monthly" | "quarterly";

export type Operator =
  | "equals"
  | "not_equals"
  | "in"
  | "not_in"
  | "contains"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between"
  | "relative_range"
  | "is_null"
  | "is_not_null";

export interface CatalogueField {
  key: string;
  display_name: string;
  data_type: DataType;
  sensitivity: Sensitivity;
  is_dimension: boolean;
  is_measure: boolean;
  aggregations: string[];
  description: string | null;
}

export interface CatalogueEntity {
  key: string;
  display_name: string;
  description: string;
  supports_row_scope: boolean;
  fields: CatalogueField[];
}

export interface Catalogue {
  entities: CatalogueEntity[];
  relative_ranges: { key: string; description: string }[];
  /** What rows this person's reports return: their own, their team's, or everyone's. */
  row_scope: string;
}

export interface Starter {
  key: string;
  name: string;
  description: string;
  question: string;
  category: string;
  chart_type: ChartType;
  entity_key: string;
  required_sensitivity: Sensitivity;
}

export interface Selection {
  field_key: string;
  aggregation: string | null;
  label: string;
}

export interface Filter {
  field_key: string;
  operator: Operator;
  value: unknown;
  values: unknown[];
}

export interface Definition {
  entity_key: string;
  selections: Selection[];
  filters: Filter[];
  group_by: string[];
  sort_by: string[][];
  limit: number;
  offset: number;
}

export interface SavedReport {
  id: string;
  name: string;
  description: string | null;
  entity_key: string;
  definition: Definition;
  chart_type: ChartType;
  visibility: ReportVisibility;
  owner_user_id: string | null;
  created_from_starter: string | null;
  last_run_at: string | null;
}

export interface ResultColumn {
  key: string;
  label: string;
  data_type: DataType;
  aggregation: string | null;
  sensitivity: Sensitivity;
}

export interface ReportResult {
  run_id: string;
  columns: ResultColumn[];
  /** Positional: `rows[i][j]` is the value of `columns[j]`. */
  rows: unknown[][];
  total_rows: number;
  returned_rows: number;
  max_sensitivity: Sensitivity;
  row_scope: string;
  notes: string[];
  /** Fields the definition asked for that this role may not see — dropped, and said so. */
  denied_fields: string[];
  duration_ms: number | null;
}

export interface ReportSchedule {
  id: string;
  report_id: string;
  report_name: string;
  cadence: ReportCadence;
  hour_of_day: number;
  day_of_week: number | null;
  day_of_month: number | null;
  timezone: string;
  recipients: number;
  format: string;
  on_empty: "send_anyway" | "skip";
  is_active: boolean;
  next_run_at: string | null;
  last_run_at: string | null;
  mine: boolean;
}

// ── People analytics ───────────────────────────────────────────────────────

export interface HeadcountPoint {
  /** `YYYY-MM`; the headcount is at the month's last day. */
  month: string;
  headcount: number;
  joiners: number;
  leavers: number;
}

export interface AttritionMonth {
  month: string;
  average_headcount: string;
  exits: number;
  voluntary_exits: number;
  rate_percent: string;
  voluntary_rate_percent: string;
}

export interface AttritionDepartment {
  department: string;
  average_headcount: string;
  exits: number;
  attrition_percent: string;
}

export interface Attrition {
  from: string;
  to: string;
  average_headcount: string;
  exits: number;
  voluntary_exits: number;
  attrition_percent: string;
  voluntary_attrition_percent: string;
  /** How the rate was worked out, in words, shown beside it. */
  basis: string;
  monthly: AttritionMonth[];
  by_department?: AttritionDepartment[];
}

export interface LeaveTrend {
  leave_types: string[];
  /** Each row has `month` plus one decimal-string key per leave type. */
  months: Array<{ month: string } & Record<string, string>>;
}

export interface Signal {
  kind: "burnout_risk" | "no_leave" | "bridge_absences" | "unpaid_absence" | "frequent_absence" | "pay_revision";
  label: string;
  rule: string;
  evidence: string[];
}

export interface PersonSignals {
  employee_id: string;
  employee_code: string;
  employee_name: string;
  signals: Signal[];
}

export interface DashboardWidget {
  id: string;
  report_id: string;
  name: string;
  description: string | null;
  chart_type: ChartType;
  position: number;
}

export interface AbsenceScoreRow {
  employee_id: string;
  employee_code: string;
  employee_name: string;
  spells: number;
  days: string;
  bradford_factor: number;
  at_or_above_review: boolean;
}

export interface AbsenceScores {
  /** The formula and what counts, in words. */
  method: string;
  review_threshold: number;
  from: string;
  to: string;
  people: AbsenceScoreRow[];
}

export interface RatingCycle {
  cycle_id: string;
  cycle: string;
  period_end: string;
  status: string;
  appraisal_count: number;
  completed: number;
  completion_percent: string;
  mean_final_score: string | null;
  /** Count per rating label, in the order of the rating list. */
  ratings: Record<string, number>;
}

export interface GoalSummary {
  goals: number;
  completed: number;
  completed_percent: string;
  average_progress_percent: string;
}

export interface RaterRow {
  rater: string;
  ratings: number;
  mean_score: string;
  gap: string;
  flagged: boolean;
  direction: "higher" | "lower" | null;
}

export interface PerformanceOverview {
  rating_trend: { ratings: string[]; cycles: RatingCycle[] };
  goal_attainment: {
    cycles: Array<{ cycle_id: string; cycle: string } & GoalSummary>;
    departments: Array<{ department: string } & GoalSummary>;
    departments_cycle?: string;
  };
  /** HR only; null for a line manager. */
  rater_spread: {
    cycle: string | null;
    rule: string;
    overall_mean?: string;
    standard_deviation?: string;
    scores?: number;
    raters: RaterRow[];
  } | null;
}
