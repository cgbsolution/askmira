"use client";

import {
  Briefcase,
  CalendarDays,
  ClipboardList,
  Clock,
  Fingerprint,
  House,
  List,
  Lock,
  PencilLine,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import type { DayButton } from "react-day-picker";

import { EmptyState } from "@/components/common/EmptyState";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiQuery } from "@/hooks/useApiQuery";
import type {
  AttendanceDay,
  AttendanceStatus,
  CalendarLeave,
  MyAttendancePeriod,
  Punch,
  Regularisation,
  RegularisationKind,
  ShiftBrief,
} from "@/lib/types/attendance";
import { cn, formatDay, formatDays, parseISODate, toISODate } from "@/lib/utils";

import { KIND_LABELS } from "./AttendanceRequestDialog";
import { AttendanceMap } from "./AttendanceMap";
import { PunchLocation } from "./location";
import {
  formatClock,
  formatMinutes,
  LoadError,
  monthBounds,
  shortTime,
  StatusBadge,
} from "./shared";

/** What a calendar cell shows, whether or not the day has been computed. */
type CellKind =
  | AttendanceStatus
  | "leave_pending"
  | "today"
  | "upcoming"
  | "not_computed"
  | "before_joining";

interface CellInfo {
  kind: CellKind;
  label: string;
  row: AttendanceDay | null;
  holiday: string | null;
  leave: CalendarLeave | null;
  pending: Regularisation | null;
}

// Status tints. Literal class names (Tailwind only generates what it can
// see), repeated for the selected state so selection adds a ring instead of
// repainting the day in the primary colour.
const TINTS: Record<CellKind, string> = {
  present:
    "bg-mint-50 text-mint-900 data-[selected-single=true]:bg-mint-50 data-[selected-single=true]:text-mint-900 dark:bg-mint-900/30 dark:text-mint-100",
  half_day:
    "bg-mustard-50 text-mustard-900 data-[selected-single=true]:bg-mustard-50 data-[selected-single=true]:text-mustard-900 dark:bg-mustard-900/30 dark:text-mustard-100",
  needs_regularisation:
    "bg-mustard-100 text-mustard-900 data-[selected-single=true]:bg-mustard-100 data-[selected-single=true]:text-mustard-900 dark:bg-mustard-900/40 dark:text-mustard-100",
  absent:
    "bg-destructive/10 text-destructive data-[selected-single=true]:bg-destructive/10 data-[selected-single=true]:text-destructive",
  lop: "bg-destructive/10 text-destructive data-[selected-single=true]:bg-destructive/10 data-[selected-single=true]:text-destructive",
  on_leave:
    "bg-brand-50 text-brand-800 data-[selected-single=true]:bg-brand-50 data-[selected-single=true]:text-brand-800 dark:bg-brand-900/30 dark:text-brand-100",
  leave_pending:
    "bg-brand-25 text-brand-700 data-[selected-single=true]:bg-brand-25 data-[selected-single=true]:text-brand-700 dark:bg-brand-900/20 dark:text-brand-100",
  holiday:
    "bg-muted text-muted-foreground data-[selected-single=true]:bg-muted data-[selected-single=true]:text-muted-foreground",
  week_off:
    "bg-muted/60 text-muted-foreground data-[selected-single=true]:bg-muted/60 data-[selected-single=true]:text-muted-foreground",
  today:
    "bg-card text-foreground ring-1 ring-primary data-[selected-single=true]:bg-card data-[selected-single=true]:text-foreground",
  upcoming:
    "bg-card text-foreground data-[selected-single=true]:bg-card data-[selected-single=true]:text-foreground",
  not_computed:
    "bg-card text-muted-foreground data-[selected-single=true]:bg-card data-[selected-single=true]:text-muted-foreground",
  before_joining:
    "bg-card text-muted-foreground/60 data-[selected-single=true]:bg-card data-[selected-single=true]:text-muted-foreground/60",
};

/** Labels short enough for a calendar cell. */
const SHORT_LABELS: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  half_day: "Half day",
  week_off: "Off",
  holiday: "Holiday",
  on_leave: "Leave",
  lop: "LOP",
  needs_regularisation: "Regularise",
};

