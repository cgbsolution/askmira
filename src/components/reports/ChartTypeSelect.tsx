"use client";

import React from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ChartType } from "@/lib/types/reports";

export const CHART_TYPE_LABEL: Record<ChartType, string> = {
  bar: "Bar chart",
  line: "Line chart",
  pie: "Pie chart",
  stacked: "Stacked area",
  table: "Table only",
};

/** How a report is shown: a chart above its table, or the table alone. */
export function ChartTypeSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: ChartType;
  onChange: (value: ChartType) => void;
}) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as ChartType)}>
      <SelectTrigger id={id} className="w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(CHART_TYPE_LABEL) as ChartType[]).map((key) => (
          <SelectItem key={key} value={key}>
            {CHART_TYPE_LABEL[key]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
