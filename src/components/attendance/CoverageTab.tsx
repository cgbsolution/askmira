"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import React, { useState } from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { NONE } from "@/components/people/labels";
import { useOrgReference } from "@/components/people/useOrgReference";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { Coverage } from "@/lib/types/attendance";
import { cn, toISODate } from "@/lib/utils";

import { shortTime } from "./shared";

type CoverageShift = Coverage["shifts"][number];

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

  // One column per day of the week, beside the shift.
  const columns: ColumnDef<CoverageShift>[] = [
    {
      accessorKey: "name",
      header: "Shift",
      meta: {
        text: (shift) =>
          [shift.name, shift.location_name, shift.work_area, `${shortTime(shift.start_time)}–${shortTime(shift.end_time)}`]
            .filter(Boolean)
            .join(" · "),
      },
      cell: ({ row }) => {
        const shift = row.original;
        return (
          <>
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
          </>
        );
      },
    },
    ...(data?.days ?? []).map((day): ColumnDef<CoverageShift> => {
      const coverageOf = (shift: CoverageShift) => day.shifts.find((c) => c.shift_id === shift.id);
      return {
        id: day.date,
        header: dayFormat.format(new Date(`${day.date}T00:00:00`)),
        accessorFn: (shift) => coverageOf(shift)?.available ?? null,
        meta: {
          className: "text-center",
          headClassName: "whitespace-nowrap",
          text: (shift) => {
            const cell = coverageOf(shift);
            return cell
              ? `${cell.available} of ${cell.scheduled}${cell.short_by > 0 ? `, ${cell.short_by} short` : ""}`
              : null;
          },
        },
        cell: ({ row }) => {
          const cell = coverageOf(row.original);
          if (!cell) return <span className="text-muted-foreground">—</span>;
          return (
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
          );
        },
      };
    }),
  ];

  return (
    <DataTable
      tier="tier1"
      title="Shift coverage"
      description={data ? `${data.people} people in view. ${data.note}` : undefined}
      columns={columns}
      // Another week or filter never shows the previous one's rows while it loads.
      data={isLoading ? [] : (data?.shifts ?? [])}
      noun="shifts"
      exportName={`shift-coverage-${toISODate(weekStart)}`}
      isLoading={isLoading}
      loadingRows={4}
      error={error?.detail ?? null}
      onRetry={reload}
      filtered={location !== NONE || department !== NONE}
      empty={{ icon: Users, title: "Nobody is scheduled", description: "No one in view has a shift this week." }}
      emptyMessage="Nobody is scheduled. No one in view has a shift this week."
      searchPlaceholder="Line or area"
      search={area}
      onSearchChange={setArea}
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
      filters={
        <>
          <Select value={location} onValueChange={setLocation}>
            <SelectTrigger aria-label="Location" className="h-9 w-44">
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
            <SelectTrigger aria-label="Team" className="h-9 w-44">
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
        </>
      }
    />
  );
}
