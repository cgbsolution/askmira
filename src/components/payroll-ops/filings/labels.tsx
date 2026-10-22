import React from "react";

import { Badge } from "@/components/ui/badge";
import type { FilingStatus, ReturnType } from "@/lib/types/payroll-ops";

export const RETURN_LABEL: Record<ReturnType, string> = {
  pf_ecr: "PF ECR",
  pf_ecr_arrear: "PF arrear ECR",
  esic: "ESIC return",
  professional_tax: "Professional Tax challan",
  tds_24q: "TDS 24Q",
};

export const STATUS_LABEL: Record<FilingStatus, string> = {
  blocked: "Blocked by validation",
  generated: "Generated",
  filed: "Filed",
  rejected: "Rejected by portal",
};

const STATUS_VARIANT: Record<FilingStatus, "destructive" | "muted" | "success" | "warning"> = {
  blocked: "destructive",
  generated: "muted",
  filed: "success",
  rejected: "warning",
};

export function FilingStatusBadge({ status }: { status: FilingStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}

export { displayPeriod, formatTimestamp } from "@/components/payroll-ops/disbursements/common";

/**
 * A validated money string ("1234.5") as whole paise, for an exact equality
 * check between a total and its parts. Integer arithmetic only, never floats.
 * Call only on strings that passed `isMoneyInput`.
 */
export function toPaise(amount: string): bigint {
  const [whole, fraction = ""] = amount.trim().split(".");
  return BigInt(whole) * BigInt(100) + BigInt((fraction + "00").slice(0, 2));
}

/** Whole paise back to a two-decimal string. */
export function fromPaise(paise: bigint): string {
  const negative = paise < BigInt(0);
  const absolute = negative ? -paise : paise;
  const whole = absolute / BigInt(100);
  const fraction = String(absolute % BigInt(100)).padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}
