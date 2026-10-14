/**
 * Hiring types: requisitions, candidates, interviews, offers, referrals,
 * analytics, job boards, the careers site and the candidate's own pages.
 *
 * These mirror the payloads of `backend/app/api/v1/routers/{hiring,offers,
 * interviews,careers,recruiting}.py`. Money and scores arrive as decimal strings
 * and stay strings: an offer CTC never passes through a float on its way to the
 * screen.
 */

// ── Requisitions ───────────────────────────────────────────────────────────

export type RequisitionStatus =
  | "draft"
  | "pending_approval"
  | "open"
  | "rejected"
  | "on_hold"
  | "fulfilled"
  | "closed"
  | "cancelled";

export type EmploymentKind = "full_time" | "part_time" | "contract" | "intern";

export interface RequisitionSummary {
  id: string;
  code: string;
  title: string;
  department_id: string | null;
  location_id: string | null;
  hiring_manager_id: string | null;
  recruiter_id: string | null;
  openings: number;
  open_vacancies: number;
  employment_type: string;
  status: RequisitionStatus;
  target_close_date: string | null;
  created_at: string;
}

export interface BudgetFlag {
  kind: string;
  severity: "blocking_attention" | "informational" | string;
  message: string;
}

export interface ApprovalStep {
  sequence: number;
  role: string;
  label: string | null;
  reason: string | null;
  decision: "pending" | "approved" | "rejected" | "voided";
  decided_by: string | null;
  decided_at: string | null;
  note: string | null;
  flags_shown?: BudgetFlag[];
  voided_by_changes?: string[];
}

export interface RequisitionDetail extends RequisitionSummary {
  grade: string | null;
  experience_min_years: number | null;
  experience_max_years: number | null;
  budget_ctc_min: string | null;
  budget_ctc_max: string | null;
  justification: string | null;
  description: string | null;
  description_ai_assisted?: boolean;
  /** Each published wording: its version, date and whether it began as an AI draft. */
  jd_versions?: { version: number; published_at: string; ai_generated: boolean }[];
  skills: string[];
  replacement_for_employee_id: string | null;
  target_joining_date: string | null;
  raised_by_user_id: string | null;
  approved_at: string | null;
  filled_count: number;
  approved_headcount: number | null;
  hiring_manager_name: string | null;
  recruiter_name: string | null;
  department_name: string | null;
  location_name: string | null;
  approvals: ApprovalStep[];
  budget_flags: BudgetFlag[];
  can_edit: boolean;
  can_submit: boolean;
  can_decide: boolean;
  decide_blocked_reason: string | null;
  candidate_count: number;
}

export interface RequisitionInput {
  title: string;
  code?: string | null;
  department_id?: string | null;
  location_id?: string | null;
  hiring_manager_id?: string | null;
  recruiter_id?: string | null;
  replacement_for_employee_id?: string | null;
  openings: number;
  employment_type: EmploymentKind;
  grade?: string | null;
  experience_min_years?: number | null;
  experience_max_years?: number | null;
  budget_ctc_min?: string | null;
  budget_ctc_max?: string | null;
  justification?: string | null;
  description?: string | null;
  description_ai_assisted?: boolean;
  skills?: string[];
  target_joining_date?: string | null;
  target_close_date?: string | null;
}

export interface SubmitResult {
  requisition_id: string;
  status: RequisitionStatus;
  chain: { sequence: number; role: string; reason: string }[];
  flags: BudgetFlag[];
}

export interface PendingDecision {
  kind: "requisition" | "offer";
  id: string;
  code: string;
  title: string;
  step: number;
  step_role: string;
  step_reason: string | null;
  flags: BudgetFlag[];
  submitted_at: string | null;
}

// ── Candidates ─────────────────────────────────────────────────────────────

export type CandidateStage =
  | "applied"
  | "screening"
  | "ai_interview"
  | "human_interview"
  | "offer"
  | "hired"
  | "rejected"
  | "withdrawn";

