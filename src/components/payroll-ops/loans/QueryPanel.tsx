"use client";

import React from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { ForbiddenState } from "@/components/payroll-ops/shared";
import type { ApiError } from "@/lib/api";

type PanelProps = Omit<
  React.ComponentProps<typeof DataPanel>,
  "isLoading" | "error" | "onRetry" | "isEmpty" | "children"
>;

/**
 * `DataPanel` driven by one `useApiQuery` result.
 *
 * Loading, error and empty come from the query; a 403 renders the access
 * message rather than a "could not be loaded" error, since retrying will not help.
 */
export function QueryPanel<T>({
  query,
  isEmpty,
  children,
  ...panel
}: PanelProps & {
  query: { data: T | null; error: ApiError | null; isLoading: boolean; reload: () => void };
  isEmpty?: (data: T) => boolean;
  children: (data: T) => React.ReactNode;
}) {
  const forbidden = query.error?.status === 403;
  const hasData = query.data !== null;
  return (
    <DataPanel
      {...panel}
      isLoading={query.isLoading && !hasData}
      error={forbidden ? null : (query.error?.detail ?? null)}
      onRetry={query.reload}
      isEmpty={!query.error && hasData && Boolean(isEmpty?.(query.data as T))}
    >
      {forbidden ? (
        <ForbiddenState message={query.error?.detail} />
      ) : hasData ? (
        children(query.data as T)
      ) : null}
    </DataPanel>
  );
}
