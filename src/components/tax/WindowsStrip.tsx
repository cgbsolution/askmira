"use client";

import { CalendarClock } from "lucide-react";
import React from "react";

import { ErrorState } from "@/components/common/ErrorState";
import { ForbiddenState } from "@/components/payroll-ops/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { DeclarationWindow, WindowType } from "@/lib/types/tax";
import { formatDateRange, toISODate } from "@/lib/utils";

const WINDOW_TITLE: Record<WindowType, string> = {
  declaration: "Declaration window",
  proof: "Proof window",
};

const WINDOW_PURPOSE: Record<WindowType, string> = {
  declaration: "When you can declare, or change, what you plan to claim.",
  proof: "When you can upload proof of what you declared.",
};

/** The two windows for the year, as the server has them configured. */
export function WindowsStrip({ financialYear }: { financialYear: string }) {
  const query = useApiQuery<DeclarationWindow[]>(
    `/tax/windows?financial_year=${encodeURIComponent(financialYear)}`,
  );

  if (query.isLoading && query.data === null) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }
  if (query.error) {
    return (
      <Card tier="tier1" className="py-0">
        {query.error.status === 403 ? (
          <ForbiddenState message={query.error.detail} />
        ) : (
          <ErrorState message={query.error.detail} onRetry={query.reload} />
        )}
      </Card>
    );
  }

  const windows = query.data ?? [];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {(["declaration", "proof"] as const).map((type) => (
        <WindowCard
          key={type}
          type={type}
          financialYear={financialYear}
          window={windows.find((row) => row.window_type === type) ?? null}
        />
      ))}
    </div>
  );
}

function WindowCard({
  type,
  window,
  financialYear,
}: {
  type: WindowType;
  window: DeclarationWindow | null;
  financialYear: string;
}) {
  const today = toISODate(new Date());
  const pastClose = window ? today > window.closes_at.slice(0, 10) : false;

  return (
    <Card tier="tier1" className="gap-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="size-4 text-muted-foreground" />
          {WINDOW_TITLE[type]}
        </CardTitle>
        <CardDescription>{WINDOW_PURPOSE[type]}</CardDescription>
        {window && (
          <CardAction>
            {window.is_open ? (
              <Badge variant={pastClose ? "warning" : "success"}>
                {pastClose ? "Open for late submissions" : "Open"}
              </Badge>
            ) : (
              <Badge variant="muted">Closed</Badge>
            )}
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="text-sm">
        {window ? (
          <>
            <p className="font-medium text-foreground tabular-nums">
              {formatDateRange(window.opens_at, window.closes_at)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {window.allow_late_submission
                ? "Late submissions are accepted after it closes."
                : "No late submissions once it closes."}
            </p>
          </>
        ) : (
          <p className="text-muted-foreground">
            Your HR team has not set a {type} window for FY {financialYear}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
