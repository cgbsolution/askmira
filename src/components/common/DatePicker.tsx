"use client";

import { CalendarIcon } from "lucide-react";
import React, { useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, formatDay, parseISODate, toISODate } from "@/lib/utils";

/**
 * A single-date picker: a button that opens the shadcn Calendar in a popover.
 *
 * Values are ISO dates (`YYYY-MM-DD`) — the shape every API in this product
 * takes — so callers never handle `Date` objects or timezones.
 *
 *   <DatePicker id="from" value={from} onChange={setFrom} />
 */
export function DatePicker({
  id,
  value,
  onChange,
  placeholder = "Pick a date",
  min,
  max,
  disabled = false,
  invalid = false,
  className,
}: {
  id?: string;
  value: string | null | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Earliest selectable ISO date. */
  min?: string;
  /** Latest selectable ISO date. */
  max?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseISODate(value) : undefined;
  const hidden = [
    ...(min ? [{ before: parseISODate(min) }] : []),
    ...(max ? [{ after: parseISODate(max) }] : []),
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-invalid={invalid || undefined}
          className={cn(
            "h-11 w-full justify-start font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="text-muted-foreground" />
          {value ? formatDay(value, true) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          captionLayout="dropdown"
          disabled={hidden}
          onSelect={(date) => {
            if (!date) return;
            onChange(toISODate(date));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
