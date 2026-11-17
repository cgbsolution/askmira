import type { DayStatus, HoursStatus } from "@/lib/types/consultant-hours";
import { formatDay, toISODate } from "@/lib/utils";

export const HOURS_STATUS: Record<
  HoursStatus,
  { label: string; variant: "default" | "accent" | "success" | "warning" | "destructive" | "muted" }
> = {
  draft: { label: "Draft", variant: "muted" },
  submitted: { label: "Waiting for approval", variant: "warning" },
  approved: { label: "Approved", variant: "success" },
  rejected: { label: "Rejected", variant: "destructive" },
};

export const DAY_STATUS: Record<DayStatus, string> = {
  present: "Present",
  holiday: "Holiday",
  week_off: "Week-off",
  leave: "Leave",
  half_day: "Half-day",
};

export const ACCEPT = ".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg";

/** "1 Oct 2026 to 31 Oct 2026". */
export function periodText(start: string, end: string): string {
  return `${formatDay(start, true)} to ${formatDay(end, true)}`;
}

/** The first and last day of last calendar month, as ISO dates. */
export function previousMonth(today = new Date()): { start: string; end: string } {
  const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const last = new Date(today.getFullYear(), today.getMonth(), 0);
  return { start: toISODate(first), end: toISODate(last) };
}

/** Every ISO date from start to end, inclusive; empty when the range is backwards or over 31 days. */
export function daysBetween(start: string, end: string): string[] {
  if (!start || !end || end < start) return [];
  const [y, m, d] = start.split("-").map(Number);
  const out: string[] = [];
  for (let i = 0; i < 31; i++) {
    const iso = toISODate(new Date(y, m - 1, d + i));
    if (iso > end) return out;
    out.push(iso);
  }
  return [];
}

export function dayName(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { weekday: "short" }).format(new Date(y, m - 1, d));
}

/** Saturday and Sunday, the usual week-off. */
export function isWeekend(iso: string): boolean {
  const [y, m, d] = iso.split("-").map(Number);
  const weekday = new Date(y, m - 1, d).getDay();
  return weekday === 0 || weekday === 6;
}

export function sizeText(bytes: number): string {
  return bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