const LEGEND: { kind: CellKind; label: string }[] = [
  { kind: "present", label: "Present" },
  { kind: "half_day", label: "Half day" },
  { kind: "needs_regularisation", label: "Needs regularisation" },
  { kind: "absent", label: "Absent / LOP" },
  { kind: "on_leave", label: "On leave" },
  { kind: "holiday", label: "Holiday" },
  { kind: "week_off", label: "Week off" },
];

function isoWeekday(iso: string): number {
  const day = parseISODate(iso).getDay();
  return day === 0 ? 7 : day;
}

/**
 * One person's month as a calendar: every day, computed or not.
 *
 * Computed days show their status. Days without a row are described from what
 * the API says about them — a holiday, leave, a week off on today's shift, or
 * plainly "not computed yet" — never guessed. `employeeId` shows somebody
 * else's month (a manager or HR looking at a team member) without actions.
 */
export function AttendanceCalendar({
  employeeId,
  title = "My attendance",
  version = 0,
  regularisations = [],
  onRequest,
}: {
  employeeId?: string;
  title?: string;
  version?: number;
  regularisations?: Regularisation[];
  /** Absent for a read-only view. */
  onRequest?: (
    kind: RegularisationKind,
    date: string,
    day: AttendanceDay | null,
    isLocked: boolean,
    today: string,
  ) => void;
}) {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selected, setSelected] = useState(() => toISODate(new Date()));
  const { from, to } = monthBounds(month.getFullYear(), month.getMonth());
  const query = employeeId ? `&employee_id=${encodeURIComponent(employeeId)}` : "";
  const { data, error, isLoading, reload } = useApiQuery<MyAttendancePeriod>(
    `/attendance/period?from=${from}&to=${to}${query}`,
  );

  useEffect(() => {
    if (version > 0) reload();
  }, [version, reload]);

  const byDate = useMemo(() => {
    const rows = new Map<string, AttendanceDay>();
    data?.days.forEach((row) => rows.set(row.attendance_date, row));
    return rows;
  }, [data]);
  const holidays = useMemo(
    () => new Map((data?.holidays ?? []).map((h) => [h.holiday_date, h.name])),
    [data],
  );
  const leaves = useMemo(() => {
    const map = new Map<string, CalendarLeave>();
    // Approved wins over pending for the same date.
    (data?.leaves ?? []).forEach((leave) => {
      const current = map.get(leave.leave_date);
      if (!current || leave.status === "approved") map.set(leave.leave_date, leave);
    });
    return map;
  }, [data]);
  const pendingByDate = useMemo(() => {
    const map = new Map<string, Regularisation>();
    regularisations
      .filter((r) => r.status === "pending")
      .forEach((r) => map.set(r.attendance_date, r));
    return map;
  }, [regularisations]);
  const shifts = useMemo(
    () => new Map((data?.shifts ?? []).map((shift) => [shift.id, shift])),
    [data],
  );

  const today = data?.today ?? toISODate(new Date());

  const describe = (iso: string): CellInfo => {
    const row = byDate.get(iso) ?? null;
    const holiday = holidays.get(iso) ?? null;
    const leave = leaves.get(iso) ?? null;
    const pending = pendingByDate.get(iso) ?? null;
    const base = { row, holiday, leave, pending };
    if (row) {
      const times =
        row.status === "present" || row.status === "half_day"
          ? row.first_in && row.last_out
            ? `${formatClock(row.first_in)}–${formatClock(row.last_out)}`
            : SHORT_LABELS[row.status]
          : row.status === "holiday"
            ? (holiday ?? "Holiday")
            : row.status === "on_leave" && leave
              ? leave.leave_type
              : SHORT_LABELS[row.status];
      return { ...base, kind: row.status, label: times };
    }
    if (data?.date_of_joining && iso < data.date_of_joining) {
      return { ...base, kind: "before_joining", label: "" };
    }
    if (holiday) return { ...base, kind: "holiday", label: holiday };
    if (leave?.status === "approved") return { ...base, kind: "on_leave", label: leave.leave_type };
    if (leave) return { ...base, kind: "leave_pending", label: `${leave.leave_type} (pending)` };
    if (iso === today) return { ...base, kind: "today", label: "Today" };
    const weekOffs = data?.shift_today?.weekly_off_days ?? [];
    if (iso > today) {
      if (weekOffs.includes(isoWeekday(iso))) return { ...base, kind: "week_off", label: "Off" };
      return { ...base, kind: "upcoming", label: "" };
    }
    return { ...base, kind: "not_computed", label: "—" };
  };

  const selectedInfo = describe(selected);

  const DayCell = (props: React.ComponentProps<typeof DayButton>) => {
    const iso = toISODate(props.day.date);
    const info = describe(iso);
    return (
      <CalendarDayButton
        {...props}
        className={cn(
          "aspect-auto h-full min-h-12 w-full min-w-0 items-stretch justify-start gap-1 overflow-hidden rounded-md border border-transparent p-1.5 text-left sm:min-h-[4.5rem] [&>span]:opacity-100",
          "data-[selected-single=true]:border-primary data-[selected-single=true]:ring-2 data-[selected-single=true]:ring-primary/30",
          TINTS[info.kind],
        )}
      >
        <span className="flex items-center justify-between text-xs font-semibold">
          {props.day.date.getDate()}
          {info.pending && (
            <span aria-label="Request pending" className="size-1.5 rounded-full bg-accent" />
          )}
        </span>
        <span className="hidden min-w-0 truncate text-[11px] leading-tight font-medium sm:block">
          {info.label}
        </span>
      </CalendarDayButton>
    );
  };

  return (
    <Card tier="tier1" className="pb-0">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {title}
          {data?.is_locked && (
            <Badge variant="outline">
              <Lock /> Locked for payroll
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          {data?.shift_today
            ? `${data.shift_today.name} ${shortTime(data.shift_today.start_time)}–${shortTime(data.shift_today.end_time)}${data.shift_today_is_default ? " (company default)" : ""}. Each day is judged once it is over, from punches, shift, leave and holidays.`
            : "Each day is judged once it is over, from punches, shift, leave and holidays."}
        </CardDescription>
        <CardAction>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const now = new Date();
              setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
              setSelected(toISODate(now));
            }}
          >
            Today
          </Button>
        </CardAction>
      </CardHeader>

      {isLoading && !data ? (
        <div className="space-y-4 px-6 pb-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-16" />
            ))}
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      ) : error ? (
        <LoadError error={error} onRetry={reload} />
      ) : data ? (
        <>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Figure label="Payable days" value={formatDays(data.summary.payable_days)} />
            <Figure label="LOP days" value={formatDays(data.summary.lop_days)} />
            <Figure label="Present" value={String(data.summary.present_days)} />
            <Figure label="Late marks" value={String(data.summary.late_count)} />
            <Figure
              label="Overtime"
              value={formatMinutes(data.days.reduce((sum, d) => sum + (d.overtime_minutes ?? 0), 0))}
            />
            <Figure
              label="Needs regularisation"
              value={String(data.summary.needs_regularisation)}
              emphasis={data.summary.needs_regularisation > 0}
            />
          </CardContent>

          {data.has_no_shift && (
            <CardContent>
              <Alert variant="warning">
                <Clock />
                <AlertTitle>No shift applies</AlertTitle>
                <AlertDescription>
                  Without a shift a day cannot be judged present or absent, so days show as needing
                  regularisation. HR assigns shifts, or sets a company default, under Shifts &amp;
                  rosters.
                </AlertDescription>
              </Alert>
            </CardContent>
          )}

          <Tabs defaultValue="calendar" className="gap-0">
            <CardContent className="pb-4">
              <TabsList>
                <TabsTrigger value="calendar">
                  <CalendarDays /> Calendar
                </TabsTrigger>
                <TabsTrigger value="list">
                  <List /> List
                </TabsTrigger>
              </TabsList>
            </CardContent>

            <TabsContent value="calendar">
              <CardContent className="grid gap-6 pb-6 xl:grid-cols-[minmax(0,1fr)_300px]">
                <div className="min-w-0">
                  <Calendar
                    mode="single"
                    required
                    month={month}
                    onMonthChange={setMonth}
                    selected={parseISODate(selected)}
                    onSelect={(date) => date && setSelected(toISODate(date))}
                    showOutsideDays={false}
                    weekStartsOn={1}
                    className="w-full p-0 [--cell-size:--spacing(9)]"
                    classNames={{
                      root: "w-full",
                      months: "relative flex w-full flex-col",
                      month: "flex w-full min-w-0 flex-col gap-3",
                      month_grid: "w-full table-fixed border-collapse",
                      week: "mt-1.5 flex w-full gap-1.5",
                      weekdays: "flex gap-1.5",
                      weekday:
                        "min-w-0 flex-1 rounded-md text-[0.8rem] font-medium text-muted-foreground select-none",
                      day: "relative min-w-0 flex-1 p-0 select-none",
                      today: "",
                    }}
                    components={{ DayButton: DayCell }}
                  />
                  <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                    {LEGEND.map((entry) => (
                      <li key={entry.kind} className="flex items-center gap-1.5">
                        <span className={cn("size-3 rounded-sm border", TINTS[entry.kind])} />
                        {entry.label}
                      </li>
                    ))}
                    <li className="flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-accent" /> Request pending
                    </li>
                  </ul>
                </div>

                <DayDetail
                  iso={selected}
                  info={selectedInfo}
                  shift={
                    selectedInfo.row?.shift_id ? (shifts.get(selectedInfo.row.shift_id) ?? null) : null
                  }
                  employeeId={employeeId}
                  today={today}
                  isLocked={data.is_locked}
                  onRequest={onRequest}
                />
              </CardContent>
            </TabsContent>

            <TabsContent value="list">
              <DayList
                days={data.days}
                shifts={shifts}
                today={today}
                isLocked={data.is_locked}
                onRequest={onRequest}
              />
            </TabsContent>
          </Tabs>
        </>
      ) : null}
    </Card>
  );
}

