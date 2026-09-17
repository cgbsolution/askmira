import { ArrowRightLeft, Car } from "lucide-react";
import React from "react";

import { Badge } from "@/components/ui/badge";
import type {
  CaptureResult,
  ConversionConvention,
  PolicyRuleSummary,
} from "@/lib/types/expenses";
import { cn, formatDay } from "@/lib/utils";

import {
  CITY_TIER_LABEL,
  LIMIT_TYPE_LABEL,
  VIOLATION_ACTION_LABEL,
  VerdictBadge,
  formatMoney,
  humanizeKey,
  isPositiveAmount,
} from "./shared";

export const CONVENTION_LABEL: Record<ConversionConvention, string> = {
  transaction_date: "rate on the transaction date",
  settlement_date: "rate on the settlement date",
};

/** One labelled figure in a detail grid. */
export function DetailFigure({
  label,
  value,
  emphasis = false,
  className,
}: {
  label: string;
  value: React.ReactNode;
  emphasis?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 text-sm tabular-nums text-foreground",
          emphasis && "font-semibold text-destructive",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/** The policy rule in one sentence, from the rule the server applied. */
export function describeRule(rule: PolicyRuleSummary, currency: string): string {
  const parts = [
    `${humanizeKey(rule.category_key)}, ${CITY_TIER_LABEL[rule.city_tier]}`,
    `${LIMIT_TYPE_LABEL[rule.limit_type].toLowerCase()} limit ${formatMoney(rule.limit_amount, currency)}`,
    `over the limit: ${VIOLATION_ACTION_LABEL[rule.violation_action].toLowerCase()}`,
  ];
  if (rule.requires_receipt) {
    parts.push(
      isPositiveAmount(rule.receipt_threshold)
        ? `receipt required above ${formatMoney(rule.receipt_threshold, currency)}`
        : "receipt required",
    );
  }
  if (rule.requires_pre_approval) parts.push("needs an approved travel request");
  if (rule.is_per_diem) parts.push("per-diem rule");
  return parts.join(" · ");
}

/** What the policy said about a claim the moment it was captured. */
export function ClaimVerdictPanel({ result, currency }: { result: CaptureResult; currency: string }) {
  const { verdict, conversion, mileage } = result;
  return (
    <div className="space-y-3">
      <div
        className={cn(
          "rounded-md border px-3 py-3",
          result.may_submit ? "border-border bg-muted/50" : "border-destructive/30 bg-destructive/5",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <VerdictBadge kind={verdict.kind} />
          {verdict.is_violation && <Badge variant="outline">Outside policy</Badge>}
        </div>
        <p className="mt-2 text-sm text-foreground">{verdict.message}</p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
          <DetailFigure
            label="Limit"
            value={verdict.limit_amount === null ? "No limit" : formatMoney(verdict.limit_amount, currency)}
          />
          <DetailFigure label="Already claimed" value={formatMoney(verdict.already_claimed, currency)} />
          <DetailFigure label="This claim" value={formatMoney(verdict.this_claim, currency)} />
          <DetailFigure
            label="Over the limit"
            value={formatMoney(verdict.overage, currency)}
            emphasis={isPositiveAmount(verdict.overage)}
          />
        </dl>
        {verdict.rule && (
          <p className="mt-3 text-xs text-muted-foreground">Rule: {describeRule(verdict.rule, currency)}</p>
        )}
      </div>

      {conversion && (
        <div className="rounded-md border border-border px-3 py-3 text-sm">
          <p className="flex items-center gap-2 font-medium text-foreground">
            <ArrowRightLeft className="size-4 text-muted-foreground" /> Currency conversion
          </p>
          <p className="mt-1.5 tabular-nums text-foreground">
            {formatMoney(conversion.original_amount, conversion.original_currency)} →{" "}
            {formatMoney(conversion.converted_amount, conversion.converted_currency)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            1 {conversion.original_currency} = {conversion.rate} {conversion.converted_currency},{" "}
            {CONVENTION_LABEL[conversion.convention]} ({formatDay(conversion.rate_date, true)}), source:{" "}
            {conversion.rate_source}
          </p>
          {conversion.note && <p className="mt-1 text-xs text-muted-foreground">{conversion.note}</p>}
        </div>
      )}

      {mileage && (
        <div className="rounded-md border border-border px-3 py-3 text-sm">
          <p className="flex flex-wrap items-center gap-2 font-medium text-foreground">
            <Car className="size-4 text-muted-foreground" /> Mileage
            {mileage.exceeds_tolerance && <Badge variant="warning">Beyond route tolerance</Badge>}
          </p>
          <p className="mt-1.5 tabular-nums text-foreground">
            {mileage.distance_km} km × {formatMoney(mileage.rate_per_km, currency)}/km ={" "}
            {formatMoney(mileage.amount, currency)}
          </p>
          {mileage.declared_route_km !== null && (
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
              Declared route {mileage.declared_route_km} km
              {mileage.variance_percent !== null && `, variance ${mileage.variance_percent}%`}
            </p>
          )}
          {mileage.note && <p className="mt-1 text-xs text-muted-foreground">{mileage.note}</p>}
        </div>
      )}
    </div>
  );
}
