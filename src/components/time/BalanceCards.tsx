"use client";

import { CalendarOff, ShieldCheck } from "lucide-react";
import React from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import type { LeaveBalance } from "@/lib/types";
import { cn, formatDays } from "@/lib/utils";

const ACCRUAL_LABEL: Record<string, string> = {
  monthly: "credited monthly",
  quarterly: "credited quarterly",
  annual: "credited yearly",
  on_joining: "on eligibility",
};

const isZero = (value: string) => /^-?0(\.0+)?$/.test(value);

/**
 * One card per leave type: what is left, and how it got there.
 *
 * The big number is `available` — what the ledger says today. Pending
 * requests are called out separately rather than silently subtracted, because
 * a balance that drops the moment you ask for leave reads like a bug.
 *
 * Statutory entitlements such as maternity leave are not drawn down through
 * the year, and "182 days available" on everybody's screen would read as an
 * offer. They sit on one quiet line underneath instead.
 */
export function BalanceCards({
  balances,
  isLoading,
}: {
  balances: LeaveBalance[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-36 w-full" />
        ))}
      </div>
    );
  }

  if (balances.length === 0) {
    return (
      <Card tier="tier1">
        <CardContent className="flex items-center gap-4 py-2">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <CalendarOff className="size-5" />
          </span>
          <div>
            <p className="font-medium text-foreground">No leave policy covers you yet</p>
            <p className="text-sm text-muted-foreground">
              Balances appear once HR assigns a policy for your location and grade.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const drawn = balances.filter((balance) => !balance.is_statutory || !isZero(balance.used));
  const statutory = balances.filter((balance) => balance.is_statutory && isZero(balance.used));

  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {drawn.map((balance) => {
          const entitled =
            Number(balance.opening) + Number(balance.accrued) + Number(balance.carried_forward);
          // Display-only proportion for the bar; every figure shown is the API's string.
          const usedShare =
            entitled > 0 ? Math.min(100, (Number(balance.used) / entitled) * 100) : 0;
          const negative = balance.available.startsWith("-");

          return (
            <Card key={balance.leave_type_id} tier="tier1" className="gap-3 py-4">
              <CardContent className="space-y-3 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {balance.leave_type_name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {balance.annual_quota_days
                        ? `${formatDays(balance.annual_quota_days)} a year, ${
                            ACCRUAL_LABEL[balance.accrual_frequency ?? ""] ?? ""
                          }`
                        : "No active policy"}
                    </p>
                  </div>
                  {!balance.is_paid && <Badge variant="muted">Unpaid</Badge>}
                </div>

                <div className="flex items-baseline gap-1.5">
                  <span
                    className={cn(
                      "text-3xl font-semibold tracking-tight tabular-nums",
                      negative ? "text-destructive" : "text-foreground",
                    )}
                  >
                    {formatDays(balance.available)}
                  </span>
                  <span className="text-sm text-muted-foreground">days available</span>
                </div>

                <Progress value={usedShare} aria-label={`${balance.leave_type_name} used`} />

                <dl className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Earned</dt>
                    <dd className="font-medium text-foreground tabular-nums">
                      {formatDays(entitled.toFixed(2))}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Used</dt>
                    <dd className="font-medium text-foreground tabular-nums">
                      {formatDays(balance.used)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Pending</dt>
                    <dd
                      className={cn(
                        "font-medium tabular-nums",
                        isZero(balance.pending) ? "text-foreground" : "text-warning",
                      )}
                    >
                      {formatDays(balance.pending)}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {statutory.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-brand-600" />
          Statutory entitlements, when eligible:
          {statutory.map((balance) => (
            <span key={balance.leave_type_id} className="text-foreground">
              {balance.leave_type_name} ({formatDays(balance.annual_quota_days)} days)
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
