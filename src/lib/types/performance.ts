/**
 * Performance types: reviews, goals, cycles, competencies, calibration, PIPs,
 * increments. Mirror `backend/app/schemas/performance.py`, `schemas/goals.py`
 * and the dict payloads of `services/appraisal/review.py`.
 *
 * Scores, weights, ratings and money arrive as decimal strings and stay strings.
 */

export type CycleType = "annual" | "half_yearly" | "quarterly" | "probation" | "off_cycle";
export type CycleStatus = "draft" | "active" | "in_calibration" | "closed";
export type StageRole = "self" | "manager" | "reviewer" | "hr" | "normalisation";
export type AppraisalStatus =
  | "not_started"
  | "in_progress"
  | "submitted"
  | "returned"
  | "completed"
  | "released"
  | "acknowledged";
export type AutoAdvance = "escalate" | "advance" | "hold";
export type StageState = "done" | "current" | "upcoming" | "skipped";

// ── Reviews ──────────────────────────────────────────────────────────────────

export interface MyReview {
  appraisal_id: string;
  cycle_id: string;
  cycle_name: string;
  cycle_type: CycleType;
  cycle_status: CycleStatus;
  period_start: string;
  period_end: string;
  status: AppraisalStatus;
  stage_label: string | null;
  stage_role: StageRole | null;
  due_date: string | null;
  days_overdue: number;
  waiting_on_me: boolean;
  final_rating: string | null;
  acknowledged_at: string | null;
}

export interface TeamReviewRow {
  appraisal_id: string;
  cycle_id: string;
  cycle_name: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  department: string | null;
  manager_name: string | null;
  status: AppraisalStatus;
  stage_label: string | null;
  stage_role: StageRole | null;
  due_date: string | null;
  days_overdue: number;
  escalation_due: boolean;
  escalated: boolean;
  awaiting_me: boolean;
  final_rating: string | null;
  final_score: string | null;
}

export interface Evidence {
  competency_code: string;
  competency_name: string;
  linked_value_codes: string[];
  has_evidence: boolean;
  recognition_count: number;
  distinct_recognisers: number;
  items: { recognition_id: string; value_code: string; from_name: string; message: string; given_on: string }[];
  note: string;
}

export interface GoalContribution {
  goal_id: string;
  title: string;
  status: string;
  weight: string;
  progress: string;
  share_of_score: string | null;
  key_results: { key_result_id: string; title: string; progress: string; weight: string }[];
}

export interface GoalScoreBreakdown {
  score: string | null;
  measured_weight_percent: string;
  contributing: GoalContribution[];
  excluded: { goal_id: string; title: string; reason: string }[];
  notes: string[];
}

export interface ScaleLevel {
  value: string;
  label: string;
  description: string;
  colour_hint?: string | null;
  is_default?: boolean;
}

export interface ScoreBand {
  label: string;
  lower: string;
  upper: string;
  description?: string | null;
}

export interface ReviewCompetency {
  competency_id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  weight: string;
  is_mandatory: boolean;
  indicators: { scale_value: string; behaviour: string }[];
  evidence: Evidence | null;
}

export interface ReviewValue {
  code: string;
  name: string;
  description: string;
  evidence: Evidence;
}

export interface CompetencyRatingInput {
  competency_id: string;
  rating: string | null;
  is_applicable: boolean;
  not_applicable_reason?: string | null;
  comment?: string | null;
}

export interface ValueRatingInput {
  value_code: string;
  rating: string | null;
  comment?: string | null;
}

export interface ReviewRatings {
  competencies?: CompetencyRatingInput[];
  values?: ValueRatingInput[];
  goals?: { goal_id: string; comment: string }[];
}

export interface ReviewEntry {
  id: string;
  stage_id: string;
  stage_label: string;
  stage_role: StageRole;
  actor_name: string | null;
  delegated_from_name: string | null;
  is_escalated: boolean;
  ratings: ReviewRatings;
  comments: string | null;
  score: string | null;
  submitted_at: string | null;
  returned_to_label: string | null;
  returned_reason: string | null;
}

