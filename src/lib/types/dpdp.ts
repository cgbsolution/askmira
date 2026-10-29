/**
 * The Digital Personal Data Protection Act surfaces, as the API exposes them.
 *
 * Mirrors `app/api/v1/routers/dpdp.py` and `app/services/dpdp/`.
 */

export type ConsentStatus = "granted" | "declined" | "not_asked" | "stale" | "not_applicable";
export type RequestType = "access" | "correction" | "erasure" | "grievance" | "nomination";
export type RequestStatus =
  | "received"
  | "verifying_identity"
  | "in_progress"
  | "completed"
  | "partially_completed"
  | "rejected"
  | "escalated";

export interface PurposeState {
  purpose: string;
  name: string;
  status: ConsentStatus;
  lawful_basis: string;
  lawful_basis_label: string;
  can_withdraw: boolean;
  is_permitted: boolean;
  decided_at: string | null;
  /** Consent given to an older version of the purpose is stale, not current. */
  agreed_version: number | null;
  current_version: number;
  stops_if_withdrawn: string[];
  description: string;
  /** What withdrawing deletes, in plain words (DPDP s.8(7)(a)). */
  withdrawal_erases: string[];
  /** What withdrawing does not delete, and why. */
  withdrawal_keeps: string[];
}

export interface ConsentView {
  principal_id: string;
  purposes: PurposeState[];
  capabilities_permitted: string[];
  retired_purposes_on_record: string[];
}

export interface WithdrawalEffect {
  purpose: string;
  name: string;
  stops: string[];
  /** What is kept, and why. */
  retained: string[];
  /** What the withdrawal deleted. */
  erased: string[];
  erased_counts?: Record<string, number>;
  summary: string;
}

export interface NoticeItem {
  purpose: string;
  heading: string;
  body: string;
  lawful_basis: string;
  basis_explanation: string;
  data_used: string[];
  offers_a_choice: boolean;
  stops_if_declined: string[];
  sub_processors: string[];
  body_untranslated: boolean;
}

export interface Notice {
  notice_id: string;
  version: number;
  language: string;
  language_name: string;
  is_fallback: boolean;
  fallback_line: string | null;
  title: string;
  intro: string;
  untranslated_items: number;
  choices: NoticeItem[];
  disclosures: NoticeItem[];
  rights_line: string;
  /** Null until an admin names one; the notice then says so instead of inventing an address. */
  grievance_contact: string | null;
  data_protection_officer_name: string | null;
  grievance_contact_missing: boolean;
}

/** What each consent switch stops, in words a person reads before deciding. */
export const CAPABILITY_LABEL: Record<string, string> = {
  culture_survey_invitations: "culture survey invitations",
  culture_sentiment_analysis: "AI reading your survey comments for themes",
  ai_companion_queries: "Ask Mira answering questions about you",
  ai_context_retrieval: "AI tools reading your record",
  photo_in_directory: "your photo shown to colleagues",
  birthday_announcements: "birthday announcements",
  work_anniversary_announcements: "work-anniversary announcements",
  talent_pool_retention: "keeping your application for other roles",
  talent_pool_outreach: "being contacted about other roles",
  background_check_initiation: "starting a background check",
  reference_contact: "contacting your references",
  ai_resume_screening: "AI reading your résumé",
};

export function capabilityLabel(key: string): string {
  return CAPABILITY_LABEL[key] ?? key.replaceAll("_", " ");
}

export interface MyRequest {
  id: string;
  type: RequestType;
  status: RequestStatus;
  details: string | null;
  received_at: string;
  due_by: string;
  responded_at: string | null;
  rejection_reason: string | null;
  response: Record<string, unknown>;
}

export interface ErasureDecision {
  category: string;
  category_name: string;
  outcome: string;
  explanation: string;
  retained_until: string | null;
  statutory_reference: string | null;
}

export interface ErasurePlan {
  requested_on: string;
  is_complete: boolean;
  purged_count: number;
  retained_count: number;
  review_again_on: string | null;
  summary: string;
  decisions: ErasureDecision[];
}

export interface AccessSection {
  category: string;
  name: string;
  what_this_is: string;
  why_we_hold_it: string;
  how_long: string;
  held_in: string[];
  field_count: number;
}

export interface AccessContents {
  table: string;
  label: string;
  categories: { key: string; name: string }[];
  row_count: number;
  truncated: boolean;
  /** Columns not shown — secrets and hashes, never "things we would rather you did not see". */
  withheld_columns: string[];
  rows: Record<string, unknown>[];
}

export interface AccessExport {
  principal_id: string;
  generated_at: string;
  sections: AccessSection[];
  consent: ConsentView;
  contents: AccessContents[];
  completeness: {
    categories_covered: number;
    modules_covered: number;
    contents_included: boolean;
    tables_with_your_rows: number;
    rows_exported: number;
    truncated_tables: string[];
    withheld: string;
    note: string;
  };
}

/** English plus the Eighth Schedule languages the notice can be asked for in. */
export const NOTICE_LANGUAGES: { code: string; name: string }[] = [
  { code: "en", name: "English" },
  { code: "hi", name: "Hindi" },
  { code: "bn", name: "Bengali" },
  { code: "mr", name: "Marathi" },
  { code: "te", name: "Telugu" },
  { code: "ta", name: "Tamil" },
  { code: "gu", name: "Gujarati" },
  { code: "ur", name: "Urdu" },
  { code: "kn", name: "Kannada" },
  { code: "or", name: "Odia" },
  { code: "ml", name: "Malayalam" },
  { code: "pa", name: "Punjabi" },
  { code: "as", name: "Assamese" },
  { code: "mai", name: "Maithili" },
  { code: "sat", name: "Santali" },
  { code: "ks", name: "Kashmiri" },
  { code: "ne", name: "Nepali" },
  { code: "sd", name: "Sindhi" },
  { code: "kok", name: "Konkani" },
  { code: "doi", name: "Dogri" },
  { code: "mni", name: "Manipuri" },
  { code: "brx", name: "Bodo" },
  { code: "sa", name: "Sanskrit" },
];

export const REQUEST_TYPE_LABEL: Record<RequestType, string> = {
  access: "See everything held about me",
  correction: "Correct something",
  erasure: "Erase my data",
  grievance: "Raise a grievance",
  nomination: "Nominate someone to act for me",
};

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  received: "Received",
  verifying_identity: "Checking identity",
  in_progress: "In progress",
  completed: "Completed",
  partially_completed: "Partly completed",
  rejected: "Declined",
  escalated: "Escalated",
};
