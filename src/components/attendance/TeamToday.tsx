"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { CalendarDays, MapPin, MapPinOff, RefreshCw, Users } from "lucide-react";
import React, { useMemo, useState } from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { PersonCell } from "@/components/common/PersonCell";
import { NONE, fromSelect } from "@/components/people/labels";
import { useOrgReference } from "@/components/people/useOrgReference";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useApiQuery } from "@/hooks/useApiQuery";
import type {
  AttendanceSettingsRead,
  TeamMemberState,
  TeamMemberToday,
  TeamToday as TeamTodayData,
} from "@/lib/types/attendance";
import { cn, formatDay } from "@/lib/utils";

import { AttendanceCalendar } from "./AttendanceCalendar";
import { AttendanceExportDialog } from "./AttendanceExportDialog";
import { AttendanceMap, type MapPoint } from "./AttendanceMap";
import { MapLink } from "./location";
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

/** "09:12 in" */
function punchTime(member: TeamMemberToday): string {
  return `${formatClock(member.last_punch_at)} ${member.last_direction === "in" ? "in" : "out"}`;
}

/**
 * "At Pune office", "Away from Pune office", "Location shared" (a point but no
 * office set up to name it) or "No location" (no point at all).
 */
function punchPlace(member: TeamMemberToday): string {
  if (member.last_punch_location) {
    return `${member.last_punch_outside ? "Away from" : "At"} ${member.last_punch_location}`;
  }
  return member.last_punch_latitude !== null ? "Location shared" : "No location";
}

function shiftText(member: TeamMemberToday): string {
  return member.shift_name
    ? `${member.shift_name}${member.shift_start ? ` · ${shortTime(member.shift_start)}` : ""}`
    : "No shift";
}

/**
 * Today at a glance for a manager's team, or everyone for HR: who is in, who
 * has not punched yet, who is on leave or remote — straight from punches,
 * leave and approved requests, nothing inferred.
 */