export interface ReviewDetail {
  appraisal: {
    id: string;
    cycle_id: string;
    cycle_name: string;
    cycle_type: CycleType;
    cycle_status: CycleStatus;
    period_start: string;
    period_end: string;
    employee_id: string;
    employee_name: string;
    employee_code: string;
    designation: string | null;
    department: string | null;
    manager_name: string | null;
    status: AppraisalStatus;
    current_stage_id: string | null;
    current_stage_label: string | null;
    current_stage_role: StageRole | null;
    due_date: string | null;
    days_overdue: number;
    escalated: boolean;
    released_at: string | null;
    acknowledged_at: string | null;
    acknowledgement_type: "agreed" | "disagreed" | null;
    objection: string | null;
    reopened_count: number;
  };
  stages: { id: string; sequence: number; role: StageRole; label: string; due_date: string | null; is_mandatory: boolean; state: StageState }[];
  viewer: {
    is_subject: boolean;
    is_hr: boolean;
    can_act: boolean;
    act_reason: string | null;
    return_targets: { id: string; label: string }[];
    can_release: boolean;
    can_acknowledge: boolean;
    can_reopen: boolean;
  };
  template: {
    goal_weight: string;
    competency_weight: string;
    values_weight: string;
    score_precision: number;
    bands: ScoreBand[];
    scale: { id: string; name: string; min_value: string; max_value: string; allow_decimals: boolean; levels: ScaleLevel[] } | null;
  } | null;
  competencies: ReviewCompetency[];
  values: ReviewValue[];
  goals: GoalScoreBreakdown;
  entries: ReviewEntry[];
  draft: { ratings: ReviewRatings; comments: string | null } | null;
  outcome: { final_rating: string | null; final_score: string | null; calibrated: boolean | null } | null;
}

export interface ScorePreview {
  score: string | null;
  rating: { label: string; description: string | null } | null;
  breakdown: {
    goal_score: string;
    competency_score: string;
    values_score: string;
    weighted_total: string;
    unrounded_total: string;
    rounding: string;
    excluded_competencies: { code: string; name: string; weight: string; reason: string }[];
    notes: string[];
  } | null;
  goal: GoalScoreBreakdown;
  values_score: string | null;
  problems: string[];
}

export interface CycleProgressBucket {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
  completion_percent: number;
}

export interface CycleProgress {
  cycle: string;
  cycle_id: string;
  status: CycleStatus;
  total: number;
  completed: number;
  completion_percent: number;
  by_status: Record<string, number>;
  pending_by_stage: Record<string, number>;
  overdue_by_stage: Record<string, number>;
  by_department: (CycleProgressBucket & { department_id: string | null; department: string })[];
  by_manager: (CycleProgressBucket & { manager_id: string | null; manager_name: string })[];
}

export interface Delegation {
  id: string;
  cycle_id: string;
  from_user_id: string;
  from_name: string | null;
  to_user_id: string;
  to_name: string | null;
  effective_from: string;
  effective_to: string;
  reason: string | null;
  active: boolean;
  in_effect: boolean;
}

export interface Person {
  employee_id: string;
  name: string;
  employee_code: string;
  designation: string | null;
  grade: string | null;
  department_id: string | null;
  department: string | null;
  manager_id: string | null;
  user_id: string | null;
  role: string | null;
  is_self: boolean;
}

// ── Cycles ───────────────────────────────────────────────────────────────────

export interface CycleSummary {
  id: string;
  name: string;
  cycle_type: CycleType;
  status: CycleStatus;
  period_start: string;
  period_end: string;
  escalation_after_days: number;
  launched_at: string | null;
  closed_at: string | null;
  appraisals: number;
  completed: number;
  has_template: boolean;
}

export interface StageConfig {
  id: string;
  sequence: number;
  role: StageRole;
  label: string;
  due_date: string | null;
  open_date: string | null;
  close_date: string | null;
  grace_days: number;
  auto_advance: AutoAdvance;
  is_mandatory: boolean;
  can_reopen: boolean;
  sees_previous_entries: boolean;
  visible_to_employee_before_release: boolean;
}

export interface AppraisalTemplateConfig {
  id: string;
  rating_scale_id: string;
  rating_scale_name: string | null;
  competency_template_id: string | null;
  competency_template_name: string | null;
  goal_weight: string;
  competency_weight: string;
  values_weight: string;
  score_precision: number;
  bands: ScoreBand[];
}

