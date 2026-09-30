import React from "react";

import { Badge } from "@/components/ui/badge";
import type { HalfDaySession, LeaveRequest, LeaveRequestStatus } from "@/lib/types";

const VARIANT: Record<LeaveRequestStatus, "warning" | "success" | "destructive" | "muted"> = {
  draft: "muted",
  pending: "warning",
  approved: "success",
  rejected: "destructive",
  cancelled: "muted",
};

const LABEL: Record<LeaveRequestStatus, string> = {
  draft: "Draft",
  pending: "Pending",
  approved: "Approved",
  rejected: "Declined",
  cancelled: "Cancelled",
};

export const SESSION_LABEL: Record<HalfDaySession, string> = {
  first_half: "First half",
  second_half: "Second half",
};

/** "half day", or which half when the request says. */
export function halfDayLabel(session: HalfDaySession | null): string {
  return session ? SESSION_LABEL[session].toLowerCase() : "half day";
}

export function LeaveStatusBadge({ status }: { status: LeaveRequestStatus }) {
  return <Badge variant={VARIANT[status]}>{LABEL[status]}</Badge>;
}

/** One line on where a request stands: who it waits on, or who decided it. */
export function approvalSummary(request: LeaveRequest): string {
  const chain = request.approval_chain;
  if (request.status === "pending") {
    const waiting = chain.find((step) => step.status === "pending");
    return waiting ? `Waiting on ${waiting.approver_name}` : "Waiting for approval";
  }
  if (request.status === "cancelled") return "Withdrawn";
  const decided = [...chain].reverse().find((step) => step.decided_by_name);
  if (!decided) return "";
  return `${request.status === "approved" ? "Approved" : "Declined"} by ${decided.decided_by_name}`;
}
