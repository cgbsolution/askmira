"use client";

import React from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Up to nine digits of rupees and two of paise: ₹99,99,99,999.99 at most. */
const SHAPE = /^\d{0,9}(\.\d{0,2})?$/;

/**
 * Turns what was typed or pasted into an amount string, or null when it is not
 * one. Spaces, commas and a ₹ sign are dropped ("₹12,345.50" → "12345.50");
 * letters, a minus, an exponent or a third decimal are refused.
 */
export function cleanAmount(raw: string): string | null {
  const stripped = raw.replace(/[\s,₹]/g, "");
  return SHAPE.test(stripped) ? stripped : null;
}

/**
 * A money box that only ever holds an amount. Anything else is refused as it is
 * typed or pasted, so the field never shows letters. The value stays a string;
 * it is never turned into a JavaScript number.
 */
export function AmountInput({
  value,
  onValueChange,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type" | "inputMode"> & {
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={value}
      className={cn("text-right tabular-nums", className)}
      onChange={(event) => {
        const cleaned = cleanAmount(event.target.value);
        if (cleaned !== null) onValueChange(cleaned);
      }}
    />
  );
}
