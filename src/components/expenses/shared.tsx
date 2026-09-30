import React from "react";

import { Badge } from "@/components/ui/badge";
import { formatMoney as sharedFormatMoney } from "@/lib/utils";
import type {
  AdvanceStatus,
  CityTier,
  ClaimKind,
  ClaimStatus,
  GstEligibility,
  Gstr2bMatch,
  LimitType,
  PolicyVerdictKind,
  ReportStatus,
  TravelRequestStatus,
  ViolationAction,
} from "@/lib/types/expenses";

/**
 * Shared presentation for the expense screens: money formatting that never
 * turns a decimal string into a float, and the status vocabulary.
 */

/** Indian grouping without converting to a Number — the shared implementation in lib/utils. */
export function groupIndian(amount: string): string {
  return sharedFormatMoney(amount, { currency: false });
}

/**
 * "₹12,345.00" for INR (the shared `formatMoney`), "EUR 80.00" for a foreign
 * original amount, which the shared helper does not cover. Null → "—".
 */
export function formatMoney(value: string | null | undefined, currency = "INR"): string {
  if (currency.toUpperCase() === "INR") return sharedFormatMoney(value);
  const grouped = sharedFormatMoney(value, { currency: false });
  return grouped === "—" ? grouped : `${currency.toUpperCase()} ${grouped}`;
}

/** "hotel_stay" → "Hotel stay". Category keys are configuration, shown readable. */
export function humanizeKey(key: string): string {
  const spaced = key.replace(/[_-]+/g, " ").trim();
  return spaced ? spaced[0].toUpperCase() + spaced.slice(1) : key;
}

export const CITY_TIER_LABEL: Record<CityTier, string> = {
  a: "Tier A",
  b: "Tier B",
  c: "Tier C",
  international: "International",
};

export const CLAIM_KIND_LABEL: Record<ClaimKind, string> = {
  receipted: "Receipted expense",
  mileage: "Mileage",
  per_diem: "Per-diem",
};

export const LIMIT_TYPE_LABEL: Record<LimitType, string> = {
  per_claim: "Per claim",
  per_day: "Per day",
  per_month: "Per month",
  per_trip: "Per trip",
};

export const VIOLATION_ACTION_LABEL: Record<ViolationAction, string> = {
  block: "Block",
  flag: "Flag",
  require_justification: "Require justification",
};

type Variant = "warning" | "success" | "destructive" | "muted" | "secondary" | "outline" | "accent";

const CLAIM_STATUS: Record<ClaimStatus, [Variant, string]> = {
  draft: ["muted", "Draft"],
  pending_manager: ["warning", "With manager"],
  submitted: ["warning", "With finance"],
  approved: ["success", "Approved"],
  rejected: ["destructive", "Rejected"],
  reimbursed: ["success", "Reimbursed"],
  cancelled: ["muted", "Cancelled"],
};

export function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  const [variant, label] = CLAIM_STATUS[status];
  return <Badge variant={variant}>{label}</Badge>;
}

const REPORT_STATUS: Record<ReportStatus, [Variant, string]> = {
  draft: ["muted", "Draft"],
  submitted: ["warning", "Submitted"],
  approved: ["success", "Approved"],
  partially_approved: ["accent", "Partly approved"],
  rejected: ["destructive", "Rejected"],
  cancelled: ["muted", "Cancelled"],
};

export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  const [variant, label] = REPORT_STATUS[status];
  return <Badge variant={variant}>{label}</Badge>;
}

const VERDICT: Record<PolicyVerdictKind, [Variant, string]> = {
  within_policy: ["success", "Within policy"],
  no_rule: ["outline", "No rule"],
  flagged: ["warning", "Flagged"],
  needs_justification: ["warning", "Needs justification"],
  blocked: ["destructive", "Blocked"],
  receipt_required: ["destructive", "Receipt required"],
  pre_approval_required: ["destructive", "Pre-approval required"],
};

export function VerdictBadge({ kind }: { kind: PolicyVerdictKind }) {
  const [variant, label] = VERDICT[kind];
  return <Badge variant={variant}>{label}</Badge>;
}

const TRAVEL_STATUS: Record<TravelRequestStatus, [Variant, string]> = {
  draft: ["muted", "Draft"],
  pending_manager: ["warning", "Awaiting manager"],
  submitted: ["warning", "Awaiting finance"],
  approved: ["success", "Approved"],
  rejected: ["destructive", "Rejected"],
  cancelled: ["muted", "Cancelled"],
  completed: ["secondary", "Completed"],
};

export function TravelStatusBadge({ status }: { status: TravelRequestStatus }) {
  const [variant, label] = TRAVEL_STATUS[status];
  return <Badge variant={variant}>{label}</Badge>;
}

const ADVANCE_STATUS: Record<AdvanceStatus, [Variant, string]> = {
  issued: ["warning", "Outstanding"],
  settled: ["success", "Settled"],
  cancelled: ["muted", "Cancelled"],
};

export function AdvanceStatusBadge({ status }: { status: AdvanceStatus }) {
  const [variant, label] = ADVANCE_STATUS[status];
  return <Badge variant={variant}>{label}</Badge>;
}

const ELIGIBILITY: Record<GstEligibility, [Variant, string]> = {
  eligible: ["success", "Eligible"],
  ineligible: ["destructive", "Ineligible"],
  uncertain: ["warning", "Needs review"],
};

export function EligibilityBadge({ eligibility }: { eligibility: GstEligibility }) {
  const [variant, label] = ELIGIBILITY[eligibility];
  return <Badge variant={variant}>{label}</Badge>;
}

const MATCH: Record<Gstr2bMatch, [Variant, string]> = {
  not_reconciled: ["muted", "Not reconciled"],
  matched: ["success", "Matched in 2B"],
  missing_in_2b: ["destructive", "Missing in 2B"],
  value_mismatch: ["warning", "Value mismatch"],
};

export function ReconciliationBadge({ status }: { status: Gstr2bMatch }) {
  const [variant, label] = MATCH[status] ?? ["muted", status];
  return <Badge variant={variant}>{label}</Badge>;
}

// ── Form and display helpers (claims, reports, travel) ──────────────────────

/** A typed money amount: digits with up to two decimals. Checked as text, never as a Number. */
export const MONEY_INPUT_PATTERN = /^\d{1,13}(\.\d{1,2})?$/;

export function isMoneyInput(value: string): boolean {
  return MONEY_INPUT_PATTERN.test(value.trim());
}

/** True when a decimal string is above zero — "0", "0.00" and "" are not. */
export function isPositiveAmount(value: string | null | undefined): boolean {
  return Boolean(value) && /[1-9]/.test(value as string) && !(value as string).startsWith("-");
}

/** An API timestamp as "16 Sep 2026, 2:05 pm" in the viewer's zone. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/** The API's `detail` from a thrown ApiError, or a fallback sentence. */
export function errorDetail(error: unknown, fallback: string): string {
  const detail = (error as { detail?: unknown } | null)?.detail;
  return typeof detail === "string" && detail ? detail : fallback;
}

/** Verdicts that stop a claim from being submitted at all. */
export const NON_SUBMITTABLE_VERDICTS: PolicyVerdictKind[] = [
  "blocked",
  "receipt_required",
  "pre_approval_required",
];

/** Readable byte size for receipt limits ("5 MB", "800 KB"). Sizes, not money. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`;
  }
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} bytes`;
}
