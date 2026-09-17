/** Culture API types. Mirror `backend/app/schemas/culture.py`. */

export type ShoutoutVisibility = "company" | "department" | "private";

export const ALLOWED_REACTIONS = ["👏", "❤️", "🎉", "🙌", "🚀", "😄"] as const;

export interface PersonRef {
  employee_id: string;
  name: string;
  photo_url: string | null;
  designation: string | null;
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  reacted: boolean;
}

export interface AwardPostRef {
  result_id: string;
  programme_name: string;
  category_key: string;
  category_name: string | null;
}

export interface Shoutout {
  id: string;
  kind: "peer" | "award";
  from_employee_id: string | null;
  to_employee_id: string;
  sender: PersonRef | null;
  recipient: PersonRef;
  message: string;
  value_tag: string | null;
  value_name: string | null;
  visibility: ShoutoutVisibility;
  is_pinned: boolean;
  points_awarded: number;
  created_at: string;
  reactions: ReactionSummary[];
  award: AwardPostRef | null;
  can_delete: boolean;
  can_pin: boolean;
}

export interface ShoutoutInput {
  to_employee_id: string;
  message: string;
  value_tag: string | null;
  visibility: ShoutoutVisibility;
}

export interface CompanyValue {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string | null;
  colour: string | null;
  display_order: number;
  is_active: boolean;
}

export interface CompanyValueInput {
  code: string;
  name: string;
  description: string;
  icon?: string | null;
  display_order?: number;
  is_active: boolean;
}

export interface Club {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  is_private: boolean;
  member_count: number;
  is_member: boolean;
  my_role: string | null;
  created_at: string;
}

export interface ClubMember {
  employee_id: string;
  name: string;
  photo_url: string | null;
  designation: string | null;
  role: string;
  joined_at: string;
}

export interface ClubParticipation {
  active_clubs: number;
  public_clubs: number;
  private_clubs: number;
  total_memberships: number;
  distinct_members: number;
  active_headcount: number;
  participation_rate: number | null;
  note: string;
}

export interface CalendarEvent {
  kind: "birthday" | "work_anniversary" | "holiday" | "company_event";
  on_date: string;
  label: string;
  employee_id: string | null;
  years: number | null;
  scope: string;
  photo_url: string | null;
}

export interface CalendarResponse {
  from: string;
  to: string;
  events: CalendarEvent[];
  note: string;
}

export interface EventPrivacy {
  share_birthday: boolean;
  share_work_anniversary: boolean;
  birthday_scope: "team" | "company";
  configured: boolean;
}

// ── Awards ─────────────────────────────────────────────────────────────────

export type AwardCadence = "monthly" | "quarterly" | "half_yearly" | "annual";
export type AwardCycleStatus =
  | "draft"
  | "nominations_open"
  | "jury_scoring"
  | "decided"
  | "announced"
  | "cancelled";
export type NominationStatus = "submitted" | "withdrawn" | "shortlisted" | "won" | "not_selected";

export interface AwardCategory {
  key: string;
  name: string;
  description?: string | null;
}

export interface AwardCriterion {
  key: string;
  name: string;
  weight?: number;
}

