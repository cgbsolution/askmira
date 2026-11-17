import React from "react";

import { DAY_STATUS, HOURS, dayName } from "@/components/payroll/consultant-hours/labels";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DayStatus } from "@/lib/types/consultant-hours";
import { formatDay } from "@/lib/utils";

/** One day as the form holds it: hours stay text while typing. */
export type DayCell = { status: DayStatus; hours: string };

/** The hours of a cell as a number; blank or bad text counts as nothing. */
export function cellHours(cell: DayCell): number {
  const value = Number(cell.hours);
  return Number.isFinite(value) ? value : 0;
}

/** Whether a cell's hours are acceptable: blank, or a number from 0 to 24 with at most two decimals. */
export function cellValid(cell: DayCell): boolean {
  const text = cell.hours.trim();
  if (text === "") return true;
  return HOURS.test(text) && Number(text) <= 24;
}

function Block({
  days,
  cells,
  onChange,
  disabled,
}: {
  days: string[];
  cells: (date: string) => DayCell;
  onChange: (date: string, cell: DayCell) => void;
  disabled: boolean;
}) {
  return (
    <div className="min-w-0 rounded-md border border-border">
      <div className="grid grid-cols-[5.5rem_3rem_1fr_5rem] gap-2 border-b border-border bg-muted/50 px-2 py-1.5 text-xs font-medium text-muted-foreground">
        <span>Date</span>
        <span>Day</span>
        <span>Status</span>
        <span className="text-right">Hours</span>
      </div>
      {days.map((date) => {
        const cell = cells(date);
        return (
          <div
            key={date}
            className="grid grid-cols-[5.5rem_3rem_1fr_5rem] items-center gap-2 border-b border-border px-2 py-1 last:border-b-0"
          >
            <span className="text-sm tabular-nums">{formatDay(date)}</span>
            <span className="text-sm text-muted-foreground">{dayName(date)}</span>
            <Select
              value={cell.status}
              disabled={disabled}
              onValueChange={(v) => onChange(date, { ...cell, status: v as DayStatus })}
            >
              <SelectTrigger aria-label={`Status on ${formatDay(date)}`} className="h-8 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(DAY_STATUS) as DayStatus[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {DAY_STATUS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              aria-label={`Hours on ${formatDay(date)}`}
              inputMode="decimal"
              className="h-8 text-right tabular-nums"
              value={cell.hours}
              disabled={disabled}
              aria-invalid={!cellValid(cell)}
              onChange={(event) => onChange(date, { ...cell, hours: event.target.value })}
            />
          </div>
        );
      })}
    </div>
  );
}

/**
 * The month as on the customer's sheet: the first 15 days of the period in one
 * block and the rest in another, each row a date, day name, status and hours.
 */
export function DayGrid({
  days,
  cells,
  onChange,
  disabled = false,
}: {
  days: string[];
  cells: (date: string) => DayCell;
  onChange: (date: string, cell: DayCell) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Block days={days.slice(0, 15)} cells={cells} onChange={onChange} disabled={disabled} />
      {days.length > 15 && (
        <Block days={days.slice(15)} cells={cells} onChange={onChange} disabled={disabled} />
      )}
    </div>
  );
}
