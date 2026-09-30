"use client";

import {
  CalendarOff,
  Clock,
  Fingerprint,
  Loader2,
  LogIn,
  LogOut,
  MapPin,
  MapPinOff,
  Palmtree,
} from "lucide-react";
import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/common/EmptyState";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type {
  AttendanceSettingsRead,
  MyAttendancePeriod,
  Punch,
  PunchInput,
  ShiftBrief,
} from "@/lib/types/attendance";
import { cn, toISODate } from "@/lib/utils";

import { AttendanceMap, type MapPoint } from "./AttendanceMap";
import { formatDistance, nearestPlace, PunchLocation, useLivePosition } from "./location";
import { errorDetail, formatClock, formatMinutes, LoadError, shortTime } from "./shared";

// A punch-in older than this is a forgotten punch-out, not a shift in
// progress: the next punch is an IN again, and the day goes to regularisation.
const OPEN_SHIFT_HOURS = 20;
const SHARE_PREFERENCE_KEY = "askmira.punch.shareLocation";

type PositionResult =
  | { ok: true; latitude: number; longitude: number }
  | { ok: false; reason: string };

/** Asked only when the person punches. */
function requestPosition(): Promise<PositionResult> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({ ok: false, reason: "This browser cannot share a location." });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          ok: true,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      (error) =>
        resolve({
          ok: false,
          reason:
            error.code === error.PERMISSION_DENIED
              ? "Location access is blocked for this site. Allow it from the lock icon in the address bar."
              : error.code === error.TIMEOUT
                ? "Your location took too long to find."
                : "Your location was not available.",
        }),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 },
    );
  });
}

function readSharePreference(): boolean {
  try {
    return window.localStorage.getItem(SHARE_PREFERENCE_KEY) !== "false";
  } catch {
    return true;
  }
}

function writeSharePreference(value: boolean) {
  try {
    window.localStorage.setItem(SHARE_PREFERENCE_KEY, String(value));
  } catch {
    // A private window or blocked storage: the choice lasts this visit only.
  }
}

/** Minutes worked from paired punches, counting an open IN up to `now`. */
function workedSoFar(punches: Punch[], now: number): number {
  let total = 0;
  let openIn: number | null = null;
  for (const punch of punches) {
    const at = new Date(punch.punched_at).getTime();
    if (punch.direction === "in") {
      openIn = at;
    } else if (openIn !== null) {
      total += at - openIn;
      openIn = null;
    }
  }
  if (openIn !== null) total += now - openIn;
  return Math.max(0, Math.floor(total / 60_000));
}

function minutesOf(hhmm: string): number {
  const [hours, minutes] = hhmm.split(":").map(Number);
  return hours * 60 + minutes;
}

/** The shift's scheduled working minutes: start to end, less the break. */
function scheduledMinutes(shift: ShiftBrief): number {
  let span = minutesOf(shift.end_time) - minutesOf(shift.start_time);
  if (span <= 0) span += 24 * 60;
  return Math.max(0, span - shift.break_minutes);
}

/** Minutes late against the shift start and its grace, from the first IN today. */
function lateBy(shift: ShiftBrief, firstIn: Punch | undefined): number {
  if (!firstIn) return 0;
  const at = new Date(firstIn.punched_at);
  const arrived = at.getHours() * 60 + at.getMinutes();
  const late = arrived - minutesOf(shift.start_time);
  return late > shift.grace_in_minutes ? late : 0;
}

function isoWeekday(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  const weekday = new Date(year, month - 1, day).getDay();
  return weekday === 0 ? 7 : weekday;
}

/** Re-render every `ms`, for a live clock. */
function useNow(ms: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}