export interface AssignmentRuleConfig {
  id: string;
  priority: number;
  template_id: string;
  conditions: Record<string, unknown>;
  label: string | null;
  is_default: boolean;
}

export interface CalibrationPolicyConfig {
  id: string;
  mode: "none" | "advisory" | "enforced";
  scope: CalibrationScope;
  min_group_size: number;
  disclose_calibration_to_employee: boolean;
  targets: { rating_value: string; target_percent: string; tolerance_percent: string }[];
}

export interface CycleDetail {
  cycle: CycleSummary | null;
  eligibility_rule: Record<string, unknown>;
  stages: StageConfig[];
  template: AppraisalTemplateConfig | null;
  rules: AssignmentRuleConfig[];
  policy: CalibrationPolicyConfig | null;
}

export interface StageInput {
  sequence: number;
  role: StageRole;
  label: string;
  due_date?: string | null;
  is_mandatory: boolean;
  sees_previous_entries: boolean;
  visible_to_employee_before_release: boolean;
}

export interface AssignmentPreview {
  eligible: number;
  resolved: number;
  unresolved: { employee_id: string; employee_code: string; reason: string }[];
  by_template: Record<string, number>;
  rules: number;
}

export interface Distribution {
  mode: string;
  scope?: string;
  distributions: DistributionScope[];
  blockers: { scope_value: string; rating: string; message: string }[];
  can_close: boolean;
  excluded_scopes: { scope_value: string; reason: string | null }[];
  note?: string;
}

export type ProbationOutcome = "confirm" | "extend" | "terminate";

export interface ProbationReview {
  id: string;
  employee_id: string;
  employee_name: string | null;
  probation_end_date: string;
  review_due_date: string;
  outcome: ProbationOutcome | null;
  outcome_recorded_at: string | null;
  extended_to: string | null;
  extends_review_id: string | null;
  notes: string | null;
}

// ── Competencies ─────────────────────────────────────────────────────────────

export type CompetencyCategory = "behavioural" | "functional" | "leadership";
export type ScaleType = "numeric" | "label" | "percentage";

export interface RatingScale {
  id: string;
  name: string;
  scale_type: ScaleType;
  min_value: string;
  max_value: string;
  allow_decimals: boolean;
  active: boolean;
  levels: ScaleLevel[];
}

export interface Competency {
  id: string;
  code: string;
  name: string;
  category: CompetencyCategory;
  scale_id: string;
  description: string | null;
  active: boolean;
  indicators: { scale_value: string; behaviour: string }[];
  linked_value_codes: string[];
}

export interface CompetencyTemplate {
  id: string;
  name: string;
  description: string | null;
  applicable_roles: string[];
  applicable_grades: string[];
  active: boolean;
  items: {
    competency_id: string;
    competency_code: string;
    competency_name: string;
    weight: string;
    is_mandatory: boolean;
    display_order: number;
  }[];
  total_weight: string;
}

// ── Calibration ──────────────────────────────────────────────────────────────

export type CalibrationScope = "company" | "department" | "manager" | "grade";
export type SessionStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

export interface CalibrationSession {
  id: string;
  cycle_id: string;
  cycle_name: string | null;
  name: string;
  scope: CalibrationScope;
  scope_value: string;
  status: SessionStatus;
  facilitator_user_id: string | null;
  facilitator_name: string | null;
  participant_user_ids: string[];
  scheduled_at: string | null;
  locked_at: string | null;
}

export interface DistributionCount {
  rating: string;
  count: number;
  actual_percent: string;
  target_percent: string | null;
  lower_bound: string | null;
  upper_bound: string | null;
  is_within_tolerance: boolean;
  gap_percent: string;
}

export interface DistributionScope {
  scope: string;
  scope_value: string;
  population: number;
  is_excluded_as_small: boolean;
  exclusion_reason: string | null;
  is_within_tolerance: boolean;
  counts: DistributionCount[];
  breaches: string[];
  notes: string[];
}

export interface CalibrationRow {
  appraisal_id: string;
  employee_id: string;
  employee_code: string;
  name: string;
  grade: string | null;
  department: string | null;
  manager_id: string | null;
  manager_name: string | null;
  tenure_months: number | null;
  current_rating: string | null;
  current_score: string | null;
  goal_score: string | null;
  goal_measured_weight_percent: string | null;
  recognition_count: number;
  status: AppraisalStatus;
  is_self: boolean;
  peer_count: number;
  peer_median_score: string | null;
}

