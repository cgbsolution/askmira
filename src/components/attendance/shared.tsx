"use client";

import { Loader2, Search } from "lucide-react";
import React, { useEffect, useState } from "react";

import { ErrorState } from "@/components/common/ErrorState";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, get } from "@/lib/api";
import type { EmployeeSummary, Page } from "@/lib/types";
import type {
  AttendanceExceptionKind,
  AttendanceStatus,
  RegularisationStatus,
} from "@/lib/types/attendance";
import { parseISODate, toISODate } from "@/lib/utils";

type BadgeVariant = React.ComponentProps<typeof Badge>["variant"];

// ── Labels and badges ───────────────────────────────────────────────────────

export const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  half_day: "Half day",
  week_off: "Week off",
  holiday: "Holiday",
  on_leave: "On leave",
  lop: "Loss of pay",
  needs_regularisation: "Needs regularisation",
};

const STATUS_VARIANTS: Record<AttendanceStatus, BadgeVariant> = {
  present: "success",
  absent: "destructive",
  half_day: "warning",
  week_off: "muted",
  holiday: "muted",
  on_leave: "secondary",
  lop: "destructive",
  needs_regularisation: "warning",
};

export function StatusBadge({ status }: { status: AttendanceStatus | null }) {
  if (!status) return <Badge variant="outline">Not computed</Badge>;
  return <Badge variant={STATUS_VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>;
}

const REGULARISATION_VARIANTS: Record<RegularisationStatus, BadgeVariant> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
  cancelled: "muted",
};

export function RegularisationStatusBadge({ status }: { status: RegularisationStatus }) {
  return (
    <Badge variant={REGULARISATION_VARIANTS[status]} className="capitalize">
      {status}
    </Badge>
  );
}

export const EXCEPTION_LABELS: Record<AttendanceExceptionKind, string> = {
  needs_regularisation: "Needs regularisation",
  absent: "Absent",
  late: "Late",
  early_out: "Early out",
  outside_geofence: "Outside geofence",
};

const EXCEPTION_VARIANTS: Record<AttendanceExceptionKind, BadgeVariant> = {
  needs_regularisation: "warning",
  absent: "destructive",
  late: "secondary",
  early_out: "secondary",
  outside_geofence: "outline",
};

export function ExceptionKindBadge({ kind }: { kind: AttendanceExceptionKind }) {
  return <Badge variant={EXCEPTION_VARIANTS[kind]}>{EXCEPTION_LABELS[kind]}</Badge>;
}

/** ISO weekdays as the API stores them: 1 = Monday … 7 = Sunday. */
export const WEEKDAYS: { iso: number; label: string }[] = [
  { iso: 1, label: "Mon" },
  { iso: 2, label: "Tue" },
  { iso: 3, label: "Wed" },
  { iso: 4, label: "Thu" },
  { iso: 5, label: "Fri" },
  { iso: 6, label: "Sat" },
  { iso: 7, label: "Sun" },
];

// ── Formatting ──────────────────────────────────────────────────────────────

/** The API's `detail`, verbatim, or a fallback for a non-API failure. */
export function errorDetail(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.detail : fallback;
}

const clockFormat = new Intl.DateTimeFormat("en-IN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** A timestamp from the API as local "HH:MM". */
export function formatClock(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return clockFormat.format(date);
}

const dateTimeFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** A timestamp from the API as "6 Apr 2026, 09:30". */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return dateTimeFormat.format(date);
}

/** 465 → "7h 45m", 30 → "30m", 0 → "0m". */
export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return "0m";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** "09:00:00" → "09:00". */
export function shortTime(value: string): string {
  return value.slice(0, 5);
}

/** First and last calendar day of a month (monthIndex 0-based). */
export function monthBounds(year: number, monthIndex: number): { from: string; to: string } {
  return {
    from: toISODate(new Date(year, monthIndex, 1)),
    to: toISODate(new Date(year, monthIndex + 1, 0)),
  };
}

export function currentMonthBounds(): { from: string; to: string } {
  const now = new Date();
  return monthBounds(now.getFullYear(), now.getMonth());
}

/** Inclusive number of calendar days between two "YYYY-MM-DD" strings. */
export function daysInclusive(start: string, end: string): number {
  const ms = parseISODate(end).getTime() - parseISODate(start).getTime();
  return Math.round(ms / 86_400_000) + 1;
}

/**
 * A local date and "HH:MM" as an ISO timestamp with an explicit offset (UTC),
 * so the server never has to guess which timezone the person meant.
 */
export function localDateTimeToISO(date: string, time: string, addDays = 0): string {
  const day = parseISODate(date);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate() + addDays,
    hours,
    minutes,
  ).toISOString();
}

export function employeeName(employee: EmployeeSummary): string {
  return (
    employee.display_name?.trim() ||
    [employee.first_name, employee.last_name].filter(Boolean).join(" ")
  );
}

/** A whole number from a form field, or null when it is not one. */
export function parseWholeNumber(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  return Number(value.trim());
}

// ── Load states ─────────────────────────────────────────────────────────────

/** A failed load; a 403 is said as a lack of access rather than a fault. */
export function LoadError({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  if (error.status === 403) {
    return (
      <ErrorState
        message={`You don't have access to this. ${error.detail} If you think you should, ask your admin to check your role.`}
      />
    );
  }
  return <ErrorState message={error.detail} onRetry={onRetry} />;
}

export function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2 px-5">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-9 w-full" />
      ))}
    </div>
  );
}

// ── Employee picker ─────────────────────────────────────────────────────────

/** Search the directory and pick one employee. */
export function EmployeePicker({
  value,
  onChange,
}: {
  value: EmployeeSummary | null;
  onChange: (employee: EmployeeSummary | null) => void;
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<EmployeeSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    const timer = setTimeout(() => {
      get<Page<EmployeeSummary>>(
        `/employees?search=${encodeURIComponent(search.trim())}&page_size=50`,
      )
        .then((page) => {
          if (cancelled) return;
          setResults(page.items);
          setError(null);
        })
        .catch((caught) => {
          if (cancelled) return;
          setResults([]);
          setError(errorDetail(caught, "Could not search employees."));
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search]);

  // Keep the chosen person selectable even when a new search no longer lists them.
  const options =
    value && !results.some((employee) => employee.id === value.id) ? [value, ...results] : results;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="grid gap-1.5">
        <Label htmlFor="employee-search">Search employees</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="employee-search"
            className="pl-8"
            value={search}
            maxLength={100}
            placeholder="Name or employee code"
            onChange={(event) => setSearch(event.target.value)}
          />
          {isLoading && (
            <Loader2 className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="employee-select">Employee</Label>
        <Select
          value={value?.id ?? ""}
          onValueChange={(id) => onChange(options.find((employee) => employee.id === id) ?? null)}
        >
          <SelectTrigger id="employee-select" className="w-full">
            <SelectValue
              placeholder={
                options.length === 0 && !isLoading ? "No employees match" : "Choose an employee"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {options.map((employee) => (
              <SelectItem key={employee.id} value={employee.id}>
                {employeeName(employee)}{" "}
                <span className="text-muted-foreground">({employee.employee_code})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
