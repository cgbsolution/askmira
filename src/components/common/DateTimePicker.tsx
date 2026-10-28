"use client";

import React, { useEffect, useRef, useState } from "react";

import { DatePicker } from "@/components/common/DatePicker";
import { TimePicker } from "@/components/ui/time-picker";
import { cn } from "@/lib/utils";

/**
 * A date and a time side by side, in place of `<input type="datetime-local">`.
 *
 * The value keeps the native shape, `YYYY-MM-DDTHH:MM` in local time, or "" when
 * empty. Picking a date before a time fills in 09:00 (shown, and editable).
 *
 *   <DateTimePicker id="starts" value={starts} onChange={setStarts} />
 */
export function DateTimePicker({
  id,
  value,
  onChange,
  defaultTime = "09:00",
  step = 5,
  disabled = false,
  invalid = false,
  required = false,
  "aria-invalid": ariaInvalid,
  "aria-label": ariaLabel,
  className,
}: {
  id?: string;
  value: string | null | undefined;
  onChange: (value: string) => void;
  defaultTime?: string;
  step?: number;
  disabled?: boolean;
  invalid?: boolean;
  required?: boolean;
  "aria-invalid"?: React.AriaAttributes["aria-invalid"];
  "aria-label"?: string;
  className?: string;
}) {
  const incoming = value ?? "";
  const [date, setDate] = useState(incoming.slice(0, 10));
  const [time, setTime] = useState(incoming.slice(11, 16));
  const lastEmitted = useRef(incoming);

  useEffect(() => {
    if (incoming !== lastEmitted.current) {
      lastEmitted.current = incoming;
      setDate(incoming.slice(0, 10));
      setTime(incoming.slice(11, 16));
    }
  }, [incoming]);

  function emit(nextDate: string, nextTime: string) {
    const next = nextDate && nextTime ? `${nextDate}T${nextTime}` : "";
    lastEmitted.current = next;
    if (next !== incoming) onChange(next);
  }

  const isInvalid = invalid || ariaInvalid === true || ariaInvalid === "true";

  return (
    <div className={cn("grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2", className)}>
      <DatePicker
        id={id}
        value={date}
        disabled={disabled}
        invalid={isInvalid}
        required={required}
        aria-label={ariaLabel ? `${ariaLabel} date` : undefined}
        onChange={(nextDate) => {
          const nextTime = nextDate && !time ? defaultTime : time;
          setDate(nextDate);
          setTime(nextTime);
          emit(nextDate, nextTime);
        }}
      />
      <TimePicker
        value={time}
        step={step}
        disabled={disabled}
        invalid={isInvalid && !time}
        aria-label={ariaLabel ? `${ariaLabel} time` : "Time"}
        onChange={(nextTime) => {
          setTime(nextTime);
          emit(date, nextTime);
        }}
      />
    </div>
  );
}
