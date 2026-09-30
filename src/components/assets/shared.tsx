"use client";

import React from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { ForbiddenState } from "@/components/payroll-ops/shared";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import type { ApiError } from "@/lib/api";
import { HR, MANAGERS } from "@/lib/access";
import type {
  AssetCondition,
  AssetRequestStatus,
  AssetStatus,
  AssignmentOutcome,
} from "@/lib/types/assets";
import { formatDay, toISODate } from "@/lib/utils";

/**
 * Shared pieces for the asset screens. Every label names a value the API sent;
 * nothing here is derived or guessed.
 */

export function useAssetRoles() {
  const { user, hasRole } = useAuth();
  return {
    isHr: hasRole(...HR),
    isManager: hasRole(...MANAGERS),
    /** Nobody hands over, receives back or decides on their own. */
    ownEmployeeId: user?.employee_id ?? null,
  };
}

/** Today's date in the browser, as the ISO string the API takes. */
export function todayISO(): string {
  return toISODate(new Date());
}

export function dayOrDash(value: string | null | undefined): string {
  return value ? formatDay(value, true) : "—";
}

/** A timestamp from the API as a calendar day in the viewer's zone. */
export function stampDay(value: string | null | undefined): string {
  return value ? formatDay(toISODate(new Date(value)), true) : "—";
}

export function pluralCount(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** A money string from a form field: digits with at most two decimals. */
export function isAmount(value: string): boolean {
  return /^\d+(\.\d{1,2})?$/.test(value.trim());
}

// ── Labels ──────────────────────────────────────────────────────────────────

export const STATUS_LABELS: Record<AssetStatus, string> = {
  in_stock: "In stock",
  assigned: "Assigned",
  in_repair: "In repair",
  lost: "Lost",
  retired: "Retired",
  disposed: "Disposed",
};

export const CONDITION_LABELS: Record<AssetCondition, string> = {
  new: "New",
  good: "Good",
  fair: "Fair",
  damaged: "Damaged",
};

export const OUTCOME_LABELS: Record<AssignmentOutcome, string> = {
  returned: "Returned",
  lost: "Not returned",
  written_off: "Written off",
};

export const REQUEST_STATUS_LABELS: Record<AssetRequestStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  fulfilled: "Fulfilled",
  cancelled: "Withdrawn",
};

/** The manual status changes the server allows from each status. */
export const STATUS_TRANSITIONS: Record<AssetStatus, AssetStatus[]> = {
  in_stock: ["in_repair", "lost", "retired", "disposed"],
  in_repair: ["in_stock", "lost", "retired", "disposed"],
  lost: ["in_stock", "retired", "disposed"],
  retired: ["in_stock", "disposed"],
  assigned: ["lost"],
  disposed: [],
};

type BadgeVariant = React.ComponentProps<typeof Badge>["variant"];

const STATUS_VARIANT: Record<AssetStatus, BadgeVariant> = {
  in_stock: "success",
  assigned: "default",
  in_repair: "warning",
  lost: "destructive",
  retired: "muted",
  disposed: "muted",
};

const REQUEST_VARIANT: Record<AssetRequestStatus, BadgeVariant> = {
  pending: "warning",
  approved: "default",
  rejected: "destructive",
  fulfilled: "success",
  cancelled: "muted",
};

const OUTCOME_VARIANT: Record<AssignmentOutcome, BadgeVariant> = {
  returned: "success",
  lost: "destructive",
  written_off: "muted",
};

export function AssetStatusBadge({ status }: { status: AssetStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABELS[status]}</Badge>;
}

export function RequestStatusBadge({ status }: { status: AssetRequestStatus }) {
  return <Badge variant={REQUEST_VARIANT[status]}>{REQUEST_STATUS_LABELS[status]}</Badge>;
}

export function OutcomeBadge({ outcome }: { outcome: AssignmentOutcome | null }) {
  if (!outcome) return <Badge variant="outline">With holder</Badge>;
  return <Badge variant={OUTCOME_VARIANT[outcome]}>{OUTCOME_LABELS[outcome]}</Badge>;
}

// ── Layout helpers ──────────────────────────────────────────────────────────

/** A label/value row in a detail panel. */
export function Fact({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground tabular-nums">{children}</dd>
    </div>
  );
}

interface Query<T> {
  data: T | null;
  error: ApiError | null;
  isLoading: boolean;
  reload: () => void;
}

/**
 * `DataPanel` driven by a `useApiQuery` result: skeleton while loading, the
 * API's refusal as a 403 state, other errors with a retry, then the rows.
 */
export function QueryPanel<T>({
  query,
  isEmpty,
  children,
  ...panel
}: Omit<
  React.ComponentProps<typeof DataPanel>,
  "isLoading" | "error" | "onRetry" | "isEmpty" | "children"
> & {
  query: Query<T>;
  isEmpty: (data: T) => boolean;
  children: (data: T) => React.ReactNode;
}) {
  const forbidden = query.error?.status === 403;
  const data = query.data;
  return (
    <DataPanel
      {...panel}
      isLoading={query.isLoading && data === null}
      error={forbidden ? null : (query.error?.detail ?? null)}
      onRetry={query.reload}
      isEmpty={!forbidden && data !== null && isEmpty(data)}
    >
      {forbidden ? (
        <ForbiddenState message={query.error?.detail} />
      ) : data !== null ? (
        children(data)
      ) : null}
    </DataPanel>
  );
}
