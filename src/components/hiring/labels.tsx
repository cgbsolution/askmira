import React from "react";

import { Badge } from "@/components/ui/badge";
import type {
  ApplicationStatus,
  CandidateStage,
  InterviewMode,
  InterviewStatus,
  OfferStatus,
  PanelResponse,
  PostingStatus,
  Recommendation,
  ReferralStatus,
  RequisitionStatus,
} from "@/lib/types/hiring";

type Variant = "default" | "accent" | "secondary" | "outline" | "success" | "warning" | "destructive" | "muted";

/** Words for every hiring status, in one place, so two screens never disagree. */
export const REQUISITION_STATUS: Record<RequisitionStatus, [string, Variant]> = {
  draft: ["Draft", "muted"],
  pending_approval: ["Awaiting approval", "warning"],
  open: ["Open", "success"],
  rejected: ["Rejected", "destructive"],
  on_hold: ["On hold", "outline"],
  fulfilled: ["Filled", "secondary"],
  closed: ["Closed", "muted"],
  cancelled: ["Cancelled", "muted"],
};

export const CANDIDATE_STAGE: Record<CandidateStage, [string, Variant]> = {
  applied: ["Applied", "outline"],
  screening: ["Screening", "secondary"],
  ai_interview: ["AI interview", "secondary"],
  human_interview: ["Interviewing", "accent"],
  offer: ["Offer", "warning"],
  hired: ["Hired", "success"],
  rejected: ["Rejected", "destructive"],
  withdrawn: ["Withdrawn", "muted"],
};

export const PIPELINE_COLUMNS: CandidateStage[] = [
  "applied",
  "screening",
  "ai_interview",
  "human_interview",
  "offer",
  "hired",
  "rejected",
  "withdrawn",
];

export const INTERVIEW_STATUS: Record<InterviewStatus, [string, Variant]> = {
  scheduled: ["Scheduled", "secondary"],
  rescheduled: ["Rescheduled", "warning"],
  completed: ["Completed", "success"],
  candidate_no_show: ["Candidate did not attend", "destructive"],
  panel_no_show: ["Panel did not attend", "destructive"],
  cancelled: ["Cancelled", "muted"],
};

export const PANEL_RESPONSE: Record<PanelResponse, [string, Variant]> = {
  needs_action: ["No reply yet", "outline"],
  accepted: ["Accepted", "success"],
  tentative: ["Tentative", "warning"],
  declined: ["Declined", "destructive"],
};

export const INTERVIEW_MODE: Record<InterviewMode, string> = {
  in_person: "In person",
  video: "Video",
  phone: "Phone",
};

export const RECOMMENDATION: Record<Recommendation, [string, Variant]> = {
  strong_yes: ["Strong yes", "success"],
  yes: ["Yes", "secondary"],
  no: ["No", "warning"],
  strong_no: ["Strong no", "destructive"],
};

export const OFFER_STATUS: Record<OfferStatus, [string, Variant]> = {
  draft: ["Draft", "muted"],
  pending_approval: ["Awaiting approval", "warning"],
  approved: ["Approved", "secondary"],
  released: ["Released", "accent"],
  accepted: ["Accepted", "success"],
  declined: ["Declined", "destructive"],
  revoked: ["Revoked", "destructive"],
  lapsed: ["Lapsed", "muted"],
  joined: ["Joined", "success"],
  dropped: ["Did not join", "destructive"],
};

export const REFERRAL_STATUS: Record<ReferralStatus, [string, Variant]> = {
  submitted: ["Submitted", "secondary"],
  duplicate: ["Referred first by someone else", "muted"],
  in_process: ["In process", "accent"],
  hired: ["Hired", "success"],
  not_selected: ["Not selected", "muted"],
  ineligible: ["Not eligible", "destructive"],
};

export const POSTING_STATUS: Record<PostingStatus, [string, Variant]> = {
  draft: ["Draft", "muted"],
  publishing: ["Retrying", "warning"],
  live: ["Live", "success"],
  parked: ["Needs attention", "destructive"],
  expired: ["Expired", "muted"],
  closed: ["Closed", "muted"],
};

export const APPLICATION_STATUS: Record<ApplicationStatus, [string, Variant]> = {
  applied: ["Received", "outline"],
  under_review: ["Under review", "secondary"],
  shortlisted: ["Shortlisted", "accent"],
  interviewing: ["Interviewing", "accent"],
  offered: ["Offer made", "success"],
  closed: ["Closed", "muted"],
};

export const SOURCE_LABEL: Record<string, string> = {
  careers: "Careers page",
  referral: "Referral",
  manual: "Added by HR",
  naukri: "Naukri",
  linkedin: "LinkedIn",
  indeed: "Indeed",
};

export function humanize(value: string | null | undefined): string {
  if (!value) return "—";
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function StatusBadge<K extends string>({
  map,
  value,
  className,
}: {
  map: Record<K, [string, Variant]>;
  value: K;
  className?: string;
}) {
  const [label, variant] = map[value] ?? [humanize(value), "outline"];
  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  );
}

/** A date-time from the API in the viewer's own zone, or in a named one. */
export function formatDateTime(value: string | null | undefined, timeZone?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}

/** A wall-clock ISO string (no zone applied), as the backend renders local times. */
export function formatLocalWallClock(value: string | null | undefined): string {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return value;
  const [, y, mo, d, h, mi] = match;
  const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function percent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value * 1000) / 10}%`;
}

/** Only https or site-relative links are ever rendered from data. */
export function safeHref(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("https://") || (value.startsWith("/") && !value.startsWith("//"))) {
    return value;
  }
  return null;
}