export interface CandidateSummary {
  id: string;
  requisition_id: string;
  requisition_code: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  stage: CandidateStage;
  source: string | null;
  total_experience_years: string | null;
  notice_period_days: number | null;
  converted_employee_id: string | null;
  created_at: string;
  allowed_moves: CandidateStage[];
  possible_duplicate: boolean;
  tags: string[];
}

export interface CandidateInput {
  requisition_id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  current_company?: string | null;
  total_experience_years?: string | null;
  current_ctc?: string | null;
  expected_ctc?: string | null;
  notice_period_days?: number | null;
  source_note?: string | null;
}

export interface CandidateCreateResult {
  candidate_id: string;
  application_id: string;
  created: boolean;
  note: string;
  matched_on: string | null;
  possible_duplicates: { id: string; full_name: string; stage: CandidateStage }[];
}

export type CandidateMessageStatus = "queued" | "sent" | "failed" | "dead_letter" | "cancelled";

/** One email to a candidate. A private link in it shows as a placeholder, never itself. */
export interface CandidateMessage {
  id: string;
  event_key: string;
  to_address: string;
  subject: string;
  body: string;
  status: CandidateMessageStatus;
  attempt_count: number;
  /** When a queued message goes (a held rejection, a retry). */
  scheduled_for: string | null;
  sent_at: string | null;
  failure_reason: string | null;
  /** Who wrote it; null for one AskMira sent on a hiring event. */
  sent_by: string | null;
  created_at: string;
}

export interface StageMoveResult {
  candidate_id: string;
  from_stage: CandidateStage;
  to_stage: CandidateStage;
  allowed_moves: CandidateStage[];
}

export interface ProctoringStatement {
  status: "observations_recorded" | "no_observations";
  label: string;
  statements: string[];
  note: string;
  judgement_fields_not_shown: number;
}

/** One round's score — or, for an AI score with no signals or confidence, the reason it is withheld. */
export interface PresentedScore {
  id: string;
  round_type: string;
  round_number: number;
  is_ai_generated: boolean;
  summary: string | null;
  proctoring: ProctoringStatement;
  score: string | null;
  max_score: string | null;
  confidence: string | null;
  signals: { name: string; value: string }[];
  withheld: boolean;
  withheld_reason: string | null;
}

export interface FitScoreView {
  value: string | null;
  status: "not_computed" | "withheld" | "shown_with_components";
  components: {
    round_type: string;
    round_number: number;
    score: string | null;
    confidence: string | null;
  }[];
  confidence: string | null;
  note: string;
}

export type ConsentPurpose =
  | "application_processing"
  | "talent_pool_retention"
  | "marketing_contact";