const clockFormat = new Intl.DateTimeFormat("en-IN", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});
const dayFormat = new Intl.DateTimeFormat("en-IN", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

/**
 * Punch in and out: a live clock, today's shift and how much of it is worked,
 * where each punch was made, and the button.
 *
 * Location follows the company's rule (Shifts & rosters → Work locations):
 * off, optional (on unless the person turns it off; the choice is remembered)
 * or required (the punch waits for a location). The next direction comes from
 * the last punch, not from today's list, so a night shift that punched in
 * yesterday evening sees "Punch out" after midnight. `compact` is Home's version.
 */
export function PunchCard({
  onPunched,
  compact = false,
}: {
  onPunched?: () => void;
  compact?: boolean;
}) {
  const now = useNow(1_000);
  const today = toISODate(new Date(now));
  const yesterday = toISODate(new Date(now - 86_400_000));
  const punchesQuery = useApiQuery<Punch[]>(`/attendance/punches?from=${yesterday}&to=${today}`);
  const periodQuery = useApiQuery<MyAttendancePeriod>(
    `/attendance/period?from=${today}&to=${today}`,
  );
  const settingsQuery = useApiQuery<AttendanceSettingsRead>("/attendance/settings");
  const [sharePreference, setSharePreference] = useState(true);
  const [isPunching, setIsPunching] = useState(false);
  const [locationProblem, setLocationProblem] = useState<string | null>(null);

  useEffect(() => setSharePreference(readSharePreference()), []);

  const mode = settingsQuery.data?.location_mode ?? "optional";
  const shareLocation = mode === "required" || (mode === "optional" && sharePreference);
  const places = settingsQuery.data?.work_locations ?? [];
  const live = useLivePosition(shareLocation && settingsQuery.data !== null);
  const livePlace = live.position
    ? nearestPlace(live.position.latitude, live.position.longitude, places)
    : null;

  const punches = useMemo(
    () =>
      [...(punchesQuery.data ?? [])].sort((a, b) => a.punched_at.localeCompare(b.punched_at)),
    [punchesQuery.data],
  );
  const last = punches.at(-1);
  const lastIsOpen =
    last?.direction === "in" &&
    now - new Date(last.punched_at).getTime() < OPEN_SHIFT_HOURS * 3_600_000;
  const nextDirection = lastIsOpen ? "out" : "in";

  // Today's punches, plus an IN still open from last night.
  const shown = useMemo(() => {
    const todays = punches.filter((p) => toISODate(new Date(p.punched_at)) === today);
    if (lastIsOpen && last && !todays.includes(last)) return [last, ...todays];
    return todays;
  }, [punches, today, lastIsOpen, last]);

  const worked = workedSoFar(shown, now);
  const period = periodQuery.data;
  const shift = period?.shift_today ?? null;
  const scheduled = shift ? scheduledMinutes(shift) : 0;
  const progress = scheduled > 0 ? Math.min(100, (worked / scheduled) * 100) : 0;
  const firstIn = shown.find((p) => p.direction === "in");
  const late = shift ? lateBy(shift, firstIn) : 0;
  const holiday = period?.holidays.find((h) => h.holiday_date === period.today);
  const leave = period?.leaves.find((l) => l.leave_date === period.today && l.status === "approved");
  const weekOff = shift !== null && shift.weekly_off_days.includes(isoWeekday(today));

  const toggleShare = (value: boolean) => {
    setSharePreference(value);
    writeSharePreference(value);
  };

  const punch = async () => {
    setIsPunching(true);
    setLocationProblem(null);
    // Coordinates live only in this call: sent once, never kept in state or storage.
    // From the portal, with or without a location, it is a web punch.
    const body: PunchInput = { direction: nextDirection, source: "web" };
    if (shareLocation) {
      const fresh = live.position && Date.now() - live.position.at < 60_000 ? live.position : null;
      const position: PositionResult = fresh
        ? { ok: true, latitude: fresh.latitude, longitude: fresh.longitude }
        : await requestPosition();
      if (position.ok) {
        body.latitude = position.latitude;
        body.longitude = position.longitude;
      } else if (mode === "required") {
        setLocationProblem(position.reason);
        toast.error("Your company needs your location to record a punch.", {
          description: position.reason,
        });
        setIsPunching(false);
        return;
      } else {
        setLocationProblem(position.reason);
      }
    }
    try {
      const created = await post<Punch>("/attendance/punch", body);
      const where = created.location_label
        ? created.outside_geofence
          ? `${formatDistance(created.nearest_location_metres ?? 0)} from ${created.location_label}`
          : `at ${created.location_label}`
        : body.latitude !== undefined
          ? "with your location"
          : "without a location";
      toast.success(`Punched ${created.direction} at ${formatClock(created.punched_at)}`, {
        description: created.outside_geofence
          ? `Recorded ${where} — outside every work location, so HR sees it flagged.`
          : `Recorded ${where}.`,
      });
      punchesQuery.reload();
      periodQuery.reload();
      onPunched?.();
    } catch (caught) {
      toast.error(errorDetail(caught, "Could not record the punch."));
    } finally {
      setIsPunching(false);
    }
  };

  const mapPoints: MapPoint[] = shown
    .filter((row) => row.latitude !== null && row.longitude !== null)
    .map((row) => ({
      id: row.id,
      latitude: row.latitude as number,
      longitude: row.longitude as number,
      label: `${row.direction === "in" ? "In" : "Out"} ${formatClock(row.punched_at)}`,
      kind: row.direction,
    }));
  const showMap = !compact && (mode !== "off" || mapPoints.length > 0);

  const isLoading = punchesQuery.isLoading && !punchesQuery.data;
  const error = punchesQuery.error;

  const status = !last || shown.length === 0
    ? { label: "Not punched in", variant: "outline" as const }
    : lastIsOpen
      ? { label: "Working", variant: "success" as const }
      : { label: "Punched out", variant: "secondary" as const };

  const locationLine =
    mode === "off" ? null : mode === "required" ? (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <MapPin className="size-3.5 text-primary" /> Your location is recorded with each punch
      </p>
    ) : (
      <div className="flex items-center gap-2">
        <Switch
          id={compact ? "share-location-home" : "share-location"}
          checked={sharePreference}
          onCheckedChange={toggleShare}
          disabled={isPunching}
        />
        <Label
          htmlFor={compact ? "share-location-home" : "share-location"}
          className="flex items-center gap-1 text-xs font-normal text-muted-foreground"
        >
          {sharePreference ? <MapPin className="size-3.5" /> : <MapPinOff className="size-3.5" />}
          {sharePreference ? "Share location" : "Location off"}
        </Label>
      </div>
    );

  return (
    <Card tier="tier1" className="gap-0 py-0">
      <CardContent className={cn("grid gap-5 p-5", !compact && "lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center lg:gap-8 lg:p-6")}>
        {/* Clock */}
        <div className="flex flex-col gap-1">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Clock className="size-3.5" /> {dayFormat.format(new Date(now))}
          </p>
          <p className="font-display text-3xl font-semibold tabular-nums tracking-tight text-foreground">
            {clockFormat.format(new Date(now))}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={status.variant}>{status.label}</Badge>
            {shift && (
              <Badge variant="outline">
                {shift.name} · {shortTime(shift.start_time)}–{shortTime(shift.end_time)}
              </Badge>
            )}
            {late > 0 && <Badge variant="warning">Late by {formatMinutes(late)}</Badge>}
          </div>
        </div>

        {/* Progress through the shift */}
        <div className="flex min-w-0 flex-col gap-2">
          {isLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : error ? (
            <LoadError error={error} onRetry={punchesQuery.reload} />
          ) : (
            <>
              <div className="flex items-end justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Worked today{" "}
                  <span className="text-2xl font-semibold tabular-nums text-foreground">
                    {formatMinutes(worked)}
                  </span>
                  {scheduled > 0 && <span className="tabular-nums"> of {formatMinutes(scheduled)}</span>}
                </p>
                <p className="text-right text-xs text-muted-foreground tabular-nums">
                  {firstIn ? `In ${formatClock(firstIn.punched_at)}` : "No punch yet"}
                  {last && !lastIsOpen && shown.length > 0 ? ` · Out ${formatClock(last.punched_at)}` : ""}
                </p>
              </div>
              <Progress value={progress} className="h-2.5" aria-label="Share of today's shift worked" />
              {shift && (
                <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
                  <span>{shortTime(shift.start_time)}</span>
                  <span>{shortTime(shift.end_time)}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Punch */}
        <div className="flex flex-col items-stretch gap-2 lg:max-w-60 lg:items-end">
          <Button
            onClick={() => void punch()}
            disabled={isPunching || isLoading || error !== null}
            variant={nextDirection === "in" ? "default" : "outline"}
            size="lg"
            className="min-w-40"
          >
            {isPunching ? <Loader2 className="animate-spin" /> : nextDirection === "in" ? <LogIn /> : <LogOut />}
            {isPunching && shareLocation ? "Locating…" : nextDirection === "in" ? "Punch in" : "Punch out"}
          </Button>
          {locationLine}
          {shareLocation && (
            <p className="text-xs text-muted-foreground lg:text-right">
              {live.position
                ? livePlace
                  ? livePlace.beyond <= 0
                    ? `Inside ${livePlace.place.name}`
                    : `${formatDistance(livePlace.beyond)} from ${livePlace.place.name}`
                  : `Location found (±${Math.round(live.position.accuracy)} m)`
                : (live.error ?? "Finding your location…")}
            </p>
          )}
        </div>
      </CardContent>

      {(holiday || leave || weekOff || period?.has_no_shift || locationProblem) && (
        <CardContent className="grid gap-3 px-5 pb-5 lg:px-6">
          {locationProblem && (
            <Alert variant="warning">
              <MapPinOff />
              <AlertTitle>
                {mode === "required" ? "Punch not recorded" : "Punched without a location"}
              </AlertTitle>
              <AlertDescription>{locationProblem}</AlertDescription>
            </Alert>
          )}
          {(holiday || leave || weekOff) && (
            <Alert>
              {leave ? <Palmtree /> : <CalendarOff />}
              <AlertTitle>
                {holiday
                  ? `Holiday: ${holiday.name}`
                  : leave
                    ? `You are on ${leave.leave_type}${leave.is_half_day ? " (half day)" : ""}`
                    : "Today is your week off"}
              </AlertTitle>
              <AlertDescription>
                You can still punch if you are working — it is recorded like any other day.
              </AlertDescription>
            </Alert>
          )}
          {period?.has_no_shift && (
            <Alert variant="warning">
              <CalendarOff />
              <AlertTitle>No shift applies to you</AlertTitle>
              <AlertDescription>
                Your punches are recorded, but a day cannot be judged present or absent until HR
                assigns you a shift or sets a default shift.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      )}

      {!compact && !isLoading && !error && (
        <>
          <Separator />
          <CardContent
            className={cn(
              "grid gap-5 px-5 py-4 lg:px-6",
              showMap && "lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]",
            )}
          >
            {showMap && (
              <AttendanceMap
                className="h-72 lg:h-80"
                places={places}
                points={mapPoints}
                live={live.position}
              />
            )}
            <div className="min-w-0">
            <p className="mb-3 text-sm font-medium">Today&apos;s punches</p>
            {shown.length === 0 ? (
              <EmptyState
                icon={Fingerprint}
                className="py-4"
                title="No punches today"
                description="Punches from this screen, the mobile app and biometric devices appear here."
              />
            ) : (
              <ol className={cn("grid gap-2", showMap ? "grid-cols-1" : "sm:grid-cols-2 xl:grid-cols-3")}>
                {shown.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-start gap-3 rounded-lg border border-border px-3 py-2.5"
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                        row.direction === "in" ? "bg-mint-100 text-mint-800" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {row.direction === "in" ? <LogIn className="size-4" /> : <LogOut className="size-4" />}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 text-sm">
                        <span className="font-semibold tabular-nums">{formatClock(row.punched_at)}</span>
                        <span className="text-muted-foreground">
                          {row.direction === "in" ? "In" : "Out"} · {row.source.replace("_", " ")}
                        </span>
                      </span>
                      <PunchLocation punch={row} />
                    </span>
                  </li>
                ))}
              </ol>
            )}
            </div>
          </CardContent>
        </>
      )}

      {compact && (
        <CardContent className="px-5 pb-4">
          <Button asChild variant="link" className="h-auto px-0">
            <Link href="/time/attendance">Open my attendance</Link>
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