export interface CalibrationWorkspace {
  session: {
    id: string;
    cycle_id: string;
    cycle_name: string;
    name: string;
    scope: CalibrationScope;
    scope_value: string;
    status: SessionStatus;
    locked_at: string | null;
  };
  viewer: { is_hr: boolean; is_facilitator: boolean; can_change: boolean; can_lock: boolean; can_reopen: boolean };
  rating_options: string[];
  grid: CalibrationRow[];
  distribution: DistributionScope;
  outliers: {
    manager_id: string;
    manager_name: string;
    population: number;
    mean_score: string;
    deviation: string;
    classification: "lenient" | "severe" | "typical" | "not_assessed";
    reason: string;
  }[];
  mode: string;
  min_group_size: number | null;
}

export interface CalibrationChange {
  id: string;
  appraisal_id: string;
  employee_id: string;
  previous_rating: string | null;
  new_rating: string;
  previous_score: string | null;
  new_score: string | null;
  changed_by_user_id: string | null;
  changed_at: string;
  justification: string;
  applied_on_lock: boolean;
}

export interface PersonEvidence {
  appraisal_id: string;
  employee_name: string;
  goals: GoalScoreBreakdown;
  recognition: { values: ReviewValue[]; by_competency: (Evidence & { competency_id: string })[] };
  entries: { stage_label: string | null; stage_role: StageRole | null; score: string | null; comments: string | null; returned_reason: string | null }[];
  calibration_history: { from: string | null; to: string; changed_at: string; justification: string }[];
}

// ── Goals ────────────────────────────────────────────────────────────────────

export type GoalLevel = "individual" | "team" | "company";
export type GoalStatus = "draft" | "active" | "completed" | "cancelled";
export type GoalVisibility = "self" | "manager_line" | "company";
export type KeyResultKind = "number" | "percent" | "currency" | "milestone";
export type CheckInConfidence = "on_track" | "at_risk" | "off_track";

export interface KeyResult {
  id: string;
  title: string;
  kind: KeyResultKind;
  unit: string | null;
  start_value: string;
  target_value: string;
  current_value: string;
  weight: string;
  progress: string;
}

export interface Goal {
  id: string;
  owner_employee_id: string | null;
  owner_name: string | null;
  level: GoalLevel;
  title: string;
  description: string | null;
  weight: string;
  start_date: string | null;
  due_date: string;
  status: GoalStatus;
  visibility: GoalVisibility;
  parent_goal_id: string | null;
  parent_title: string | null;
  appraisal_cycle_id: string | null;
  progress_percent: string;
  key_results: KeyResult[];
  created_at: string;
  updated_at: string;
  can_edit: boolean;
}

export interface KeyResultInput {
  title: string;
  kind: KeyResultKind;
  unit?: string | null;
  start_value: string;
  target_value: string;
  weight: string;
}

export interface GoalCheckIn {
  id: string;
  key_result_id: string | null;
  key_result_title: string | null;
  previous_value: string | null;
  new_value: string | null;
  progress_after: string;
  confidence: CheckInConfidence | null;
  note: string | null;
  recorded_by_name: string | null;
  recorded_at: string;
}

// ── PIPs ─────────────────────────────────────────────────────────────────────

export type PipStatus = "draft" | "active" | "extended" | "successful" | "unsuccessful" | "abandoned";
export type EmployeeInputState = "given" | "declined" | "not_asked";
export type MilestoneStatus = "pending" | "met" | "not_met" | "waived";

export interface PipSummary {
  pip_id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  status: PipStatus;
  start_date: string;
  end_date: string;
  reason: string;
  check_ins: number;
  milestones: number;
  milestones_assessed: number;
  is_mine: boolean;
}

export interface PipTrail {
  is_defensible: boolean;
  check_ins_held: number;
  check_ins_evidenced: number;
  employee_voice_count: number;
  gaps: string[];
  summary: string;
}