export interface CandidateProfile {
  candidate: {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    current_company: string | null;
    total_experience_years: string | null;
    notice_period_days: number | null;
    current_ctc: string | null;
    expected_ctc: string | null;
    salary_hidden: boolean;
    stage: CandidateStage;
    source: string | null;
    tags: string[];
    converted_employee_id: string | null;
    created_at: string;
    has_resume: boolean;
    resume_text: string | null;
    resume_note: string | null;
    /** HR only: this person worked here before, and how they left. */
    former_employee?: {
      employee_id: string;
      employee_code: string;
      date_of_exit: string | null;
      exit_type: string | null;
      is_rehire_eligible: boolean | null;
      rehire_note: string | null;
    } | null;
  };
  requisition: { id: string; code: string; title: string; status: RequisitionStatus };
  allowed_moves: CandidateStage[];
  applications: {
    id: string;
    requisition_code: string | null;
    requisition_title: string | null;
    source: string;
    applied_at: string;
    status: ApplicationStatus;
    matched_on: string | null;
    match_reason: string | null;
    purged: boolean;
  }[];
  consent: {
    purposes: {
      purpose: ConsentPurpose;
      granted: boolean | null;
      recorded_at: string | null;
      notice_version: string | null;
      status: "not_recorded" | "granted" | "withdrawn";
    }[];
    note: string;
  };
  stage_history: {
    from_stage: CandidateStage | null;
    to_stage: CandidateStage;
    reason: string | null;
    by: string | null;
    occurred_at: string;
  }[];
  interviews: {
    id: string;
    stage_name: string | null;
    scheduled_start: string;
    scheduled_end: string;
    mode: InterviewMode;
    status: InterviewStatus;
    panel_size: number;
    feedback_submitted: number;
  }[];
  scores: PresentedScore[];
  fit_score: FitScoreView;
  duplicates: {
    count: number;
    records: { id: string; full_name: string; stage: CandidateStage }[];
    ambiguous_matches: { application_id: string; reason: string | null }[];
  };
  documents: {
    id: string;
    category: string;
    file_name: string;
    content_type: string | null;
    size_bytes: number | null;
    uploaded_at: string;
  }[];
  offers: {
    id: string;
    code: string;
    status: OfferStatus;
    designation: string;
    ctc_annual: string;
    joining_date: string;
  }[];
  referral: {
    referral_id: string;
    status: string;
    referrer: string | null;
    submitted_at: string;
  } | null;
  viewer_is_hr: boolean;
}

// ── Interviews ─────────────────────────────────────────────────────────────

export type InterviewStageType = "ai_screen" | "technical" | "managerial" | "hr" | "panel";
export type InterviewMode = "in_person" | "video" | "phone";
export type InterviewStatus =
  | "scheduled"
  | "rescheduled"
  | "completed"
  | "candidate_no_show"
  | "panel_no_show"
  | "cancelled";
export type PanelistRole = "interviewer" | "observer" | "chair";
export type PanelResponse = "needs_action" | "accepted" | "tentative" | "declined";
export type Recommendation = "strong_yes" | "yes" | "no" | "strong_no";

export interface InterviewStage {
  id: string;
  requisition_id: string;
  sequence: number;
  name: string;
  stage_type: InterviewStageType;
  duration_minutes: number;
  mode: InterviewMode;
  required_competencies: string[];
  is_eliminating: boolean;
  feedback_required: boolean;
  preparation_notes: string | null;
}

export interface StageInput {
  requisition_id: string;
  sequence: number;
  name: string;
  stage_type: InterviewStageType;
  duration_minutes: number;
  mode: InterviewMode;
  required_competencies: string[];
  is_eliminating: boolean;
  feedback_required: boolean;
  preparation_notes?: string | null;
}

export interface PanelMember {
  user_id: string;
  name: string;
  email?: string | null;
  role: PanelistRole;
  response: PanelResponse;
  feedback_submitted: boolean;
}

export interface InterviewListItem {
  id: string;
  candidate_id: string;
  candidate_name: string;
  requisition_id: string;
  requisition_code: string;
  requisition_title: string;
  stage_id: string;
  stage_name: string;
  scheduled_start: string;
  scheduled_end: string;
  candidate_timezone: string;
  mode: InterviewMode;
  location_or_link: string | null;
  status: InterviewStatus;
  reschedule_count: number;
  calendar_warnings: string[];
  panel: PanelMember[];
  my_role: PanelistRole | null;
  my_response: PanelResponse | null;
  my_feedback_submitted: boolean;
  can_manage: boolean;
  oversees: boolean;
}

export interface InterviewDetail {
  id: string;
  candidate_id: string;
  candidate_name: string;
  requisition_code: string | null;
  requisition_title: string | null;
  stage: {
    id: string;
    name: string;
    stage_type: InterviewStageType;
    duration_minutes: number;
    required_competencies: string[];
    feedback_required: boolean;
    preparation_notes: string | null;
  };
  scheduled_start: string;
  scheduled_end: string;
  candidate_timezone: string;
  mode: InterviewMode;
  location_or_link: string | null;
  status: InterviewStatus;
  reschedule_count: number;
  calendar_warnings: string[];
  panel: PanelMember[];
  my_role: PanelistRole | null;
  my_feedback_submitted: boolean;
  can_manage: boolean;
  oversees: boolean;
}

