"use client";

import React, { useEffect, useRef } from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { ErrorState } from "@/components/common/ErrorState";
import { ForbiddenState, MONTH_NAMES, recentFinancialYears, shortFinancialYear } from "@/components/payroll-ops/shared";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { ApiError } from "@/lib/api";
import type { DeclarationStatus, ProofStatus, TaxRegime } from "@/lib/types/tax";

/**
 * Small pieces shared by the employee tax screen and the HR proof queue.
 * Labels only — every value they label comes from the API.
 */

export const HR_ROLES = ["tenant_admin", "hr_admin", "hr_ops"] as const;
export const ADMIN_ROLES = ["tenant_admin", "hr_admin"] as const;

// ── Labels ──────────────────────────────────────────────────────────────────

export const PROOF_STATUS_LABEL: Record<ProofStatus, string> = {
  pending: "Awaiting verification",
  verified: "Verified",
  partially_accepted: "Partly accepted",
  rejected: "Rejected",
};

const PROOF_STATUS_VARIANT: Record<ProofStatus, "warning" | "success" | "accent" | "destructive"> = {
  pending: "warning",
  verified: "success",
  partially_accepted: "accent",
  rejected: "destructive",
};

export function ProofStatusBadge({ status }: { status: ProofStatus }) {
  return <Badge variant={PROOF_STATUS_VARIANT[status]}>{PROOF_STATUS_LABEL[status]}</Badge>;
}

const DECLARATION_STATUS_LABEL: Record<DeclarationStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  locked: "Locked",
};

export function DeclarationStatusBadge({ status }: { status: DeclarationStatus }) {
  const variant = status === "draft" ? "muted" : status === "submitted" ? "secondary" : "outline";
  return <Badge variant={variant}>{DECLARATION_STATUS_LABEL[status]}</Badge>;
}

export const REGIME_LABEL: Record<TaxRegime, string> = {
  old: "Old regime",
  new: "New regime",
};

/** A regime key from a comparison map, labelled when it is one we know. */
export function regimeLabel(key: string): string {
  return key === "old" || key === "new" ? REGIME_LABEL[key] : key;
}

// ── Financial year ──────────────────────────────────────────────────────────

/** "2026-27" → 2026. */
export function startYearOf(financialYear: string): number {
  return Number(financialYear.slice(0, 4));
}

/** April of the start year through March of the next, as the rent form needs. */
export function financialYearMonths(startYear: number): { month: number; year: number }[] {
  return Array.from({ length: 12 }, (_, index) => {
    const month = ((index + 3) % 12) + 1;
    return { month, year: month >= 4 ? startYear : startYear + 1 };
  });
}

export function monthLabel(month: number, year?: number): string {
  const name = MONTH_NAMES[month - 1] ?? String(month);
  return year ? `${name} ${year}` : name;
}

export function FinancialYearSelect({
  value,
  onChange,
  id = "tax-financial-year",
}: {
  value: number;
  onChange: (startYear: number) => void;
  id?: string;
}) {
  return (
    <Select value={String(value)} onValueChange={(next) => onChange(Number(next))}>
      <SelectTrigger id={id} size="sm" className="w-40" aria-label="Financial year">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {recentFinancialYears().map((year) => (
          <SelectItem key={year} value={String(year)}>
            FY {shortFinancialYear(year)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ── Queries ─────────────────────────────────────────────────────────────────

/** Re-run a query whenever `version` moves on, but not on first mount. */
export function useReloadOn(version: number, reload: () => void) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);
}

interface QueryLike {
  error: ApiError | null;
  isLoading: boolean;
  reload: () => void;
}

/**
 * Loading and error states for an endpoint that may legitimately answer
 * `null` (no regime elected, no rent recorded). Returns `null` once the answer
 * is in, whatever it is, so the caller renders the empty or filled state.
 */
export function pendingState(
  query: QueryLike & { data: unknown },
  { rows = 3, loaded }: { rows?: number; loaded: boolean },
): React.ReactNode | null {
  if (query.isLoading && !loaded) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    );
  }
  if (query.error) {
    if (query.error.status === 403) return <ForbiddenState message={query.error.detail} />;
    return <ErrorState message={query.error.detail} onRetry={query.reload} />;
  }
  return null;
}

type DataPanelProps = React.ComponentProps<typeof DataPanel>;

/**
 * `DataPanel` driven by a `useApiQuery` result: skeleton on first load, the
 * API's message on error (a 403 as `ForbiddenState`), `empty` when the data
 * says so, otherwise `children(data)`.
 */
export function QueryPanel<T>({
  query,
  isEmpty,
  children,
  ...panel
}: Omit<DataPanelProps, "isLoading" | "error" | "onRetry" | "isEmpty" | "children"> & {
  query: { data: T | null; error: ApiError | null; isLoading: boolean; reload: () => void };
  isEmpty?: (data: T) => boolean;
  children: (data: T) => React.ReactNode;
}) {
  const forbidden = query.error?.status === 403;
  return (
    <DataPanel
      {...panel}
      isLoading={query.isLoading && query.data === null}
      error={forbidden ? null : (query.error?.detail ?? null)}
      onRetry={query.reload}
      isEmpty={!forbidden && query.data !== null && Boolean(isEmpty?.(query.data))}
    >
      {forbidden ? (
        <ForbiddenState message={query.error?.detail} />
      ) : query.data !== null ? (
        children(query.data)
      ) : null}
    </DataPanel>
  );
}

/** Tracks whether a query has answered at least once (its answer may be null). */
export function useHasLoaded(query: QueryLike): boolean {
  const loaded = useRef(false);
  if (!query.isLoading && !query.error) loaded.current = true;
  return loaded.current;
}

// ── Decimal strings ─────────────────────────────────────────────────────────

/**
 * Compare two non-negative decimal strings without turning them into numbers.
 * Returns -1, 0 or 1.
 */
export function compareDecimal(a: string, b: string): number {
  const split = (value: string) => {
    const [whole = "0", fraction = ""] = value.trim().split(".");
    return { whole: whole.replace(/^0+(?=\d)/, ""), fraction };
  };
  const left = split(a);
  const right = split(b);
  if (left.whole.length !== right.whole.length) {
    return left.whole.length < right.whole.length ? -1 : 1;
  }
  if (left.whole !== right.whole) return left.whole < right.whole ? -1 : 1;
  const width = Math.max(left.fraction.length, right.fraction.length);
  const lf = left.fraction.padEnd(width, "0");
  const rf = right.fraction.padEnd(width, "0");
  if (lf === rf) return 0;
  return lf < rf ? -1 : 1;
}

// ── Uploads ─────────────────────────────────────────────────────────────────

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const UPLOAD_ACCEPT = ".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg";
export const UPLOAD_HINT =
  "PDF, PNG or JPEG, up to 5 MB. The type is read from the file's contents, not its name.";

/**
 * A friendlier early message for an obviously wrong file. The server reads the
 * contents and has the final say; this only saves a round trip.
 */
export function uploadProblem(file: File | null): string | null {
  if (!file) return "Choose a file to upload.";
  if (!/\.(pdf|png|jpe?g)$/i.test(file.name)) return "The file must be a PDF, PNG or JPEG.";
  if (file.size > MAX_UPLOAD_BYTES) return "The file is larger than 5 MB.";
  if (file.size === 0) return "The file is empty.";
  return null;
}

/** A 12-character-ish window on a hash, for recognising a document. */
export function shortHash(hash: string): string {
  return hash.length > 12 ? `${hash.slice(0, 12)}…` : hash;
}
