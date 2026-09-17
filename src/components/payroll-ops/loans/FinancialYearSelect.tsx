"use client";

import React from "react";

import { longFinancialYear, recentFinancialYears } from "@/components/payroll-ops/shared";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** The current and two previous financial years, in the "2026-2027" format. */
export function FinancialYearSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" className="w-36" aria-label="Financial year">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {recentFinancialYears().map((start) => (
          <SelectItem key={start} value={longFinancialYear(start)}>
            FY {longFinancialYear(start)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
