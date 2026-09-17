"use client";

import type { LucideIcon } from "lucide-react";
import React, { useEffect, useMemo } from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { ForbiddenState, formatPeriod } from "@/components/payroll-ops/shared";
import type { ApiError } from "@/lib/api";
import type { LegalEntity } from "@/lib/types/payroll-ops";
import { cn } from "@/lib/utils";

/**
 * Pieces shared by the filings, disbursement and arrears screens (W3).
 * Kept here, next to EmployeePicker, rather than in the cross-workstream
 * `payroll-ops/shared.tsx`.
 */

type Empty = { icon: LucideIcon; title: string; description?: string; action?: React.ReactNode };

interface Query<T> {
  data: T | null;
  error: ApiError | null;
  isLoading: boolean;
  reload: () => void;
}

/**
 * `DataPanel` driven by a `useApiQuery` result, with the 403 case shown as
 * `ForbiddenState` instead of a generic load error.
 *
 * `idle` is shown while the query is waiting for input (its path is null).
 */
export function QueryPanel<T>({
  query,
  isEmpty,
  empty,
  idle,
  children,
  ...panel
}: {
  query: Query<T>;
  isEmpty: (data: T) => boolean;
  empty: Empty;
  idle?: Empty;
  children: (data: T) => React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  toolbar?: React.ReactNode;
  footer?: React.ReactNode;
  loadingRows?: number;
  className?: string;
}) {
  const isLoading = query.isLoading && query.data === null;
  const forbidden = query.error?.status === 403;
  const isIdle = !isLoading && !query.error && query.data === null;

  let content: React.ReactNode = null;
  if (forbidden) content = <ForbiddenState message={query.error?.detail} />;
  else if (query.data !== null) content = children(query.data);

  return (
    <DataPanel
      {...panel}
      isLoading={isLoading}
      error={forbidden ? null : (query.error?.detail ?? null)}
      onRetry={query.reload}
      isEmpty={isIdle ? Boolean(idle) : query.data !== null && !query.error && isEmpty(query.data)}
      empty={isIdle && idle ? idle : empty}
    >
      {content}
    </DataPanel>
  );
}

/** Reload a query whenever the parent bumps its version counter. */
export function useReloadOn(version: number, reload: () => void) {
  useEffect(() => {
    if (version > 0) reload();
  }, [version, reload]);
}

/** Legal entity name by id, from the list the screen already loaded. */
export function useEntityName(entities: LegalEntity[]) {
  return useMemo(() => {
    const names = new Map(entities.map((entity) => [entity.id, entity.name]));
    return (id: string) => names.get(id) ?? "Unknown entity";
  }, [entities]);
}

/** One labelled value in a record's detail grid. */
export function DetailField({
  label,
  className,
  children,
}: {
  label: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-foreground">{children}</dd>
    </div>
  );
}

/** "2026-06" reads as "June 2026"; any other period format is shown as the API sent it. */
export function displayPeriod(period: string): string {
  return /^\d{4}-\d{2}$/.test(period) ? formatPeriod(period) : period;
}

/** A timestamp from the API, as a local date and time. */
export function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(
    date,
  );
}
