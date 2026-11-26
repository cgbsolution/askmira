"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Briefcase, MapPin, RefreshCw } from "lucide-react";
import React, { useMemo, useState } from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { DatePicker } from "@/components/common/DatePicker";
import { PersonCell } from "@/components/common/PersonCell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { AttendanceSettingsRead, FieldVisit, FieldVisitList } from "@/lib/types/attendance";
import { formatDay, parseISODate, toISODate } from "@/lib/utils";

import { AttendanceExportDialog } from "./AttendanceExportDialog";
import { AttendanceMap, type MapPoint } from "./AttendanceMap";
import { formatDistance, MapLink } from "./location";
import { PhotoButton } from "./PunchPhoto";
import { formatClock, formatMinutes } from "./shared";

/** The API's limit on one period. */
const MAX_DAYS = 93;

function shiftDays(iso: string, days: number): string {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

/** "26 Nov, 10:42": a visit may run past midnight, so the date is shown. */
function when(iso: string): string {
  return `${formatDay(toISODate(new Date(iso)))}, ${formatClock(iso)}`;
}

function End({
  at,
  latitude,
  longitude,
  address,
  accuracy,
}: {
  at: string;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  accuracy: number | null;
}) {
  return (
    <div className="flex w-44 max-w-44 flex-col gap-0.5 whitespace-normal">
      <span className="tabular-nums">{when(at)}</span>
      <span className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        <MapPin className="size-3" />
        {accuracy !== null ? `±${formatDistance(accuracy)}` : "Location"}
        {latitude !== null && longitude !== null && <MapLink latitude={latitude} longitude={longitude} />}
      </span>
      {address && (
        <span className="line-clamp-2 text-xs text-muted-foreground" title={address}>
          {address}
        </span>
      )}
    </div>
  );
}

/**
 * Attendance review → Visits: every client visit in a period — who went
 * where, when they arrived and left, for how long, with the selfie — a count
 * per person, and the visits on a map. HR sees everyone; a manager their
 * reporting line.
 */
export function TeamVisits() {
  const today = useMemo(() => toISODate(new Date()), []);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [exporting, setExporting] = useState<{ ids: string[] | null } | null>(null);

  const span =
    from && to
      ? Math.round((parseISODate(to).getTime() - parseISODate(from).getTime()) / 86_400_000) + 1
      : 0;
  const rangeProblem = !from || !to
    ? "Pick both dates."
    : span < 1
      ? "The end date cannot be before the start date."
      : span > MAX_DAYS
        ? `Pick ${MAX_DAYS} days or fewer.`
        : null;

  const { data, error, isLoading, reload } = useApiQuery<FieldVisitList>(
    rangeProblem ? null : `/attendance/visits?from=${from}&to=${to}`,
  );
  const settings = useApiQuery<AttendanceSettingsRead>("/attendance/settings");
  const visits = useMemo(() => data?.visits ?? [], [data]);

  const perPerson = useMemo(() => {
    const counts = new Map<string, { name: string; code: string | null; visits: number; minutes: number }>();
    for (const visit of visits) {
      const entry = counts.get(visit.employee_id) ?? {
        name: visit.employee_name ?? "Unknown",
        code: visit.employee_code,
        visits: 0,
        minutes: 0,
      };
      entry.visits += 1;
      entry.minutes += visit.duration_minutes ?? 0;
      counts.set(visit.employee_id, entry);
    }
    return [...counts.values()].sort((a, b) => b.visits - a.visits || a.name.localeCompare(b.name));
  }, [visits]);

  const points: MapPoint[] = visits.map((visit) => ({
    id: visit.id,
    latitude: visit.start_latitude,
    longitude: visit.start_longitude,
    label: `${visit.employee_name ?? ""} · ${visit.client_name} · ${formatClock(visit.started_at)}${visit.start_address ? ` · ${visit.start_address}` : ""}`,
    kind: visit.ended_at ? "person" : "in",
  }));

  const columns: ColumnDef<FieldVisit>[] = [
    {
      id: "person",
      header: "Person",
      accessorFn: (visit) => visit.employee_name ?? "",
      meta: { text: (visit) => `${visit.employee_name ?? ""} ${visit.employee_code ?? ""}` },
      cell: ({ row: { original: visit } }) => (
        <PersonCell name={visit.employee_name ?? "Unknown"} subtitle={visit.employee_code ?? undefined} />
      ),
    },
    {
      accessorKey: "client_name",
      header: "Client / place",
      cell: ({ row: { original: visit } }) => (
        <div className="flex w-40 max-w-40 flex-col gap-1 whitespace-normal">
          <span className="font-medium break-words">{visit.client_name}</span>
          {visit.ended_at === null && (
            <Badge variant="success" className="w-fit">
              On the visit now
            </Badge>
          )}
        </div>
      ),
    },
    {
      id: "in",
      header: "Visit in",
      accessorFn: (visit) => visit.started_at,
      meta: { text: (visit) => [when(visit.started_at), visit.start_address].filter(Boolean).join(" · ") },
      cell: ({ row: { original: visit } }) => (
        <End
          at={visit.started_at}
          latitude={visit.start_latitude}
          longitude={visit.start_longitude}
          address={visit.start_address}
          accuracy={visit.start_accuracy_metres}
        />
      ),
    },
    {
      id: "out",
      header: "Visit out",
      accessorFn: (visit) => visit.ended_at ?? undefined,
      meta: {
        text: (visit) =>
          visit.ended_at ? [when(visit.ended_at), visit.end_address].filter(Boolean).join(" · ") : "—",
      },
      cell: ({ row: { original: visit } }) =>
        visit.ended_at ? (
          <End
            at={visit.ended_at}
            latitude={visit.end_latitude}
            longitude={visit.end_longitude}
            address={visit.end_address}
            accuracy={visit.end_accuracy_metres}
          />
        ) : (
          <span className="text-muted-foreground">Not yet</span>
        ),
    },
    {
      id: "duration",
      header: "Time there",
      accessorFn: (visit) => visit.duration_minutes ?? undefined,
      meta: {
        cellClassName: "tabular-nums",
        text: (visit) => (visit.duration_minutes !== null ? formatMinutes(visit.duration_minutes) : "—"),
      },
      cell: ({ row: { original: visit } }) =>
        visit.duration_minutes !== null ? formatMinutes(visit.duration_minutes) : "—",
    },
    {
      id: "selfie",
      header: "Selfie",
      enableSorting: false,
      meta: { text: (visit) => (visit.has_photo ? "Yes" : "No") },
      cell: ({ row: { original: visit } }) =>
        visit.has_photo ? (
          <PhotoButton
            path={`/attendance/visits/${visit.id}/photo`}
            title={`${visit.employee_name ?? ""} at ${visit.client_name}`}
            description={`Taken at visit in, ${when(visit.started_at)}. Nothing checks the face; look at it yourself.`}
            alt={`Selfie of ${visit.employee_name ?? "the person"} at ${visit.client_name}`}
            label="View"
          />
        ) : (
          "—"
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <DataTable
        title="Client visits"
        description={
          data
            ? `${data.total} ${data.total === 1 ? "visit" : "visits"} by ${data.people} ${data.people === 1 ? "person" : "people"}, ${from === to ? formatDay(from, true) : `${formatDay(from)} – ${formatDay(to, true)}`}.`
            : "Visit in and visit out from the web and the app, with where and for how long."
        }
        actions={
          <Button variant="outline" size="sm" className="h-9" onClick={reload} disabled={rangeProblem !== null}>
            <RefreshCw /> Refresh
          </Button>
        }
        filters={
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <DatePicker
                aria-label="From"
                value={from}
                onChange={(value) => setFrom(value ?? "")}
                max={today}
                className="h-9 w-40"
                required
              />
              <span className="text-sm text-muted-foreground">to</span>
              <DatePicker
                aria-label="To"
                value={to}
                onChange={(value) => setTo(value ?? "")}
                min={from || undefined}
                max={today}
                className="h-9 w-40"
                required
              />
              <Button size="sm" variant="outline" className="h-9" onClick={() => { setFrom(today); setTo(today); }}>
                Today
              </Button>
              <Button size="sm" variant="outline" className="h-9" onClick={() => { setFrom(shiftDays(today, -6)); setTo(today); }}>
                Last 7 days
              </Button>
              <Button size="sm" variant="outline" className="h-9" onClick={() => { setFrom(today.slice(0, 8) + "01"); setTo(today); }}>
                This month
              </Button>
            </div>
            {rangeProblem && <p className="text-xs text-destructive">{rangeProblem}</p>}
          </div>
        }
        columns={columns}
        data={visits}
        getRowId={(visit) => visit.id}
        noun="visits"
        exportName={`client-visits-${from}-to-${to}`}
        onExport={(selected) =>
          setExporting({ ids: selected ? [...new Set(selected.map((visit) => visit.employee_id))] : null })
        }
        searchPlaceholder="Search person or client"
        isLoading={isLoading && !data}
        error={error?.detail}
        onRetry={reload}
        filtered={from !== today || to !== today}
        empty={{
          icon: Briefcase,
          title: "No visits today",
          description: "When someone presses Visit in on the web or the app, the visit shows here.",
        }}
        emptyMessage="No visits in these dates. Try a wider period or another search."
      />

      {visits.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Card tier="tier1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="size-4 text-primary" /> Where people visited
              </CardTitle>
              <CardDescription>
                Each visit-in point. Green: on the visit now; red: visit finished.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AttendanceMap
                className="h-96"
                places={settings.data?.work_locations ?? []}
                live={null}
                points={points}
              />
            </CardContent>
          </Card>
          <Card tier="tier1">
            <CardHeader>
              <CardTitle>Visits per person</CardTitle>
              <CardDescription>How many visits each person made in the period, and the time spent at them.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col divide-y divide-border">
                {perPerson.map((person) => (
                  <li key={`${person.name}-${person.code}`} className="flex items-center justify-between gap-3 py-2">
                    <PersonCell name={person.name} subtitle={person.code ?? undefined} size="sm" />
                    <span className="flex shrink-0 flex-col items-end text-sm tabular-nums">
                      <span className="font-semibold">
                        {person.visits} {person.visits === 1 ? "visit" : "visits"}
                      </span>
                      <span className="text-xs text-muted-foreground">{formatMinutes(person.minutes)} there</span>
                    </span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      )}

      <AttendanceExportDialog
        open={exporting !== null}
        onOpenChange={(open) => {
          if (!open) setExporting(null);
        }}
        today={today}
        people={exporting?.ids ?? null}
        filters={{}}
        fixedKind="visits"
        withOrgFilters={exporting?.ids === null}
        scopeText={
          exporting?.ids
            ? `${exporting.ids.length} ticked ${exporting.ids.length === 1 ? "person" : "people"}`
            : "Everyone you can review"
        }
      />
    </div>
  );
}