export interface PanelPerson {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
}

export interface ProposedSlot {
  start_utc: string;
  end_utc: string;
  start_local: string;
  local_label: string;
  timezone: string;
  duration_minutes: number;
  available_panelist_ids: string[];
  unverified_panelist_ids: string[];
  fully_verified: boolean;
}

export interface ProposeResult {
  stage_id: string;
  duration_minutes: number;
  timezone: string;
  slots: ProposedSlot[];
  caveats: string[];
  all_calendars_read: boolean;
}

export interface ScheduleInput {
  candidate_id: string;
  stage_id: string;
  start: string;
  candidate_timezone: string;
  panelist_user_ids: string[];
  observer_user_ids?: string[];
  chair_user_id?: string | null;
  mode?: InterviewMode | null;
  location?: string | null;
}

export interface FeedbackEntry {
  panelist: string;
  recommendation: Recommendation;
  ratings: Record<string, string>;
  strengths: string;
  concerns: string;
  submitted_at: string | null;
  is_mine: boolean;
}

export interface VisibleFeedback {
  interview_id: string;
  feedback: FeedbackEntry[];
  withheld_count: number;
  withheld_note: string;
  outstanding: string[];
  anchoring_protection: boolean;
}

export interface FeedbackInput {
  recommendation: Recommendation;
  ratings: Record<string, string>;
  strengths: string;
  concerns: string;
}

export interface ConsolidatedView {
  interview_id: string;
  stage: string;
  candidate: string;
  ai_rounds: PresentedScore[];
  fit_score: FitScoreView;
  total_required: number;
  submitted: number;
  counts: Partial<Record<Recommendation, number>>;
  unanimous: boolean;
  strong_dissent: boolean;
  headline: string;
  per_competency: Record<
    string,
    { scores: Record<string, string>; lowest: string; highest: string; spread: string; raters: number }
  >;
  outstanding: string[];
  complete: boolean;
}

export interface AdvanceCheck {
  can_advance: boolean;
  blockers: string[];
}

export interface CalendarStatus {
  providers: {
    provider: string;
    configured: boolean;
    connected: boolean;
    account_email: string | null;
    expires_at: string | null;
    token_expired: boolean;
    last_error: string | null;
    message: string;
  }[];
  note: string;
}

export interface SelfScheduleLinkResult {
  token: string;
  expires_at: string;
  slot_count: number;
  note: string;
}

// ── Offers ─────────────────────────────────────────────────────────────────

export type OfferStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "released"
  | "accepted"
  | "declined"
  | "revoked"
  | "lapsed"
  | "joined"
  | "dropped";

export type OfferComponentKind =
  | "joining_bonus"
  | "retention_bonus"
  | "variable_pay"
  | "esop"
  | "relocation";

export interface OfferSummary {
  id: string;
  code: string;
  candidate_id: string;
  candidate_name: string;
  requisition_id: string;
  requisition_code: string;
  designation: string;
  grade: string | null;
  ctc_annual: string;
  joining_date: string;
  status: OfferStatus;
  valid_until: string | null;
  released_at: string | null;
  responded_at: string | null;
  outcome_reason: string | null;
  resigned_elsewhere: boolean;
  converted_employee_id: string | null;
  created_at: string;
}

export interface BreakupLine {
  code: string;
  name: string;
  monthly: string;
  annual: string;
  part_of_ctc: boolean;
}

export interface BudgetDeviation {
  offered_ctc: string;
  band_min: string | null;
  band_max: string | null;
  amount_over: string;
  percent_over: string;
  is_over_band: boolean;
  is_under_band: boolean;
  headline: string;
  requires_prominent_flag: boolean;
}