export interface PipDetail {
  pip: {
    id: string;
    employee_id: string;
    employee_name: string | null;
    initiated_by_name: string | null;
    appraisal_id: string | null;
    start_date: string;
    end_date: string;
    reason: string;
    expectations: string;
    support_provided: string;
    status: PipStatus;
    outcome_reason: string | null;
    outcome_recorded_on: string | null;
    extensions: { from: string; to: string; reason: string; at: string }[];
    weak_trail_acknowledged: boolean;
  };
  milestones: {
    id: string;
    description: string;
    target_date: string;
    measurable_criteria: string;
    status: MilestoneStatus;
    assessed_on: string | null;
    assessment_note: string | null;
  }[];
  check_ins: {
    id: string;
    milestone_id: string | null;
    scheduled_for: string;
    held_on: string | null;
    manager_comments: string | null;
    employee_comments: string | null;
    employee_input_state: EmployeeInputState;
    decline_reason: string | null;
    recorded_by_name: string | null;
  }[];
  statements: { id: string; check_in_id: string | null; statement: string; recorded_at: string }[];
  trail: PipTrail;
  viewer: {
    is_subject: boolean;
    can_record_check_in: boolean;
    can_assess_milestones: boolean;
    can_add_statement: boolean;
    can_close: boolean;
    can_see_evidence_pack: boolean;
  };
}

export interface PipCloseResult {
  outcome: string;
  new_status: PipStatus;
  routes_to_exit: boolean;
  new_end_date: string | null;
  trail: PipTrail;
  message: string;
}

// ── Increments ───────────────────────────────────────────────────────────────

export type IncrementCycleStatus = "draft" | "open" | "approvals" | "approved" | "released" | "cancelled";
export type RecommendationStatus = "draft" | "submitted" | "escalated" | "approved" | "rejected";

export interface IncrementCycleSummary {
  id: string;
  name: string;
  effective_from: string;
  status: IncrementCycleStatus;
  overage_mode: "block" | "escalate";
  letter_release_on: string | null;
  letters_released_at: string | null;
  linked_appraisal_cycle_id: string | null;
}

export interface BudgetState {
  scope: string;
  scope_key: string;
  allocated: string;
  consumed: string;
  remaining: string;
  utilisation: string | null;
  over_budget: boolean;
  mode: string;
  message: string;
}

export interface Headroom {
  department: BudgetState;
  company: BudgetState;
  binding_scope: string;
  spendable: string;
  note: string;
}

export interface IncrementCycleDetail {
  cycle: IncrementCycleSummary & {
    linked_appraisal_cycle_name: string | null;
    budget_by_department: Record<string, string> | null;
  };
  bands: { rating_label: string; min_percentage: string; max_percentage: string; recommended_percentage: string }[];
  company_budget: BudgetState;
  recommendations_by_status: Record<string, number>;
  viewer: { is_hr: boolean; can_release: boolean };
}

export interface EquitySnapshot {
  comparison_group_size?: number;
  compa_ratio?: { compa_ratio: string; band_midpoint: string; reading: string };
  parity?: { peer_median: string; percentile: number; reading: string; peer_min?: string; peer_max?: string } | null;
  gender_gap?: {
    gap_percent: string;
    higher_group: string;
    lower_group: string;
    counts: Record<string, number>;
    reading: string;
  } | null;
  note?: string;
}

export interface IncrementCandidate {
  employee_id: string;
  name: string;
  employee_code: string;
  grade: string | null;
  designation: string | null;
  department_id: string | null;
  department: string | null;
  current_ctc: string | null;
  rating_label: string | null;
  band: { min: string; max: string; recommended: string } | null;
  recommendation: {
    id: string;
    status: RecommendationStatus;
    rating_label: string;
    percentage: string;
    recommended_ctc: string;
    increase_amount: string;
    within_band: boolean;
    justification: string | null;
    requires_escalation: boolean;
    overage_amount: string;
    promotion_to_grade: string | null;
    promotion_applied: boolean;
    equity: EquitySnapshot;
  } | null;
  is_self: boolean;
  can_recommend: boolean;
  can_decide: boolean;
  can_promote: boolean;
}

export interface IncrementCandidates {
  rows: IncrementCandidate[];
  departments: (Headroom & { department_id: string | null; department: string })[];
}

export interface RecommendationResult {
  recommendation_id: string;
  proposal: { percentage: string; recommended_ctc: string; within_band: boolean; message: string };
  budget: { permitted: boolean; requires_escalation: boolean; overage: string; message: string };
  equity: EquitySnapshot;
  status: RecommendationStatus;
}
