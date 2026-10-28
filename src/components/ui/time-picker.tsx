"use client";

import { ClockIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * TimePicker — a typed time field with an Hour / Minute picker in a popover,
 * in place of the browser's own `<input type="time">`.
 *
 * Values are 24-hour `"HH:MM"` strings (the shape every API here takes), or ""
 * when empty. People can type `930`, `9:30`, `14:30`, `2:30 pm` or `2pm`; the
 * time snaps to `step` minutes.
 *
 *   <TimePicker id="start" value={start} onChange={setStart} />
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** Reads what a person typed as a time. Returns `"HH:MM"`, or null if it isn't one. */
export function parseTime(text: string, step = 1): string | null {
  const raw = text.trim().toLowerCase();
  if (!raw) return null;
  const match = raw.match(/^(\d{1,2})(?:\s*[:.h]?\s*(\d{2}))?\s*(a\.?\s*m?\.?|p\.?\s*m?\.?)?$/);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = match[2] === undefined ? 0 : Number(match[2]);
  const meridiem = match[3]?.[0];
  if (minute > 59) return null;
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === "p" && hour < 12) hour += 12;
    if (meridiem === "a" && hour === 12) hour = 0;
  } else if (hour > 23) {
    return null;
  }
  return snap(hour, minute, step);
}

function snap(hour: number, minute: number, step: number): string {
  if (step <= 1) return `${pad(hour)}:${pad(minute)}`;
  let snapped = Math.round(minute / step) * step;
  if (snapped >= 60) {
    if (hour < 23) {
      hour += 1;
      snapped = 0;
    } else {
      snapped = 60 - step;
    }
  }
  return `${pad(hour)}:${pad(snapped)}`;
}

function nowTime(step: number): string {
  const now = new Date();
  return snap(now.getHours(), now.getMinutes(), step);
}

function split(value: string | null | undefined): [number | null, number | null] {
  if (!value || !/^\d{2}:\d{2}/.test(value)) return [null, null];
  return [Number(value.slice(0, 2)), Number(value.slice(3, 5))];
}

type TimePickerProps = {
  id?: string;
  value: string | null | undefined;
  onChange: (value: string) => void;
  /** Minute step for the list and for typed times. 1 keeps the exact minute. */
  step?: number;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  "aria-invalid"?: React.AriaAttributes["aria-invalid"];
  "aria-label"?: string;
  "aria-describedby"?: string;
  /** Sizes the field (e.g. `h-9 w-32`). */
  className?: string;
};

