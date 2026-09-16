import React from "react";

import { cn, formatMoney } from "@/lib/utils";

/**
 * A rupee amount from the API, grouped the Indian way (₹12,34,567.00).
 *
 * The value stays a string end to end; it is never parsed into a JavaScript
 * number, so a payroll figure cannot drift in the browser.
 */
export function Money({
  value,
  currency = true,
  className,
}: {
  value: string | null | undefined;
  currency?: boolean;
  className?: string;
}) {
  return <span className={cn("tabular-nums", className)}>{formatMoney(value, { currency })}</span>;
}