export interface InternalParity {
  offered_ctc: string;
  comparable_count: number;
  minimum: string | null;
  median: string | null;
  maximum: string | null;
  above_every_comparable: boolean;
  percent_above_median: string | null;
  headline: string;
  is_indicative_only: boolean;
}

export interface MyAuthority {
  can_decide: boolean;
  step: number | null;
  step_role?: string;
  message: string | null;
}

export interface OfferApprovalView {
  offer: {
    id: string;
    code: string;
    status: OfferStatus;
    ctc_annual: string;
    grade: string | null;
    designation: string;
    joining_date: string;
  };
  candidate: {
    id: string | null;
    name: string | null;
    current_ctc: string | null;
    notice_period_days: number | null;
  };
  requisition: {
    id: string;
    code: string;
    budget_ctc_min: string | null;
    budget_ctc_max: string | null;
    open_vacancies: number;
  };
  budget_deviation: BudgetDeviation;
  internal_parity: InternalParity;
  salary_breakup: BreakupLine[];
  approvals: {
    sequence: number;
    role: string;
    decision: ApprovalStep["decision"];
    reason: string | null;
    voided_by_changes: string[];
  }[];
  my_authority: MyAuthority;
}

export interface OfferEventRow {
  from_status: OfferStatus | null;
  to_status: OfferStatus;
  reason: string | null;
  by: string | null;
  occurred_at: string;
  facts: Record<string, unknown>;
}

export interface OfferDetail {
  offer: {
    id: string;
    code: string;
    status: OfferStatus;
    ctc_annual: string;
    currency: string;
    designation: string;
    grade: string | null;
    joining_date: string;
    joining_location_id: string | null;
    department_id: string | null;
    salary_structure_id: string;
    probation_months: number;
    notice_period_days: number;
    valid_until: string | null;
    released_at: string | null;
    responded_at: string | null;
    outcome_reason: string | null;
    resigned_elsewhere: boolean;
    letter_id: string | null;
    converted_employee_id: string | null;
    created_by: string | null;
  };
  candidate: { id: string; name: string | null; email: string | null; notice_period_days: number | null };
  requisition: {
    id: string;
    code: string;
    title: string;
    budget_ctc_min: string | null;
    budget_ctc_max: string | null;
    open_vacancies: number;
  };
  components: {
    kind: OfferComponentKind;
    label: string;
    amount: string;
    payable_terms: string | null;
    counts_toward_ctc: boolean;
  }[];
  salary_breakup: BreakupLine[];
  approvals: ApprovalStep[];
  history: OfferEventRow[];
  actions: {
    can_edit_terms: boolean;
    can_submit: boolean;
    can_release: boolean;
    can_record_response: boolean;
    can_record_drop: boolean;
    can_convert: boolean;
    can_revoke: boolean;
  };
  my_authority: MyAuthority;
}

export interface OfferInput {
  candidate_id: string;
  code: string;
  salary_structure_id: string;
  ctc_annual: string;
  joining_date: string;
  designation: string;
  grade?: string | null;
  joining_location_id?: string | null;
  department_id?: string | null;
  legal_entity_id?: string | null;
  probation_months: number;
  notice_period_days: number;
  valid_until?: string | null;
  components: {
    kind: OfferComponentKind;
    label: string;
    amount: string;
    payable_terms?: string | null;
    counts_toward_ctc: boolean;
  }[];
}

export interface TermsUpdateResult {
  offer_id: string;
  status: OfferStatus;
  material_changes: string[];
  approvals_voided: number;
}

// ── Referrals ──────────────────────────────────────────────────────────────

export type ShareChannel = "whatsapp" | "linkedin" | "email" | "copy";

export interface OpenRole {
  id: string;
  code: string;
  title: string;
  department: string | null;
  location: string | null;
  employment_type: string;
  experience_min_years: number | null;
  experience_max_years: number | null;
  open_vacancies: number;
  posted_on: string;
}

