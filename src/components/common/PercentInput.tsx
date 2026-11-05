"use client";

import React from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Up to three digits and four decimals: 4.8077, 12.5, 100. */
const SHAPE = /^\d{0,3}(\.\d{0,4})?$/;

/**
 * A percentage box. Anything that is not a percentage is refused as it is typed
 * or pasted (a "%" sign and spaces are dropped), and more than 100 is refused
 * too. The value stays a string; the server does the arithmetic.
 */
export function PercentInput({
  value,
  onValueChange,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type" | "inputMode"> & {
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className={cn("relative", className)}>
      <Input
        {...props}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        className="pr-7 text-right tabular-nums"
        onChange={(event) => {
          const cleaned = event.target.value.replace(/[\s%]/g, "");
          if (!SHAPE.test(cleaned)) return;
          const [whole] = cleaned.split(".");
          if (whole && Number(whole) > 100) return;
          if (whole === "100" && /\.\d*[1-9]/.test(cleaned)) return;
          onValueChange(cleaned);
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-muted-foreground"
      >
        %
      </span>
    </div>
  );
}