function Figure({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="rounded-md border border-border px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-xl font-semibold tabular-nums",
          emphasis ? "text-destructive" : "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

function DayDetail({
  iso,
  info,
  shift,
  employeeId,
  today,
  isLocked,
  onRequest,
}: {
  iso: string;
  info: CellInfo;
  shift: ShiftBrief | null;
  employeeId?: string;
  today: string;
  isLocked: boolean;
  onRequest?: (
    kind: RegularisationKind,
    date: string,
    day: AttendanceDay | null,
    isLocked: boolean,
    today: string,
  ) => void;
}) {
  const query = employeeId ? `&employee_id=${encodeURIComponent(employeeId)}` : "";
  const hasHappened = iso <= today;
  const punches = useApiQuery<Punch[]>(
    hasHappened && info.kind !== "before_joining"
      ? `/attendance/punches?from=${iso}&to=${iso}${query}`
      : null,
  );
  const row = info.row;
  const canCorrect = hasHappened && info.kind !== "before_joining";

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {iso === today ? "Today" : hasHappened ? "Selected day" : "Upcoming"}
        </p>
        <p className="mt-0.5 text-base font-semibold">{formatDay(iso, true)}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {row ? (
            <StatusBadge status={row.status} />
          ) : info.kind === "holiday" ? (
            <Badge variant="muted">Holiday</Badge>
          ) : info.kind === "on_leave" ? (
            <Badge variant="secondary">On leave</Badge>
          ) : info.kind === "leave_pending" ? (
            <Badge variant="outline">Leave pending</Badge>
          ) : info.kind === "week_off" ? (
            <Badge variant="muted">Week off</Badge>
          ) : info.kind === "not_computed" ? (
            <Badge variant="outline">Not computed yet</Badge>
          ) : info.kind === "today" ? (
            <Badge variant="outline">In progress</Badge>
          ) : null}
          {row?.is_regularised && <Badge variant="outline">Regularised</Badge>}
          {info.pending && (
            <Badge variant="warning">{KIND_LABELS[info.pending.kind]} pending</Badge>
          )}
        </div>
      </div>

      {(info.holiday || info.leave) && (
        <p className="text-sm text-muted-foreground">
          {info.holiday ? `Holiday: ${info.holiday}` : null}
          {info.leave
            ? `${info.leave.leave_type}${info.leave.is_half_day ? " (half day)" : ""} — ${info.leave.status}`
            : null}
        </p>
      )}

      {row && (
        <div className="space-y-1.5">
          <Fact label="First in" value={formatClock(row.first_in)} />
          <Fact label="Last out" value={formatClock(row.last_out)} />
          <Fact label="Worked" value={formatMinutes(row.worked_minutes)} />
          {row.late_by_minutes > 0 && (
            <Fact label="Late by" value={formatMinutes(row.late_by_minutes)} />
          )}
          {row.early_by_minutes > 0 && (
            <Fact label="Left early by" value={formatMinutes(row.early_by_minutes)} />
          )}
          {row.overtime_minutes > 0 && (
            <Fact label="Overtime" value={formatMinutes(row.overtime_minutes)} />
          )}
          {shift && (
            <Fact
              label="Shift"
              value={`${shift.name} ${shortTime(shift.start_time)}–${shortTime(shift.end_time)}`}
            />
          )}
          {row.computation_note && (
            <p className="pt-1 text-xs text-muted-foreground">{row.computation_note}</p>
          )}
        </div>
      )}

      {hasHappened && info.kind !== "before_joining" && (
        <>
          <Separator />
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
              <Fingerprint className="size-4" /> Punches
            </p>
            {punches.isLoading ? (
              <Skeleton className="h-8 w-full" />
            ) : punches.error ? (
              <LoadError error={punches.error} onRetry={punches.reload} />
            ) : (punches.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No punches recorded.</p>
            ) : (
              <ul className="grid gap-1.5">
                {(punches.data ?? []).map((punch) => (
                  <li
                    key={punch.id}
                    className="flex flex-col gap-0.5 rounded-md border border-border px-2.5 py-1.5"
                  >
                    <span className="flex items-center gap-1.5 text-xs">
                      <Badge variant={punch.direction === "in" ? "success" : "secondary"}>
                        {punch.direction === "in" ? "In" : "Out"}
                      </Badge>
                      <span className="font-medium tabular-nums">{formatClock(punch.punched_at)}</span>
                      <span className="text-muted-foreground">{punch.source.replace("_", " ")}</span>
                    </span>
                    <PunchLocation punch={punch} />
                  </li>
                ))}
              </ul>
            )}
            {(punches.data ?? []).some((p) => p.latitude !== null) && (
              <AttendanceMap
                className="mt-3 h-44"
                places={[]}
                live={null}
                points={(punches.data ?? [])
                  .filter((p) => p.latitude !== null && p.longitude !== null)
                  .map((p) => ({
                    id: p.id,
                    latitude: p.latitude as number,
                    longitude: p.longitude as number,
                    label: `${p.direction === "in" ? "In" : "Out"} ${formatClock(p.punched_at)}`,
                    kind: p.direction,
                  }))}
              />
            )}
          </div>
        </>
      )}

      {onRequest && info.kind !== "before_joining" && (
        <>
          <Separator />
          <div className="grid gap-2">
            {canCorrect && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  disabled={Boolean(info.pending)}
                  onClick={() => onRequest("missed_punch", iso, row, isLocked, today)}
                >
                  <Fingerprint /> Missed punch
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  disabled={Boolean(info.pending)}
                  onClick={() => onRequest("status_change", iso, row, isLocked, today)}
                >
                  <PencilLine /> Correct attendance
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              className="justify-start"
              disabled={Boolean(info.pending)}
              onClick={() => onRequest("on_duty", iso, row, isLocked, today)}
            >
              <Briefcase /> On duty
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="justify-start"
              disabled={Boolean(info.pending)}
              onClick={() => onRequest("work_from_home", iso, row, isLocked, today)}
            >
              <House /> Work from home
            </Button>
            {info.pending && (
              <p className="text-xs text-muted-foreground">
                A request for this day is waiting for a decision. Withdraw it below to ask for
                something different.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** Hours on the log's strip: 06:00 to midnight, one cell per hour. */
const STRIP_START_HOUR = 6;
const STRIP_HOURS = 18;

function hourOf(iso: string): number {
  const at = new Date(iso);
  return at.getHours() + at.getMinutes() / 60;
}

function clockHours(hhmmss: string): number {
  const [hours, minutes] = hhmmss.split(":").map(Number);
  return hours + minutes / 60;
}

function overlap(a0: number, a1: number, b0: number, b1: number): number {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
}

/**
 * The day at a glance: each hour from 06:00 is a cell — worked (filled),
 * scheduled but not worked (tinted), or neither. Cells rather than a sized
 * bar keep it to static classes.
 */
function HourStrip({ day, shift }: { day: AttendanceDay; shift: ShiftBrief | null }) {
  const worked =
    day.first_in && day.last_out
      ? [hourOf(day.first_in), Math.max(hourOf(day.first_in), hourOf(day.last_out) || 24)]
      : null;
  let scheduled: [number, number] | null = null;
  if (shift) {
    const from = clockHours(shift.start_time);
    const to = clockHours(shift.end_time);
    scheduled = [from, to > from ? to : 24];
  }
  return (
    <div className="w-40 xl:w-56">
      <div className="grid grid-cols-[repeat(18,minmax(0,1fr))] gap-px overflow-hidden rounded-full">
        {Array.from({ length: STRIP_HOURS }, (_, index) => {
          const hour = STRIP_START_HOUR + index;
          const isWorked = worked !== null && overlap(hour, hour + 1, worked[0], worked[1]) >= 0.5;
          const isScheduled =
            scheduled !== null && overlap(hour, hour + 1, scheduled[0], scheduled[1]) >= 0.5;
          return (
            <span
              key={hour}
              className={cn(
                "h-2",
                isWorked ? "bg-mint-500" : isScheduled ? "bg-mint-100 dark:bg-mint-900/50" : "bg-muted",
              )}
            />
          );
        })}
      </div>
      <div className="mt-0.5 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>24</span>
      </div>
    </div>
  );
}

const weekdayShort = new Intl.DateTimeFormat("en-IN", { weekday: "short" });

function DayList({
  days,
  shifts,
  today,
  isLocked,
  onRequest,
}: {
  days: AttendanceDay[];
  shifts: Map<string, ShiftBrief>;
  today: string;
  isLocked: boolean;
  onRequest?: (
    kind: RegularisationKind,
    date: string,
    day: AttendanceDay | null,
    isLocked: boolean,
    today: string,
  ) => void;
}) {
  const sorted = [...days].sort((a, b) => b.attendance_date.localeCompare(a.attendance_date));
  if (sorted.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="No attendance days yet this month"
        description="A day appears here once it is over and judged, from punches, shift, leave and holidays."
      />
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-6">Day</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden lg:table-cell">Timeline</TableHead>
          <TableHead>In – Out</TableHead>
          <TableHead>Worked</TableHead>
          <TableHead className="hidden md:table-cell">Arrival</TableHead>
          {onRequest && (
            <TableHead className="pr-6 text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((day) => {
          const shift = day.shift_id ? (shifts.get(day.shift_id) ?? null) : null;
          const judged = day.status === "present" || day.status === "half_day";
          return (
            <TableRow key={day.id}>
              <TableCell className="pl-6 whitespace-nowrap">
                <span className="block font-medium">{formatDay(day.attendance_date)}</span>
                <span className="text-xs text-muted-foreground">
                  {weekdayShort.format(parseISODate(day.attendance_date))}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex flex-col items-start gap-1">
                  <StatusBadge status={day.status} />
                  {day.is_regularised && <Badge variant="outline">Regularised</Badge>}
                </div>
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <HourStrip day={day} shift={shift} />
              </TableCell>
              <TableCell className="whitespace-nowrap tabular-nums">
                {day.first_in || day.last_out
                  ? `${formatClock(day.first_in)} – ${formatClock(day.last_out)}`
                  : "—"}
              </TableCell>
              <TableCell className="tabular-nums">
                {day.worked_minutes > 0 ? formatMinutes(day.worked_minutes) : "—"}
                {day.overtime_minutes > 0 && (
                  <span className="block text-xs text-muted-foreground">
                    +{formatMinutes(day.overtime_minutes)} overtime
                  </span>
                )}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                {!judged ? (
                  <span className="text-xs text-muted-foreground">
                    {day.computation_note ?? "—"}
                  </span>
                ) : day.late_by_minutes > 0 ? (
                  <Badge variant="warning">Late {formatMinutes(day.late_by_minutes)}</Badge>
                ) : (
                  <Badge variant="success">On time</Badge>
                )}
              </TableCell>
              {onRequest && (
                <TableCell className="pr-6 text-right">
                  {!["week_off", "holiday", "on_leave"].includes(day.status) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={day.attendance_date > today}
                    onClick={() =>
                      onRequest(
                        day.status === "needs_regularisation" ? "missed_punch" : "status_change",
                        day.attendance_date,
                        day,
                        isLocked,
                        today,
                      )
                    }
                  >
                    <PencilLine /> Regularise
                  </Button>
                  )}
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