export interface ReferralProgramme {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  eligible_roles: string[];
  bonus_by_grade: Record<string, string>;
  milestones: {
    key: string;
    label: string;
    share_percent: string;
    days_after_joining: number;
  }[];
  rules: {
    duplicate_rule: string;
    require_confirmed: boolean;
    exclude_on_pip: boolean;
    exclude_hiring_team: boolean;
  };
  tax_note: string;
  payroll_note: string;
}

export interface ReferralPayout {
  id: string;
  milestone: string;
  amount: string;
  payable_on: string;
  status: "scheduled" | "paid" | "forfeited";
  paid_at: string | null;
  payroll_reference: string | null;
}

export type ReferralStatus =
  | "submitted"
  | "duplicate"
  | "in_process"
  | "hired"
  | "not_selected"
  | "ineligible";

export interface MyReferral {
  id: string;
  candidate: string;
  requisition_code: string | null;
  requisition_title: string | null;
  status: ReferralStatus;
  submitted_at: string;
  duplicate_note: string | null;
  ineligibility_reason: string | null;
  bonus_amount: string | null;
  hired_on: string | null;
  payouts: ReferralPayout[];
}

export interface ReferralRow {
  id: string;
  programme_id: string;
  referrer: string | null;
  referrer_grade: string | null;
  candidate: string;
  candidate_id: string | null;
  requisition_code: string | null;
  status: ReferralStatus;
  submitted_at: string;
  duplicate_of_id: string | null;
  bonus_amount: string | null;
  hired_on: string | null;
  payouts: ReferralPayout[];
}

export interface ShareLinkResult {
  link: { url: string; channel: ShareChannel; [key: string]: unknown };
  terms: {
    duplicate_rule: string;
    bonus_by_grade: Record<string, string>;
    milestones: ReferralProgramme["milestones"];
    tax_note: string;
  };
}

export interface ReferResult {
  referral_id: string;
  status: ReferralStatus;
  duplicate: { is_duplicate: boolean; [key: string]: unknown };
  eligibility: { eligible: boolean; message?: string; [key: string]: unknown };
  candidate_added: boolean;
  role: { code: string; title: string };
}

// ── Analytics ──────────────────────────────────────────────────────────────

export interface FunnelStageRow {
  stage: string;
  count: number;
  dropped_from_previous: number | null;
  drop_off_rate: number | null;
}

export interface OutcomeRates {
  offers: number;
  accepted: number;
  declined_or_lapsed: number;
  joined: number;
  dropped: number;
  revoked: number;
  acceptance_rate: number | null;
  drop_rate: number | null;
}

export interface FunnelReport {
  funnel: {
    total_candidates: number;
    stages: FunnelStageRow[];
    largest_drop_off: { into_stage: string; rate: number; count: number } | null;
    note: string;
    grouped_by?: string;
    groups?: { key: string; total: number; stages: FunnelStageRow[] }[];
  };
  reconciliation: {
    computed: Record<string, number>;
    reconciles: boolean;
    monotonic_breaks: { stage: string; detail: string }[];
    total_breaks: { stage: string; computed: number | null; expected: number; detail: string }[];
    note: string;
  };
  stage_timings: {
    transitions: {
      from_stage: string;
      to_stage: string;
      sample: number;
      median_days: number | null;
      note: string;
    }[];
    median_time_to_hire_days: number | null;
    stalls_at: { reading: string; median_days: number; share_of_total: number | null } | null;
    note: string;
  };
  source_effectiveness: {
    sources: {
      source: string;
      applied: number;
      interviewed: number;
      offered: number;
      joined: number;
      interview_pass_rate: number | null;
      conversion_to_hire: number | null;
      spend: string | null;
      cost_per_hire: string | null;
      note: string;
    }[];
    note: string;
  };
  offer_outcomes: {
    overall: OutcomeRates;
    by_department: (OutcomeRates & { key: string })[];
    by_recruiter: (OutcomeRates & { key: string })[];
    by_notice_period: (OutcomeRates & { key: string })[];
    note: string;
  };
}

