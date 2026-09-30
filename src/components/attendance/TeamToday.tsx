"use client";

import { CalendarDays, MapPin, MapPinOff, RefreshCw, Users } from "lucide-react";
import React, { useMemo, useState } from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { PersonCell } from "@/components/common/PersonCell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import type {
  AttendanceSettingsRead,
  TeamMemberState,
  TeamMemberToday,
  TeamToday as TeamTodayData,
} from "@/lib/types/attendance";
import { cn, formatDay } from "@/lib/utils";

import { AttendanceCalendar } from "./AttendanceCalendar";
import { AttendanceMap, type MapPoint } from "./AttendanceMap";
import { formatClock, formatMinutes, shortTime } from "./shared";

type BadgeVariant = React.ComponentProps<typeof Badge>["variant"];

const STATE_LABELS: Record<TeamMemberState, string> = {
  in: "In",
  out: "Punched out",
  not_in: "Not in yet",
  on_leave: "On leave",
  holiday: "Holiday",
  week_off: "Week off",
  on_duty: "On duty",
  work_from_home: "Work from home",
};

const STATE_VARIANTS: Record<TeamMemberState, BadgeVariant> = {
  in: "success",
  out: "secondary",
  not_in: "warning",
  on_leave: "outline",
  holiday: "muted",
  week_off: "muted",
  on_duty: "success",
  work_from_home: "success",
};

const FILTERS: { key: TeamMemberState | "all" | "late"; label: string }[] = [
  { key: "all", label: "Everyone" },
  { key: "in", label: "In" },
  { key: "not_in", label: "Not in yet" },
  { key: "late", label: "Late" },
  { key: "on_leave", label: "On leave" },
  { key: "work_from_home", label: "Remote" },
];

/**
 * Today at a glance for a manager's team, or everyone for HR: who is in, who
 * has not punched yet, who is on leave or remote — straight from punches,
 * leave and approved requests, nothing inferred.
 */
