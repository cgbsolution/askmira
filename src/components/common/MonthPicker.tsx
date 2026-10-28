"use client";

import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import React, { useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * A month picker (`YYYY-MM`) — a year header and a grid of twelve months in a
 * popover, in place of the browser's `<input type="month">`.
 *
 *   <MonthPicker id="period" value={period} onChange={setPeriod} />
 */
export function MonthPicker({
  id,
  value,
  onChange,
  placeholder = "Pick a month",
  min,
  max,
  disabled = false,
  invalid = false,
  clearable = false,
  "aria-invalid": ariaInvalid,
  "aria-label": ariaLabel,
  className,
}: {
  id?: string;
  value: string | null | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Earliest selectable month, `YYYY-MM`. */
  min?: string;
  /** Latest selectable month, `YYYY-MM`. */
  max?: string;
  disabled?: boolean;
  invalid?: boolean;
  clearable?: boolean;
  "aria-invalid"?: React.AriaAttributes["aria-invalid"];
  "aria-label"?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const chosenYear = value ? Number(value.slice(0, 4)) : null;
  const chosenMonth = value ? Number(value.slice(5, 7)) : null;
  const [year, setYear] = useState(chosenYear ?? new Date().getFullYear());
  const isInvalid = invalid || ariaInvalid === true || ariaInvalid === "true";

  const key = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;
  const allowed = (y: number, m: number) => (!min || key(y, m) >= min) && (!max || key(y, m) <= max);
  const label = chosenYear && chosenMonth ? `${MONTHS[chosenMonth - 1]} ${chosenYear}` : placeholder;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setYear(chosenYear ?? new Date().getFullYear());
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-invalid={isInvalid || undefined}
          aria-label={ariaLabel}
          className={cn("h-11 w-full justify-start font-normal", !value && "text-muted-foreground", className)}
        >
          <CalendarIcon className="text-muted-foreground" />
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="mb-2 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Previous year"
            disabled={Boolean(min) && year <= Number(min!.slice(0, 4))}
            onClick={() => setYear((y) => y - 1)}
          >
            <ChevronLeftIcon />
          </Button>
          <p className="text-sm font-medium tabular-nums">{year}</p>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Next year"
            disabled={Boolean(max) && year >= Number(max!.slice(0, 4))}
            onClick={() => setYear((y) => y + 1)}
          >
            <ChevronRightIcon />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {MONTHS.map((name, index) => {
            const month = index + 1;
            const isChosen = chosenYear === year && chosenMonth === month;
            return (
              <Button
                key={name}
                type="button"
                size="sm"
                variant={isChosen ? "default" : "ghost"}
                disabled={!allowed(year, month)}
                aria-pressed={isChosen}
                onClick={() => {
                  onChange(key(year, month));
                  setOpen(false);
                }}
              >
                {name}
              </Button>
            );
          })}
        </div>
        {clearable && value ? (
          <div className="mt-2 flex justify-end border-t border-border pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Clear
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