export interface InterviewerSignal {
  interviewer_id: string;
  name: string;
  severity: {
    interviews: number;
    mean_rating: number | null;
    peer_mean_rating: number | null;
    deviation: number | null;
    reading?: string;
    note?: string;
  };
  turnaround: {
    interviews: number;
    median_days: number | null;
    slowest_days?: number;
    reading?: string;
    note?: string;
  };
  feedback_quality: {
    interviews: number;
    median_comment_length: number | null;
    competency_coverage: number | null;
    incoherent_count: number | null;
    reading?: string;
    proxy_caveat?: string;
    note?: string;
  };
}

export interface InterviewerReport {
  framing: string;
  minimum_interviews: number;
  feedback_count: number;
  interviewers: InterviewerSignal[];
}

export interface DiversityReport {
  dimension: string;
  focus_value: string;
  coverage: {
    candidates: number;
    disclosed: number;
    coverage_rate: number | null;
    note: string;
  };
  stages: {
    stage: string;
    disclosed_at_stage: number;
    share: number | null;
    suppressed: boolean;
    note: string;
  }[];
  largest_fall: { reading: string } | null;
  note: string;
}

export type CostComponent = "job_board_spend" | "agency_fees" | "referral_bonuses" | "recruiter_time";

export interface CostPerHireReport {
  period: string;
  hires: number;
  total_cost: string;
  cost_per_hire: string | null;
  components: Record<string, string>;
  missing_components: string[];
  is_complete: boolean;
  note: string;
  hires_counted_from?: string;
  cost_lines?: {
    id: string;
    component: CostComponent;
    source: string;
    amount: string;
    note: string | null;
  }[];
}

// ── Job boards ─────────────────────────────────────────────────────────────

export type PostingStatus = "draft" | "publishing" | "live" | "parked" | "expired" | "closed";

export interface BoardStatus {
  board: string;
  account_configured: boolean;
  account: {
    id: string;
    display_name: string | null;
    username: string | null;
    has_credentials: boolean;
    is_active: boolean;
    settings: Record<string, unknown>;
    last_polled_at: string | null;
    last_error: string | null;
  } | null;
  live_connection_verified: boolean;
  message: string;
}

export interface Posting {
  id: string;
  requisition_id: string;
  requisition_code: string;
  requisition_title: string;
  board: string;
  external_job_id: string | null;
  status: PostingStatus;
  published_at: string | null;
  expires_at: string | null;
  next_refresh_at: string | null;
  next_attempt_at: string | null;
  attempt_count: number;
  last_error: string | null;
  warnings: string[];
  view_count: number;
  application_count: number;
}

export interface PostingAttention {
  parked: {
    posting_id: string;
    board: string;
    requisition_id: string;
    reason: string | null;
    attempts: number;
  }[];
  retry_due: string[];
  refresh_due: string[];
}

// ── Careers site ───────────────────────────────────────────────────────────

export interface CareersConfig {
  exists: boolean;
  slug: string | null;
  is_published: boolean | null;
  hero_heading: string | null;
  hero_subheading: string | null;
  about_html: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
  primary_colour: string | null;
  accent_colour: string | null;
  culture_enabled: boolean | null;
  allow_apply_without_account: boolean | null;
  privacy_notice_html: string | null;
  privacy_notice_version: string | null;
  resume_retention_days: number | null;
  seo_title: string | null;
  seo_description: string | null;
}

// ── Public pages ───────────────────────────────────────────────────────────

export type ApplicationStatus =
  | "applied"
  | "under_review"
  | "shortlisted"
  | "interviewing"
  | "offered"
  | "closed";

