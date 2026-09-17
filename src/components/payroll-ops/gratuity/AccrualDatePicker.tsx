"use client";

import React, { useEffect, useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApiQuery } from "@/hooks/useApiQuery";
import { formatDay } from "@/lib/utils";

/**
 * The dates an accrual has been run for, newest first, and the one chosen.
 * Defaults to the newest as soon as the list arrives.
 */
export function useAccrualDates() {
  const dates = useApiQuery<string[]>("/gratuity/accrual-dates");
  const [asOf, setAsOf] = useState<string | null>(null);

  useEffect(() => {
    if (!dates.data) return;
    if (dates.data.length === 0) {
      setAsOf(null);
    } else if (!asOf || !dates.data.includes(asOf)) {
      setAsOf(dates.data[0]);
    }
  }, [dates.data, asOf]);

  return { dates, asOf, setAsOf };
}

export function AccrualDateSelect({
  dates,
  value,
  onChange,
}: {
  dates: string[];
  value: string | null;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value ?? undefined} onValueChange={onChange}>
      <SelectTrigger size="sm" className="w-44" aria-label="As of">
        <SelectValue placeholder="Choose a date" />
      </SelectTrigger>
      <SelectContent>
        {dates.map((date) => (
          <SelectItem key={date} value={date}>
            As of {formatDay(date, true)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