export function TeamToday() {
  const org = useOrgReference();
  const [company, setCompany] = useState(NONE);
  const [project, setProject] = useState(NONE);
  const [department, setDepartment] = useState(NONE);
  const [location, setLocation] = useState(NONE);
  const orgFilters = useMemo(() => {
    const chosen: Record<string, string> = {};
    const pairs: [string, string][] = [
      ["legal_entity_id", company],
      ["project_id", project],
      ["department_id", department],
      ["location_id", location],
    ];
    for (const [key, value] of pairs) {
      const id = fromSelect(value);
      if (id) chosen[key] = id;
    }
    return chosen;
  }, [company, project, department, location]);
  const query = new URLSearchParams(orgFilters).toString();
  const { data, error, isLoading, reload } = useApiQuery<TeamTodayData>(
    `/attendance/team/today${query ? `?${query}` : ""}`,
  );
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [viewing, setViewing] = useState<TeamMemberToday | null>(null);
  const [exporting, setExporting] = useState<{ ids: string[] | null } | null>(null);
  const narrowed = Object.keys(orgFilters).length > 0;

  const rows = useMemo(() => {
    return (data?.members ?? []).filter((member) => {
      if (filter === "late" && member.late_by_minutes <= 0) return false;
      if (filter === "work_from_home" && !["work_from_home", "on_duty"].includes(member.state)) {
        return false;
      }
      if (!["all", "late", "work_from_home"].includes(filter) && member.state !== filter) {
        return false;
      }
      return true;
    });
  }, [data, filter]);

  const settings = useApiQuery<AttendanceSettingsRead>("/attendance/settings");
  const located: MapPoint[] = (data?.members ?? [])
    .filter((m) => m.last_punch_latitude !== null && m.last_punch_longitude !== null)
    .map((m) => ({
      id: m.employee_id,
      latitude: m.last_punch_latitude as number,
      longitude: m.last_punch_longitude as number,
      label: `${m.employee_name} · ${formatClock(m.last_punch_at)} ${m.last_direction === "in" ? "in" : "out"}${m.last_punch_address ? ` · ${m.last_punch_address}` : ""}`,
      kind: m.last_punch_outside ? "person-away" : "person",
    }));

  const count = (key: (typeof FILTERS)[number]["key"]) => {
    if (!data) return 0;
    if (key === "all") return data.members.length;
    if (key === "work_from_home") return (data.counts.work_from_home ?? 0) + (data.counts.on_duty ?? 0);
    return data.counts[key] ?? 0;
  };

  const columns: ColumnDef<TeamMemberToday>[] = [
    {
      accessorKey: "employee_name",
      header: "Person",
      meta: { text: (member) => `${member.employee_name} ${member.employee_code}` },
      cell: ({ row: { original: member } }) => (
        <PersonCell name={member.employee_name} subtitle={member.designation ?? member.employee_code} />
      ),
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (member) => STATE_LABELS[member.state],
      meta: {
        filter: true,
        filterBy: (member) => STATE_LABELS[member.state],
        text: (member) => [STATE_LABELS[member.state], member.detail].filter(Boolean).join(" · "),
      },
      cell: ({ row: { original: member } }) => (
        <div className="flex flex-col gap-0.5">
          <Badge variant={STATE_VARIANTS[member.state]}>{STATE_LABELS[member.state]}</Badge>
          {member.detail && <span className="text-xs text-muted-foreground">{member.detail}</span>}
        </div>
      ),
    },
    {
      id: "first_in",
      header: "First in",
      accessorFn: (member) => member.first_in ?? undefined,
      meta: { cellClassName: "tabular-nums", text: (member) => formatClock(member.first_in) },
      cell: ({ row }) => formatClock(row.original.first_in),
    },
    {
      id: "last_punch",
      header: "Last punch",
      accessorFn: (member) => member.last_punch_at ?? undefined,
      meta: {
        text: (member) =>
          member.last_punch_at
            ? [punchTime(member), punchPlace(member), member.last_punch_address].filter(Boolean).join(" · ")
            : "—",
      },
      cell: ({ row: { original: member } }) =>
        member.last_punch_at ? (
          <div className="flex w-52 max-w-52 flex-col gap-0.5 whitespace-normal">
            <span className="tabular-nums">{punchTime(member)}</span>
            <span
              className={cn(
                "flex flex-wrap items-center gap-1 text-xs",
                member.last_punch_outside ? "text-marigold-900 dark:text-marigold-100" : "text-muted-foreground",
              )}
            >
              {member.last_punch_location || member.last_punch_latitude !== null ? (
                <MapPin className="size-3" />
              ) : (
                <MapPinOff className="size-3" />
              )}
              {punchPlace(member)}
              {member.last_punch_latitude !== null && member.last_punch_longitude !== null && (
                <MapLink latitude={member.last_punch_latitude} longitude={member.last_punch_longitude} />
              )}
            </span>
            {member.last_punch_address && (
              <span
                className="line-clamp-2 text-xs whitespace-normal text-muted-foreground"
                title={member.last_punch_address}
              >
                {member.last_punch_address}
              </span>
            )}
          </div>
        ) : (
          "—"
        ),
    },
    {
      accessorKey: "late_by_minutes",
      header: "Late by",
      meta: {
        cellClassName: "tabular-nums",
        text: (member) => (member.late_by_minutes > 0 ? formatMinutes(member.late_by_minutes) : "—"),
      },
      cell: ({ row }) =>
        row.original.late_by_minutes > 0 ? (
          <span className="text-destructive">{formatMinutes(row.original.late_by_minutes)}</span>
        ) : (
          "—"
        ),
    },
    { id: "shift", header: "Shift", accessorFn: shiftText, meta: { cellClassName: "text-muted-foreground" } },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableHiding: false,
      meta: { className: "text-right", text: false },
      cell: ({ row }) => (
        <Button variant="outline" size="sm" onClick={() => setViewing(row.original)}>
          <CalendarDays /> Month
        </Button>
      ),
    },
  ];

  return (
    <>
      <DataTable
        title={data ? `Today · ${formatDay(data.today, true)}` : "Today"}
        description="Live from punches, approved leave and approved on-duty or work-from-home."
        actions={
          <Button variant="outline" size="sm" className="h-9" onClick={reload}>
            <RefreshCw /> Refresh
          </Button>
        }
        filters={
          <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {org.entities.length > 0 && (
              <Select value={company} onValueChange={setCompany}>
                <SelectTrigger aria-label="Company" className="h-9 w-48">
                  <SelectValue placeholder="Company" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>All companies</SelectItem>
                  {org.entities.map((entity) => (
                    <SelectItem key={entity.id} value={entity.id}>
                      {entity.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {org.projects.length > 0 && (
              <Select value={project} onValueChange={setProject}>
                <SelectTrigger aria-label="Project" className="h-9 w-44">
                  <SelectValue placeholder="Project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>All projects</SelectItem>
                  {org.projects.map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {org.departments.length > 0 && (
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger aria-label="Department" className="h-9 w-44">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>All departments</SelectItem>
                  {org.departments.map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {org.locations.length > 0 && (
              <Select value={location} onValueChange={setLocation}>
                <SelectTrigger aria-label="Location" className="h-9 w-44">
                  <SelectValue placeholder="Location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>All locations</SelectItem>
                  {org.locations.map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {narrowed && (
              <Button
                size="sm"
                variant="ghost"
                className="h-9"
                onClick={() => {
                  setCompany(NONE);
                  setProject(NONE);
                  setDepartment(NONE);
                  setLocation(NONE);
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
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
          </div>
        }
        columns={columns}
        data={rows}
        getRowId={(member) => member.employee_id}
        noun="people"
        exportName={data ? `team-today-${data.today}` : "team-today"}
        onExport={(selected) =>
          setExporting({ ids: selected ? selected.map((member) => member.employee_id) : null })
        }
        searchPlaceholder="Search name or code"
        isLoading={isLoading && !data}
        error={error?.detail}
        onRetry={reload}
        // With nobody in the team, a chip narrows nothing: the "nothing yet" state still applies.
        filtered={(filter !== "all" && Boolean(data?.members.length)) || narrowed}
        empty={{
          icon: Users,
          title: "Nobody reports to you",
          description: "People in your reporting line appear here once they report to you in the org chart.",
        }}
        emptyMessage="Nobody matches. Try another filter or search."
      />

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

      <AttendanceExportDialog
        open={exporting !== null}
        onOpenChange={(open) => {
          if (!open) setExporting(null);
        }}
        today={data?.today ?? new Date().toISOString().slice(0, 10)}
        people={exporting?.ids ?? null}
        filters={orgFilters}
        scopeText={
          exporting?.ids
            ? `${exporting.ids.length} ticked ${exporting.ids.length === 1 ? "person" : "people"}`
            : narrowed
              ? "Everyone matching the company, project, department and location filters"
              : "Everyone you can review"
        }
      />

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