export interface PublicJobListItem {
  code: string;
  title: string;
  department_id: string | null;
  location_id: string | null;
  department: string | null;
  location: string | null;
  employment_type: string;
  experience_min_years: number | null;
  experience_max_years: number | null;
  openings: number;
  posted_on: string;
}

export interface PublicCareersPage {
  branding: {
    organisation: string;
    logo_url: string | null;
    hero_image_url: string | null;
    hero_heading: string | null;
    hero_subheading: string | null;
    about_paragraphs: string[];
    primary_colour: string | null;
    accent_colour: string | null;
    seo_title: string | null;
    seo_description: string | null;
  };
  allow_apply_without_account: boolean;
  privacy_notice_paragraphs: string[];
  privacy_notice_version: string;
  retention_days: number;
  jobs: PublicJobListItem[];
  culture: {
    shoutouts: { message: string; value: string | null; given_on: string }[];
    clubs: { name: string; description: string | null; icon: string | null }[];
  };
  filters: {
    departments: { id: string; name: string }[];
    locations: { id: string; name: string }[];
  };
}

export interface PublicJobDetail {
  job: {
    code: string;
    title: string;
    description_paragraphs: string[];
    skills: string[];
    employment_type: string;
    experience_min_years: number | null;
    experience_max_years: number | null;
    openings: number;
    location: string | null;
    posted_on: string;
  };
  structured_data: Record<string, unknown>;
  seo_problems: string[];
  privacy_notice_paragraphs: string[];
  privacy_notice_version: string;
  retention_days: number;
  allow_apply_without_account: boolean;
  organisation: string;
  document_rules: { resume_types: string[]; resume_max_mb: number };
}

export interface ApplyResult {
  applied: boolean;
  portal_token: string;
  portal_expires_at: string;
  retention_days: number;
  resume_stored: boolean;
  message: string;
}

export interface CandidatePortal {
  candidate: { name: string; email: string };
  organisation: string;
  applications: {
    role: string;
    applied_on: string;
    status: ApplicationStatus;
    status_note: string;
  }[];
  interviews: {
    id: string;
    stage_name: string;
    duration_minutes: number;
    start_utc: string;
    start_local: string;
    timezone: string;
    mode: InterviewMode;
    location_or_link: string | null;
    preparation_notes: string | null;
    can_request_reschedule: boolean;
  }[];
  documents: { category: string; file_name: string; uploaded_on: string }[];
  document_rules: { categories: string[]; accepted_types: string[]; max_mb: number };
  retention_note: string;
}

export interface SelfScheduleView {
  organisation: string;
  stage_name: string;
  duration_minutes: number | null;
  mode: InterviewMode | null;
  preparation_notes: string | null;
  timezone: string;
  expires_at: string;
  expired: boolean;
  booked: {
    start_utc: string;
    start_local: string;
    timezone: string;
    mode: InterviewMode;
    join_url: string | null;
    status: InterviewStatus;
  } | null;
  slots: { start: string; start_local: string; end_local: string | null; in_past: boolean }[];
}

export interface BookingResult {
  interview_id: string;
  start_utc: string;
  start_local: string;
  timezone: string;
  join_url: string | null;
}

export interface TagCount {
  tag: string;
  candidates: number;
}

export interface TalentPool {
  id: string;
  name: string;
  description: string | null;
  members: number;
  created_at: string;
}

export interface TalentPoolMember {
  candidate_id: string;
  full_name: string;
  email: string;
  stage: CandidateStage;
  tags: string[];
  last_requisition: string;
  total_experience_years: string | null;
  note: string | null;
  added_at: string;
  /** Their talent-pool consent as it stands now; withdrawn means do not contact. */
  consent: "granted" | "withdrawn";
}

export interface TalentPoolDetail {
  pool: TalentPool;
  members: TalentPoolMember[];
}

export interface PoolAddResult {
  added: string[];
  refused: Array<{ candidate_id: string; reason: string }>;
}
