import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional class names, with later Tailwind utilities winning. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** "Priya Ramesh" → "PR". Falls back to "?" so an avatar is never blank. */
export function initials(name?: string | null): string {
  if (!name) return "?";
  return (
    name
      .split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

/** Indian-format currency. Payroll figures are never rendered as raw numbers. */
export function formatINR(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const amount = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(amount)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

/**
 * A calendar date from the API ("2026-04-06") as a local Date.
 *
 * `new Date("2026-04-06")` is midnight UTC, which is the previous evening
 * anywhere west of Greenwich — a leave request would render a day early.
 */
export function parseISODate(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** A local Date back to "YYYY-MM-DD", without a UTC round-trip. */
export function toISODate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** "6 Apr" or "6 Apr 2026", for a calendar date string. */
export function formatDay(value: string, withYear = false): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
  }).format(parseISODate(value));
}

/** "6 – 10 Apr 2026", "30 Mar – 3 Apr 2026" or "6 Apr 2026". */
export function formatDateRange(start: string, end: string): string {
  if (start === end) return formatDay(start, true);
  const a = parseISODate(start);
  const b = parseISODate(end);
  if (a.getFullYear() !== b.getFullYear()) {
    return `${formatDay(start, true)} – ${formatDay(end, true)}`;
  }
  if (a.getMonth() === b.getMonth()) {
    return `${a.getDate()} – ${formatDay(end, true)}`;
  }
  return `${formatDay(start)} – ${formatDay(end, true)}`;
}

/**
 * A decimal day string for display: "2.50" → "2.5", "3.00" → "3".
 *
 * Pure string handling, so "0.1 + 0.2" never enters into it.
 */
export function formatDays(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  if (!value.includes(".")) return value;
  const trimmed = value.replace(/0+$/, "").replace(/\.$/, "");
  return trimmed === "-0" ? "0" : trimmed;
}

/** "1 day", "2.5 days". */
export function pluralDays(value: string | null | undefined): string {
  const shown = formatDays(value);
  return `${shown} ${shown === "1" ? "day" : "days"}`;
}

/** "hr_ops" → "HR Ops". Role slugs are stored snake_case and shown title-case. */
export function humanizeRole(role: string): string {
  return role
    .split("_")
    .map((word) => (word.length <= 2 ? word.toUpperCase() : word[0].toUpperCase() + word.slice(1)))
    .join(" ");
}
