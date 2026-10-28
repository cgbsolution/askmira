"use client";

import { CalendarIcon } from "lucide-react";
import React, { useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, formatDay, parseISODate, toISODate, todayISO } from "@/lib/utils";

/**
 * A single-date picker: a button that opens the shadcn Calendar in a popover.
 * Use it for every date field — never the browser's `<input type="date">`.
 *
 * Values are ISO dates (`YYYY-MM-DD`) — the shape every API in this product
 * takes — so callers never handle `Date` objects or timezones. An empty field is
 * "", as the native control reported it.
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
  required = false,
  clearable = !required,
  "aria-invalid": ariaInvalid,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  className,
}: {
  id?: string;
  value: string | null | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Earliest selectable ISO date. */
  min?: string | null;
  /** Latest selectable ISO date. */
  max?: string | null;
  disabled?: boolean;
  invalid?: boolean;
  required?: boolean;
  /** Show "Clear" in the calendar. On by default unless `required`. */
  clearable?: boolean;
  "aria-invalid"?: React.AriaAttributes["aria-invalid"];
  "aria-label"?: string;
  "aria-describedby"?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseISODate(value) : undefined;
  const hidden = [
    ...(min ? [{ before: parseISODate(min) }] : []),
    ...(max ? [{ after: parseISODate(max) }] : []),
  ];
  const today = todayISO();
  const todayAllowed = (!min || today >= min.slice(0, 10)) && (!max || today <= max.slice(0, 10));
  const thisYear = new Date().getFullYear();
  const isInvalid = invalid || ariaInvalid === true || ariaInvalid === "true";

  function pick(next: string) {
    onChange(next);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-invalid={isInvalid || undefined}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          aria-required={required || undefined}
          className={cn(
            "h-11 w-full justify-start font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="text-muted-foreground" />
          <span className="truncate">{value ? formatDay(value, true) : placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? (min && today < min ? parseISODate(min) : undefined)}
          captionLayout="dropdown"
          startMonth={min ? parseISODate(min) : new Date(thisYear - 90, 0)}
          endMonth={max ? parseISODate(max) : new Date(thisYear + 10, 11)}
          disabled={hidden}
          onSelect={(date) => {
            // Clicking the day that is already chosen reports "no date": keep the
            // choice and close, rather than leave the calendar open over the form.
            if (date) onChange(toISODate(date));
            setOpen(false);
          }}
        />
        <div className="flex items-center justify-between gap-2 border-t border-border p-2">
          <Button type="button" variant="ghost" size="sm" disabled={!todayAllowed} onClick={() => pick(today)}>
            Today
          </Button>
          {clearable && value ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => pick("")}
            >
              Clear
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
