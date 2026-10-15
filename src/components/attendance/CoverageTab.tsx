"use client";

import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import React, { useState } from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { NONE } from "@/components/people/labels";
import { useOrgReference } from "@/components/people/useOrgReference";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { Coverage } from "@/lib/types/attendance";
import { cn, toISODate } from "@/lib/utils";

import { shortTime } from "./shared";

function mondayOf(day: Date): Date {
  const copy = new Date(day);
  const offset = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - offset);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

const dayFormat = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short" });

/**
 * Who is scheduled on each shift, each day of a week, and who of them is on
 * leave. A shift with a minimum headcount is marked where it falls short.
 */
export function CoverageTab() {
  const org = useOrgReference();
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [location, setLocation] = useState(NONE);
  const [department, setDepartment] = useState(NONE);
  const [area, setArea] = useState("");
  const weekEnd = new Date(weekStart.getTime() + 6 * 86_400_000);

  const query = new URLSearchParams({ from: toISODate(weekStart), to: toISODate(weekEnd) });
  if (location !== NONE) query.set("location_id", location);
  if (department !== NONE) query.set("department_id", department);
  if (area.trim()) query.set("work_area", area.trim());
  const { data, error, isLoading, reload } = useApiQuery<Coverage>(`/attendance/coverage?${query}`);

  const move = (weeks: number) => setWeekStart((current) => new Date(current.getTime() + weeks * 7 * 86_400_000));

  return (
    <DataPanel
      tier="tier1"
      title="Shift coverage"
      description={data ? `${data.people} people in view. ${data.note}` : undefined}
      actions={
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" aria-label="Previous week" onClick={() => move(-1)}>
            <ChevronLeft />
          </Button>
          <span className="text-sm tabular-nums">
            {dayFormat.format(weekStart)} – {dayFormat.format(weekEnd)}
          </span>
          <Button size="icon" variant="ghost" aria-label="Next week" onClick={() => move(1)}>
            <ChevronRight />
          </Button>
        </div>
      }
      toolbar={
        <>
          <Select value={location} onValueChange={setLocation}>
            <SelectTrigger aria-label="Location" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Every location</SelectItem>
              {org.locations.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={department} onValueChange={setDepartment}>
            <SelectTrigger aria-label="Team" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Every team</SelectItem>
              {org.departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            aria-label="Line or area"
            placeholder="Line or area"
            className="w-40"
            value={area}
            onChange={(event) => setArea(event.target.value)}
          />
        </>
      }
      isLoading={isLoading}
      error={error?.detail ?? null}
      onRetry={reload}
      isEmpty={(data?.shifts.length ?? 0) === 0}
      empty={{ icon: Users, title: "Nobody is scheduled", description: "No one in view has a shift this week." }}
    >
      {data && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Shift</TableHead>
              {data.days.map((day) => (
                <TableHead key={day.date} className="text-center whitespace-nowrap">
                  {dayFormat.format(new Date(`${day.date}T00:00:00`))}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.shifts.map((shift) => (
              <TableRow key={shift.id}>
                <TableCell>
                  <p className="font-medium">{shift.name}</p>
                  {(shift.location_name || shift.work_area) && (
                    <p className="text-xs text-muted-foreground">
                      {[shift.location_name, shift.work_area].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {shortTime(shift.start_time)}–{shortTime(shift.end_time)}
                    {shift.min_headcount ? ` · needs ${shift.min_headcount}` : ""}
                  </p>
                </TableCell>
                {data.days.map((day) => {
                  const cell = day.shifts.find((c) => c.shift_id === shift.id);
                  if (!cell) {
                    return (
                      <TableCell key={day.date} className="text-center text-muted-foreground">
                        —
                      </TableCell>
                    );
                  }
                  return (
                    <TableCell key={day.date} className="text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className={cn(
                              "inline-block min-w-12 rounded-md px-2 py-1 text-sm tabular-nums",
                              cell.short_by > 0 ? "bg-destructive/10 font-semibold text-destructive" : "bg-muted",
                            )}
                          >
                            {cell.available}
                            <span className="text-xs text-muted-foreground">/{cell.scheduled}</span>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {cell.scheduled} scheduled, {cell.on_leave} on leave
                          {cell.short_by > 0 ? `, ${cell.short_by} short` : ""}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </DataPanel>
  );
}
