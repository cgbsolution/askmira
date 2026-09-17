"use client";

import { AlertTriangle, Download, Loader2, Lock, ShieldAlert } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { ErrorState } from "@/components/common/ErrorState";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, downloadFile } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Building blocks shared by the payroll-operations, tax and exit screens.
 *
 * Money arrives from the API as a decimal string and is rendered as one. It is
 * never parsed into a JavaScript number for display: `0.1 + 0.2 !== 0.3` is as
 * true in the browser as anywhere else, and a payroll figure that drifts on
 * screen is still a wrong payroll figure.
 */

// ── Money ───────────────────────────────────────────────────────────────────

/** Group Indian-style (12,34,567.50) without converting to a Number. */
export function groupIndian(amount: string | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "—";
  const [whole, fraction] = amount.split(".");
  const negative = whole.startsWith("-");
  const digits = negative ? whole.slice(1) : whole;
  let grouped: string;
  if (digits.length <= 3) {
    grouped = digits;
  } else {
    const last3 = digits.slice(-3);
    const rest = digits.slice(0, -3);
    grouped = `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${last3}`;
  }
  return `${negative ? "-" : ""}${grouped}${fraction ? `.${fraction}` : ""}`;
}

/** "₹12,34,567.50". A string in, a string out. */
export function formatRupees(amount: string | null | undefined): string {
  const grouped = groupIndian(amount);
  if (grouped === "—") return grouped;
  return grouped.startsWith("-") ? `−₹${grouped.slice(1)}` : `₹${grouped}`;
}

/** An amount cell: tabular figures, right-aligned by the caller. */
export function Money({
  value,
  className,
  muted = false,
}: {
  value: string | null | undefined;
  className?: string;
  muted?: boolean;
}) {
  return (
    <span className={cn("tabular-nums", muted && "text-muted-foreground", className)}>
      {formatRupees(value)}
    </span>
  );
}

/** Whether a decimal string is negative, without parsing it. */
export function isNegative(amount: string | null | undefined): boolean {
  return Boolean(amount && amount.trim().startsWith("-"));
}

/** Whether a decimal string is exactly zero ("0", "0.00", "-0.00"). */
export function isZero(amount: string | null | undefined): boolean {
  if (!amount) return true;
  return /^-?0*(\.0*)?$/.test(amount.trim());
}

/**
 * A money input's value is acceptable to send: digits with at most two
 * decimals. Validation only — the string itself is what goes over the wire.
 */
export function isMoneyInput(value: string, { allowNegative = false } = {}): boolean {
  const pattern = allowNegative ? /^-?\d+(\.\d{1,2})?$/ : /^\d+(\.\d{1,2})?$/;
  return pattern.test(value.trim());
}

// ── Financial years ─────────────────────────────────────────────────────────

/** The Indian financial year a date falls in, as its starting calendar year. */
export function financialYearStart(on: Date = new Date()): number {
  return on.getMonth() >= 3 ? on.getFullYear() : on.getFullYear() - 1;
}

/** "2026-27" — the tax and encashment modules' format. */
export function shortFinancialYear(startYear: number): string {
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

/** "2026-2027" — the filings, loans and reimbursements modules' format. */
export function longFinancialYear(startYear: number): string {
  return `${startYear}-${startYear + 1}`;
}

/** The current year and the two before it, newest first. */
export function recentFinancialYears(count = 3): number[] {
  const current = financialYearStart();
  return Array.from({ length: count }, (_, index) => current - index);
}

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "2026-06" → "June 2026". */
export function formatPeriod(period: string): string {
  const [year, month] = period.split("-").map(Number);
  if (!year || !month) return period;
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

// ── Errors and access ───────────────────────────────────────────────────────

/** The API's own message, or a fallback. Shown verbatim in toasts and forms. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.detail : fallback;
}

/** Toast the API's message. For mutations. */
export function toastApiError(error: unknown, fallback: string): void {
  toast.error(apiErrorMessage(error, fallback));
}

/** Shown when the API refused the request for this role. */
export function ForbiddenState({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center" role="alert">
      <span className="flex size-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Lock className="size-6" />
      </span>
      <div className="max-w-md">
        <p className="font-medium text-foreground">You don&apos;t have access to this</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {message ?? "Your role does not allow this. Ask your HR admin if you think it should."}
        </p>
      </div>
    </div>
  );
}

/**
 * The three non-data states of a query, in one place: loading skeleton, 403,
 * other error. Render `children` only when data is present.
 *
 * @example
 *   <QueryBoundary query={query} skeletonRows={4}>
 *     {(rows) => <Table …/>}
 *   </QueryBoundary>
 */
export function QueryBoundary<T>({
  query,
  skeletonRows = 3,
  children,
}: {
  query: { data: T | null; error: ApiError | null; isLoading: boolean; reload: () => void };
  skeletonRows?: number;
  children: (data: T) => React.ReactNode;
}) {
  if (query.isLoading && query.data === null) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: skeletonRows }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    );
  }
  if (query.error) {
    if (query.error.status === 403) return <ForbiddenState message={query.error.detail} />;
    return <ErrorState message={query.error.detail} onRetry={query.reload} />;
  }
  if (query.data === null) return null;
  return <>{children(query.data)}</>;
}

// ── Notices ─────────────────────────────────────────────────────────────────

/**
 * Said plainly wherever a file goes to a government portal or a bank: nothing
 * here has been accepted by the live system yet.
 */
export function NotLiveNotice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Alert variant="warning">
      <ShieldAlert />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

/** A short inline refusal or warning, for a form or a dialog. */
export function InlineProblem({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

// ── Downloads ───────────────────────────────────────────────────────────────

/**
 * Download a generated file through `lib/api.ts`. The server sets
 * `Content-Disposition: attachment`; this only saves what it sends.
 */
export function DownloadButton({
  path,
  fallbackName,
  label = "Download",
  size = "sm",
  variant = "outline",
  disabled = false,
}: {
  path: string;
  fallbackName: string;
  label?: string;
  size?: "sm" | "default";
  variant?: "outline" | "ghost" | "default";
  disabled?: boolean;
}) {
  const [isBusy, setIsBusy] = useState(false);
  return (
    <Button
      size={size}
      variant={variant}
      disabled={disabled || isBusy}
      onClick={async () => {
        setIsBusy(true);
        try {
          await downloadFile(path, fallbackName);
        } catch (error) {
          toastApiError(error, "The file could not be downloaded.");
        } finally {
          setIsBusy(false);
        }
      }}
    >
      {isBusy ? <Loader2 className="animate-spin" /> : <Download />}
      {label}
    </Button>
  );
}
