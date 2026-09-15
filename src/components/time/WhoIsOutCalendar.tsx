"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ApiError, get } from "@/lib/api";
import type { Holiday, WhoIsOut } from "@/lib/types";
import { cn, formatDateRange, initials, parseISODate, toISODate } from "@/lib/utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_AVATARS = 3;

/** Monday-first grid covering the whole month: always whole weeks, at most six. */
function monthGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const cells = Math.ceil((offset + last.getDate()) / 7) * 7;
  return Array.from({ length: cells }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

/**
 * The team calendar: who is out, day by day, with holidays marked.
 *
 * Colleagues outside your reporting line appear without a leave type — the
 * server leaves it out, so there is nothing here to hide. Pending leave is
 * drawn dashed, and only ever arrives for people you are allowed to see it for.
 */
export function WhoIsOutCalendar({ version }: { version: number }) {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [entries, setEntries] = useState<WhoIsOut[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const days = useMemo(() => monthGrid(month), [month]);
  const rangeStart = toISODate(days[0]);
  const rangeEnd = toISODate(days[days.length - 1]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    const years = Array.from(new Set([days[0].getFullYear(), days[days.length - 1].getFullYear()]));
    Promise.all([
      get<WhoIsOut[]>(`/leave/who-is-out?start=${rangeStart}&end=${rangeEnd}`),
      ...years.map((year) => get<Holiday[]>(`/leave/holidays?year=${year}`)),
    ])
      .then(([out, ...holidayLists]) => {
        if (cancelled) return;
        setEntries(out as WhoIsOut[]);
        setHolidays((holidayLists as Holiday[][]).flat());
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(error instanceof ApiError ? error.detail : "Could not load the calendar.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [rangeStart, rangeEnd, days, version]);

  const holidaysByDate = useMemo(() => {
    const map = new Map<string, Holiday[]>();
    for (const holiday of holidays) {
      map.set(holiday.holiday_date, [...(map.get(holiday.holiday_date) ?? []), holiday]);
    }
    return map;
  }, [holidays]);

  const today = toISODate(new Date());
  const monthLabel = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(
    month,
  );
  const inMonth = entries.filter((entry) => {
    const start = parseISODate(entry.start_date);
    const end = parseISODate(entry.end_date);
    const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
    const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    return start <= monthEnd && end >= monthStart;
  });

  const shift = (delta: number) =>
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
      <Card tier="tier1" className="gap-0 py-0">
        <div className="flex items-center justify-between border-b border-border p-3">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => shift(-1)} aria-label="Previous month">
              <ChevronLeft />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => shift(1)} aria-label="Next month">
              <ChevronRight />
            </Button>
            <p className="ml-2 font-semibold text-foreground">{monthLabel}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const now = new Date();
              setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
            }}
          >
            Today
          </Button>
        </div>

        <CardContent className="overflow-x-auto p-0">
          <div className="grid min-w-[640px] grid-cols-7">
            {WEEKDAYS.map((weekday) => (
              <div
                key={weekday}
                className="border-b border-border px-2 py-1.5 text-center text-xs font-medium text-muted-foreground"
              >
                {weekday}
              </div>
            ))}
            {days.map((day, index) => {
              const iso = toISODate(day);
              const outside = day.getMonth() !== month.getMonth();
              const weekend = index % 7 >= 5;
              const dayHolidays = holidaysByDate.get(iso) ?? [];
              const out = entries.filter(
                (entry) => entry.start_date <= iso && entry.end_date >= iso,
              );
              return (
                <div
                  key={iso}
                  className={cn(
                    "min-h-24 border-b border-r border-border p-1.5 [&:nth-child(7n)]:border-r-0",
                    (weekend || outside) && "bg-muted/40",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "flex size-6 items-center justify-center rounded-full text-xs",
                        outside ? "text-muted-foreground/60" : "text-foreground",
                        iso === today && "bg-primary font-semibold text-primary-foreground",
                      )}
                    >
                      {day.getDate()}
                    </span>
                  </div>
                  {dayHolidays.map((holiday) => (
                    <p
                      key={holiday.id}
                      className="mt-1 truncate rounded bg-mustard-100 px-1.5 py-0.5 text-[10px] font-medium text-mustard-900 dark:bg-mustard-900/30 dark:text-mustard-100"
                      title={`${holiday.name}${holiday.state_code ? ` (${holiday.state_code})` : ""}`}
                    >
                      {holiday.name}
                      {holiday.state_code && ` · ${holiday.state_code}`}
                    </p>
                  ))}
                  {isLoading ? (
                    index % 5 === 0 && <Skeleton className="mt-1.5 h-5 w-12" />
                  ) : (
                    out.length > 0 && (
                      <div className="mt-1.5 flex items-center -space-x-1.5">
                        {out.slice(0, MAX_AVATARS).map((entry) => (
                          <Tooltip key={`${entry.employee_id}-${entry.start_date}`}>
                            <TooltipTrigger asChild>
                              <Avatar
                                className={cn(
                                  "size-6 ring-2 ring-card",
                                  entry.status === "pending" &&
                                    "opacity-70 outline-1 outline-dashed outline-offset-1 outline-warning",
                                )}
                              >
                                {entry.photo_url && <AvatarImage src={entry.photo_url} alt="" />}
                                <AvatarFallback className="text-[9px]">
                                  {initials(entry.employee_name)}
                                </AvatarFallback>
                              </Avatar>
                            </TooltipTrigger>
                            <TooltipContent>
                              {entry.employee_name}
                              {entry.leave_type_name ? ` · ${entry.leave_type_name}` : " · Out"}
                              {entry.is_half_day && " (half day)"}
                              {entry.status === "pending" && " · pending"}
                            </TooltipContent>
                          </Tooltip>
                        ))}
                        {out.length > MAX_AVATARS && (
                          <span className="flex size-6 items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-muted-foreground ring-2 ring-card">
                            +{out.length - MAX_AVATARS}
                          </span>
                        )}
                      </div>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card tier="tier1" className="h-fit gap-3">
        <CardContent className="space-y-3">
          <p className="text-sm font-semibold text-foreground">Out in {monthLabel.split(" ")[0]}</p>
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : inMonth.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nobody is out this month.</p>
          ) : (
            <ul className="space-y-2.5">
              {inMonth.map((entry) => (
                <li
                  key={`${entry.employee_id}-${entry.start_date}`}
                  className="flex items-center gap-2.5"
                >
                  <Avatar className="size-8">
                    {entry.photo_url && <AvatarImage src={entry.photo_url} alt="" />}
                    <AvatarFallback className="text-[10px]">
                      {initials(entry.employee_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {entry.employee_name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatDateRange(entry.start_date, entry.end_date)}
                      {entry.leave_type_name && ` · ${entry.leave_type_name}`}
                      {entry.status === "pending" && " · pending"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
