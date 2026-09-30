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
import {
  formatClock,
  formatMinutes,
  LoadError,
  monthBounds,
  shortTime,
  STATUS_LABELS,
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
            : STATUS_LABELS[row.status]
          : row.status === "holiday"
            ? (holiday ?? "Holiday")
            : row.status === "on_leave" && leave
              ? leave.leave_type
              : STATUS_LABELS[row.status];
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
      if (weekOffs.includes(isoWeekday(iso))) return { ...base, kind: "week_off", label: "Week off" };
      return { ...base, kind: "upcoming", label: "" };
    }
    return { ...base, kind: "not_computed", label: "Not computed" };
  };

  const selectedInfo = describe(selected);

  const DayCell = (props: React.ComponentProps<typeof DayButton>) => {
    const iso = toISODate(props.day.date);
    const info = describe(iso);
    return (
      <CalendarDayButton
        {...props}
        className={cn(
          "aspect-auto h-full min-h-14 items-stretch justify-start gap-0.5 rounded-md border border-transparent p-1.5 text-left sm:min-h-20 [&>span]:opacity-100",
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
        <span className="hidden truncate text-[10px] leading-tight sm:block">{info.label}</span>
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
            ? `On ${data.shift_today.name} (${shortTime(data.shift_today.start_time)}–${shortTime(data.shift_today.end_time)})${data.shift_today_is_default ? ", the company default" : ""}. Days are computed the night after from punches, shift, leave and holidays.`
            : "Days are computed the night after from punches, shift, leave and holidays."}
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
              <CardContent className="grid gap-6 pb-6 lg:grid-cols-[minmax(0,1fr)_320px]">
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
                    className="w-full p-0 [--cell-size:--spacing(10)]"
                    classNames={{
                      root: "w-full",
                      months: "relative flex w-full flex-col",
                      month: "flex w-full flex-col gap-3",
                      week: "mt-1.5 flex w-full gap-1.5",
                      weekdays: "flex gap-1.5",
                      day: "relative w-full p-0 select-none",
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
              <ul className="flex flex-wrap gap-1.5">
                {(punches.data ?? []).map((punch) => (
                  <li
                    key={punch.id}
                    className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs"
                  >
                    <Badge variant={punch.direction === "in" ? "success" : "secondary"}>
                      {punch.direction === "in" ? "In" : "Out"}
                    </Badge>
                    <span className="tabular-nums">{formatClock(punch.punched_at)}</span>
                  </li>
                ))}
              </ul>
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

function DayList({
  days,
  today,
  isLocked,
  onRequest,
}: {
  days: AttendanceDay[];
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
        title="No attendance days computed for this month"
        description="Days are computed the night after they happen, from punches, shift, leave and holidays."
      />
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-6">Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>First in</TableHead>
          <TableHead>Last out</TableHead>
          <TableHead>Worked</TableHead>
          <TableHead>Late by</TableHead>
          <TableHead>Overtime</TableHead>
          <TableHead>Note</TableHead>
          {onRequest && (
            <TableHead className="pr-6 text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((day) => (
          <TableRow key={day.id}>
            <TableCell className="pl-6 whitespace-nowrap">{formatDay(day.attendance_date)}</TableCell>
            <TableCell>
              <div className="flex flex-wrap items-center gap-1">
                <StatusBadge status={day.status} />
                {day.is_regularised && <Badge variant="outline">Regularised</Badge>}
              </div>
            </TableCell>
            <TableCell className="tabular-nums">{formatClock(day.first_in)}</TableCell>
            <TableCell className="tabular-nums">{formatClock(day.last_out)}</TableCell>
            <TableCell className="tabular-nums">{formatMinutes(day.worked_minutes)}</TableCell>
            <TableCell className="tabular-nums">
              {day.late_by_minutes > 0 ? formatMinutes(day.late_by_minutes) : "—"}
            </TableCell>
            <TableCell className="tabular-nums">
              {day.overtime_minutes > 0 ? formatMinutes(day.overtime_minutes) : "—"}
            </TableCell>
            <TableCell className="max-w-64 whitespace-normal text-muted-foreground">
              {day.computation_note ?? "—"}
            </TableCell>
            {onRequest && (
              <TableCell className="pr-6 text-right">
                <Button
                  variant="outline"
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
                  Regularise
                </Button>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