export interface AwardProgramme {
  id: string;
  name: string;
  description: string | null;
  cadence: AwardCadence;
  categories: AwardCategory[];
  criteria: AwardCriterion[];
  eligibility_rule: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AwardCycle {
  id: string;
  programme_id: string;
  programme_name: string;
  label: string;
  nominations_open_on: string;
  nominations_close_on: string;
  result_announcement_date: string | null;
  status: AwardCycleStatus;
  window_state: "not_open" | "open" | "closed";
  categories: AwardCategory[];
  criteria: AwardCriterion[];
  is_juror: boolean;
  juror_count: number;
  nomination_count: number;
}

export interface Nomination {
  id: string;
  cycle_id: string;
  category_key: string;
  category_name: string | null;
  nominee: PersonRef;
  nominator: PersonRef | null;
  citation: string;
  supporting_evidence: { kind: string; label: string; id?: string | null }[];
  status: NominationStatus;
  submitted_at: string;
  my_score: "none" | "draft" | "submitted" | null;
}

export interface JuryScoreRow {
  juror_id: string;
  juror_name: string | null;
  scores: Record<string, number>;
  comments: string;
  mean: number;
  is_submitted: boolean;
}

export interface JuryView {
  nomination_id: string;
  citation: string;
  you_have_submitted: boolean;
  your_draft: { scores: Record<string, number>; comments: string } | null;
  scores: JuryScoreRow[];
  note: string;
}

export interface RankedNomination {
  nomination_id: string;
  nominee_id: string;
  category_key: string;
  juror_count: number;
  mean_score: number;
  per_criterion: Record<string, number>;
  spread: number;
  note: string;
}

export interface Standings {
  cycle_id: string;
  label: string;
  programme_name: string;
  status: AwardCycleStatus;
  minimum_jurors: number;
  categories: {
    category_key: string;
    category_name: string | null;
    ranked: RankedNomination[];
    leading: string[];
    tied: boolean;
    awaiting_jury: string[];
    note: string;
  }[];
  nominations: Record<
    string,
    {
      nominee: PersonRef;
      category_key: string;
      citation: string;
      status: NominationStatus;
      won: boolean;
      outstanding_jurors: string[];
    }
  >;
  jurors: { user_id: string; name: string | null }[];
  note: string;
}

export interface AwardResult {
  id: string;
  cycle_id: string;
  programme_name: string;
  category_key: string;
  category_name: string | null;
  employee: PersonRef;
  citation: string;
  awarded_on: string;
  announced_at: string | null;
  shoutout_id: string | null;
}

// ── Surveys ────────────────────────────────────────────────────────────────

export type SurveyKind = "pulse" | "enps" | "engagement" | "wellbeing" | "inclusion" | "custom";
export type SurveyStatus = "draft" | "open" | "closed";

export interface InstrumentItem {
  key: string;
  text: string;
  reverse_scored: boolean;
  theme: string;
}

export interface Instrument {
  key: string;
  name: string;
  scale: string;
  bounds: [number, number];
  source: string;
  rationale: string;
  items: InstrumentItem[];
}

export interface MySurvey {
  id: string;
  name: string;
  kind: SurveyKind;
  instrument: Instrument | null;
  opens_on: string;
  closes_on: string;
  status: SurveyStatus;
  is_open_now: boolean;
  has_responded: boolean;
  min_responses_to_report: number;
}

export interface SurveySummary {
  id: string;
  name: string;
  kind: SurveyKind;
  instrument_key: string | null;
  instrument_name: string | null;
  opens_on: string;
  closes_on: string;
  status: SurveyStatus;
  min_responses_to_report: number;
  resurvey_interval_days: number | null;
  previous_wave_id: string | null;
  invited: number;
  responded: number;
  created_at: string;
}

export interface EnpsResult {
  responses: number;
  promoters: number;
  passives: number;
  detractors: number;
  score: number | null;
  suppressed: boolean;
  question: string;
  note: string;
}

export interface SurveyGroupResult {
  key: string;
  responses: number;
  scores: Record<string, number>;
  visible: boolean;
  suppression: string;
  note: string;
}

export interface SurveyResults {
  survey_id: string;
  instrument: string;
  responses: number;
  min_responses_to_report: number;
  overall: Record<string, number> | EnpsResult;
  groups?: SurveyGroupResult[];
  movement?: {
    deltas: Record<string, number>;
    comparable: boolean;
    note: string;
    previous_wave_name: string;
  } | null;
  previous_wave?: { survey_id: string; name: string; overall: EnpsResult } | null;
  note?: string;
}

export interface ActionPlanItem {
  id: string;
  description: string;
  owner: PersonRef;
  due_date: string;
  done_on: string | null;
  dropped_reason: string | null;
}

export type PlanStatus = "draft" | "committed" | "in_progress" | "completed" | "dropped";

export interface ActionPlan {
  id: string;
  survey_id: string;
  survey_name: string | null;
  scope: "company" | "department" | "team";
  scope_key: string;
  theme: string;
  owner: PersonRef;
  due_date: string;
  status: PlanStatus;
  completed_on: string | null;
  progress_notes: { at: string; by: string; note: string }[];
  items: ActionPlanItem[];
  can_edit: boolean;
}

export interface LoopReport {
  themes: {
    theme: string;
    acted: boolean;
    movement: number | null;
    reading: string;
    [key: string]: unknown;
  }[];
  [key: string]: unknown;
}

// ── Announcements ──────────────────────────────────────────────────────────

export interface Announcement {
  id: string;
  title: string;
  body: string;
  publish_at: string;
  expires_at: string | null;
  requires_acknowledgement: boolean;
  acknowledged: boolean;
  acknowledged_at: string | null;
}

export interface ManagedAnnouncement {
  id: string;
  title: string;
  body: string;
  publish_at: string;
  expires_at: string | null;
  requires_acknowledgement: boolean;
  channels: string[];
  audience: { department_ids?: string[]; location_ids?: string[]; grades?: string[] };
  audience_description: string;
  delivered_at: string | null;
  delivered_count: number;
  is_live: boolean;
  created_at: string;
}

export interface AcknowledgementRegister {
  announcement_id: string;
  content_hash: string;
  audience: string;
  expected: number;
  acknowledged: number;
  outstanding: string[];
  stale: string[];
  complete: boolean;
  note: string;
  people: Record<string, string>;
  acknowledged_people: {
    employee_id: string;
    name: string;
    acknowledged_at: string;
    channel: string | null;
  }[];
}

export interface ValueAnalytics {
  coverage: {
    values: {
      code: string;
      name: string;
      counts: Record<string, number>;
      share: Record<string, number | null>;
    }[];
    totals: Record<string, number>;
    note: string;
  };
  unlived: { code: string; name: string; [key: string]: unknown }[];
}
