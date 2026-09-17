import React from "react";

import { Badge } from "@/components/ui/badge";
import type { ArrearStatus, RevisionType } from "@/lib/types/payroll-ops";

export const ARREAR_STATUS_LABEL: Record<ArrearStatus, string> = {
  preview: "Preview",
  pending_approval: "Awaiting approval",
  approved: "Approved, not yet paid",
  paid: "Paid in payroll",
  cancelled: "Cancelled",
};

const ARREAR_STATUS_VARIANT: Record<ArrearStatus, "muted" | "warning" | "secondary" | "success"> = {
  preview: "muted",
  pending_approval: "warning",
  approved: "secondary",
  paid: "success",
  cancelled: "muted",
};

export function ArrearStatusBadge({ status }: { status: ArrearStatus }) {
  return <Badge variant={ARREAR_STATUS_VARIANT[status]}>{ARREAR_STATUS_LABEL[status]}</Badge>;
}

export const REVISION_TYPE_LABEL: Record<RevisionType, string> = {
  increment: "Increment",
  promotion: "Promotion",
  correction: "Correction",
  arrear_only: "Arrear only",
};

export { displayPeriod, formatTimestamp } from "@/components/payroll-ops/disbursements/common";

/** "employer_contribution" → "Employer contribution". */
export function humanize(value: string): string {
  const spaced = value.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
