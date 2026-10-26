"use client";

import { AlertTriangle, Lock } from "lucide-react";
import React from "react";

import { ErrorState } from "@/components/common/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import { cn, toISODate } from "@/lib/utils";

/**
 * Small pieces shared by the finance review, policies and GST screens.
 *
 * Money is validated and compared as a string: nothing here turns a decimal
 * into a float.
 */

/** Rupees with up to two decimals, as typed. */
export const MONEY_RE = /^\d{1,13}(\.\d{1,2})?$/;

/** A decimal string that is zero ("0", "0.00", "-0.0"). */
export function isZero(value: string | null | undefined): boolean {
  return !value || /^-?0*(\.0*)?$/.test(value);
}

export function todayISO(): string {
  return toISODate(new Date());
}

/** The API's own words for a failure, or a fallback when there are none. */
export function errorDetail(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.detail : fallback;
}

export function ForbiddenState({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center" role="alert">
      <span className="flex size-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Lock className="size-6" />
      </span>
      <div className="max-w-md">
        <p className="font-medium text-foreground">You don&apos;t have access to this</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {message ?? "Your role does not allow this. Ask your admin if you think it should."}
        </p>
      </div>
    </div>
  );
}

/** Loading, 403 and error for one query; `children` only once data exists. */
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

/** A refusal or warning inside a form or dialog, in the server's words. */
export function InlineProblem({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 break-words">{children}</div>
    </div>
  );
}

/** One labelled figure. The value is always a string from the API. */
export function StatTile({
  label,
  value,
  hint,
  tone = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "default" | "warning" | "destructive" | "success";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card px-4 py-3",
        tone === "warning" && "border-marigold-200 dark:border-marigold-900/40",
        tone === "destructive" && "border-destructive/30",
        tone === "success" && "border-success/30",
        className,
      )}
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{value}</p>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