export function TeamToday() {
  const { data, error, isLoading, reload } = useApiQuery<TeamTodayData>("/attendance/team/today");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState<TeamMemberToday | null>(null);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data?.members ?? []).filter((member) => {
      if (filter === "late" && member.late_by_minutes <= 0) return false;
      if (filter === "work_from_home" && !["work_from_home", "on_duty"].includes(member.state)) {
        return false;
      }
      if (!["all", "late", "work_from_home"].includes(filter) && member.state !== filter) {
        return false;
      }
      if (!term) return true;
      return (
        member.employee_name.toLowerCase().includes(term) ||
        member.employee_code.toLowerCase().includes(term)
      );
    });
  }, [data, filter, search]);

  const settings = useApiQuery<AttendanceSettingsRead>("/attendance/settings");
  const located: MapPoint[] = (data?.members ?? [])
    .filter((m) => m.last_punch_latitude !== null && m.last_punch_longitude !== null)
    .map((m) => ({
      id: m.employee_id,
      latitude: m.last_punch_latitude as number,
      longitude: m.last_punch_longitude as number,
      label: `${m.employee_name} · ${formatClock(m.last_punch_at)} ${m.last_direction === "in" ? "in" : "out"}`,
      kind: m.last_punch_outside ? "person-away" : "person",
    }));

  const count = (key: (typeof FILTERS)[number]["key"]) => {
    if (!data) return 0;
    if (key === "all") return data.members.length;
    if (key === "work_from_home") return (data.counts.work_from_home ?? 0) + (data.counts.on_duty ?? 0);
    return data.counts[key] ?? 0;
  };

  return (
    <>
      <DataPanel
        title={data ? `Today · ${formatDay(data.today, true)}` : "Today"}
        description="Live from punches, approved leave and approved on-duty or work-from-home."
        actions={
          <Button variant="outline" size="sm" onClick={reload}>
            <RefreshCw /> Refresh
          </Button>
        }
        toolbar={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((entry) => (
                <Button
                  key={entry.key}
                  size="sm"
                  variant={filter === entry.key ? "default" : "outline"}
                  onClick={() => setFilter(entry.key)}
                >
                  {entry.label}
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[11px] tabular-nums",
                      filter === entry.key ? "bg-primary-foreground/20" : "bg-muted",
                    )}
                  >
                    {count(entry.key)}
                  </span>
                </Button>
              ))}
            </div>
            <Input
              className="h-9 sm:w-64"
              placeholder="Search name or code"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        }
        isLoading={isLoading && !data}
        error={error?.detail}
        onRetry={reload}
        isEmpty={rows.length === 0}
        empty={{
          icon: Users,
          title: data?.members.length ? "Nobody matches" : "Nobody reports to you",
          description: data?.members.length
            ? "Try another filter or search."
            : "People in your reporting line appear here once they report to you in the org chart.",
        }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Person</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>First in</TableHead>
              <TableHead>Last punch</TableHead>
              <TableHead>Late by</TableHead>
              <TableHead>Shift</TableHead>
              <TableHead className="pr-6 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((member) => (
              <TableRow key={member.employee_id}>
                <TableCell className="pl-6">
                  <PersonCell
                    name={member.employee_name}
                    subtitle={member.designation ?? member.employee_code}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <Badge variant={STATE_VARIANTS[member.state]}>{STATE_LABELS[member.state]}</Badge>
                    {member.detail && (
                      <span className="text-xs text-muted-foreground">{member.detail}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="tabular-nums">{formatClock(member.first_in)}</TableCell>
                <TableCell>
                  {member.last_punch_at ? (
                    <div className="flex flex-col gap-0.5">
                      <span className="tabular-nums">
                        {formatClock(member.last_punch_at)} {member.last_direction === "in" ? "in" : "out"}
                      </span>
                      <span
                        className={cn(
                          "flex items-center gap-1 text-xs",
                          member.last_punch_outside
                            ? "text-mustard-900 dark:text-mustard-100"
                            : "text-muted-foreground",
                        )}
                      >
                        {member.last_punch_location ? <MapPin className="size-3" /> : <MapPinOff className="size-3" />}
                        {member.last_punch_location
                          ? `${member.last_punch_outside ? "Away from" : "At"} ${member.last_punch_location}`
                          : "No location"}
                      </span>
                    </div>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="tabular-nums">
                  {member.late_by_minutes > 0 ? (
                    <span className="text-destructive">{formatMinutes(member.late_by_minutes)}</span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {member.shift_name
                    ? `${member.shift_name}${member.shift_start ? ` · ${shortTime(member.shift_start)}` : ""}`
                    : "No shift"}
                </TableCell>
                <TableCell className="pr-6 text-right">
                  <Button variant="outline" size="sm" onClick={() => setViewing(member)}>
                    <CalendarDays /> Month
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>

      {located.length > 0 && (
        <Card tier="tier1" className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="size-4 text-primary" /> Where people punched today
            </CardTitle>
            <CardDescription>
              Last punch of each person who shared a location. Amber marks a punch outside every
              work location.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AttendanceMap
              className="h-96"
              places={settings.data?.work_locations ?? []}
              live={null}
              points={located}
            />
          </CardContent>
        </Card>
      )}

      <Sheet open={viewing !== null} onOpenChange={(open) => !open && setViewing(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-4xl">
          <SheetHeader>
            <SheetTitle>{viewing?.employee_name}</SheetTitle>
            <SheetDescription>
              {viewing?.employee_code} · attendance month, read-only. Corrections are raised by the
              employee and decided in the Requests tab.
            </SheetDescription>
          </SheetHeader>
          {viewing && (
            <div className="px-4 pb-6">
              <AttendanceCalendar
                employeeId={viewing.employee_id}
                title={`${viewing.employee_name}'s attendance`}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