function TimePicker({
  id,
  value,
  onChange,
  step = 5,
  placeholder = "hh:mm",
  disabled = false,
  required,
  invalid = false,
  "aria-invalid": ariaInvalid,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  className,
}: TimePickerProps) {
  const current = value ? value.slice(0, 5) : "";
  const [text, setText] = React.useState(current);
  const [typedBad, setTypedBad] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<[number | null, number | null]>([null, null]);
  const lastEmitted = React.useRef(current);
  const hourList = React.useRef<HTMLDivElement>(null);
  const minuteList = React.useRef<HTMLDivElement>(null);

  // A new value from the parent replaces the text, unless it is the one we just sent.
  React.useEffect(() => {
    if (current !== lastEmitted.current) {
      lastEmitted.current = current;
      setText(current);
      setTypedBad(false);
    }
  }, [current]);

  function emit(next: string) {
    lastEmitted.current = next;
    onChange(next);
  }

  function commitTyped() {
    if (!text.trim()) {
      setTypedBad(false);
      if (current) emit("");
      return;
    }
    const parsed = parseTime(text, step);
    if (parsed) {
      setText(parsed);
      setTypedBad(false);
      if (parsed !== current) emit(parsed);
    } else {
      setTypedBad(true);
      if (current) emit("");
    }
  }

  function choose(next: string) {
    setText(next);
    setTypedBad(false);
    if (next !== current) emit(next);
    setOpen(false);
  }

  function nudge(direction: 1 | -1) {
    const [h, m] = split(parseTime(text, step) ?? current);
    const base = h === null ? split(nowTime(step)) : [h, m ?? 0];
    const total = ((base[0]! * 60 + base[1]! + direction * Math.max(step, 1)) % 1440 + 1440) % 1440;
    choose(`${pad(Math.floor(total / 60))}:${pad(total % 60)}`);
  }

  const minutes = React.useMemo(() => {
    const list: number[] = [];
    for (let m = 0; m < 60; m += Math.max(step, 1)) list.push(m);
    const extra = split(current)[1];
    if (extra !== null && !list.includes(extra)) list.push(extra);
    return list.sort((a, b) => a - b);
  }, [step, current]);

  // Open on the chosen time, scrolled so it sits in the middle of each column.
  React.useEffect(() => {
    if (!open) return;
    setDraft(split(current));
    const frame = requestAnimationFrame(() => {
      for (const list of [hourList.current, minuteList.current]) {
        const chosen = list?.querySelector<HTMLElement>("[data-selected=true]");
        if (list && chosen) list.scrollTop = chosen.offsetTop - list.clientHeight / 2 + chosen.clientHeight / 2;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [open, current]);

  const isInvalid = invalid || typedBad || ariaInvalid === true || ariaInvalid === "true";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div data-slot="time-picker" className={cn("relative h-11 w-full", className)}>
          <Input
            id={id}
            value={text}
            placeholder={placeholder}
            disabled={disabled}
            required={required}
            inputMode="text"
            autoComplete="off"
            aria-label={ariaLabel}
            aria-describedby={ariaDescribedBy}
            aria-invalid={isInvalid || undefined}
            className="h-full pr-10 tabular-nums"
            onChange={(event) => {
              setText(event.target.value);
              setTypedBad(false);
            }}
            onBlur={commitTyped}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitTyped();
              } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                event.preventDefault();
                nudge(event.key === "ArrowUp" ? 1 : -1);
              }
            }}
          />
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={disabled}
              aria-label="Pick a time"
              className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground"
            >
              <ClockIcon />
            </Button>
          </PopoverTrigger>
        </div>
      </PopoverAnchor>
      <PopoverContent align="end" className="w-56 p-0" onOpenAutoFocus={(event) => event.preventDefault()}>
        <div className="grid grid-cols-2 divide-x divide-border">
          <TimeColumn
            label="Hour"
            listRef={hourList}
            items={Array.from({ length: 24 }, (_, h) => h)}
            selected={draft[0]}
            onPick={(h) => setDraft(([, m]) => [h, m ?? 0])}
          />
          <TimeColumn
            label="Minute"
            listRef={minuteList}
            items={minutes}
            selected={draft[1]}
            onPick={(m) => setDraft(([h]) => [h ?? 0, m])}
          />
        </div>
        <div className="flex items-center justify-between gap-1 border-t border-border p-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => choose(nowTime(step))}>
            Now
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => {
              setText("");
              setTypedBad(false);
              if (current) emit("");
              setOpen(false);
            }}
          >
            Clear
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={draft[0] === null}
            onClick={() => draft[0] !== null && choose(`${pad(draft[0])}:${pad(draft[1] ?? 0)}`)}
          >
            OK
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TimeColumn({
  label,
  items,
  selected,
  onPick,
  listRef,
}: {
  label: string;
  items: number[];
  selected: number | null;
  onPick: (value: number) => void;
  listRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="flex flex-col">
      <p className="border-b border-border py-2 text-center text-xs font-medium text-muted-foreground">{label}</p>
      <div
        ref={listRef}
        role="listbox"
        aria-label={label}
        className="relative flex h-48 flex-col gap-0.5 overflow-y-auto p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => {
          const isSelected = item === selected;
          return (
            <Button
              key={item}
              type="button"
              role="option"
              aria-selected={isSelected}
              data-selected={isSelected}
              variant={isSelected ? "default" : "ghost"}
              size="sm"
              className="shrink-0 justify-center tabular-nums"
              onClick={() => onPick(item)}
            >
              {pad(item)}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

export { TimePicker };
