"use client";

import {
  CalendarOff,
  Clock,
  Fingerprint,
  Loader2,
  LogIn,
  LogOut,
  MapPin,
  Palmtree,
} from "lucide-react";
import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/common/EmptyState";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { MyAttendancePeriod, Punch, PunchInput } from "@/lib/types/attendance";
import { cn, formatDay, toISODate } from "@/lib/utils";

import { errorDetail, formatClock, formatMinutes, LoadError, shortTime } from "./shared";

// A punch-in older than this is a forgotten punch-out, not a shift in
// progress: the next punch is an IN again, and the day goes to regularisation.
const OPEN_SHIFT_HOURS = 20;

type PositionResult =
  | { ok: true; latitude: number; longitude: number }
  | { ok: false; reason: string };

/** Asked only when the person clicks, and only if they chose to share. */
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
              ? "Location permission was denied."
              : error.code === error.TIMEOUT
                ? "Your location took too long to find."
                : "Your location was not available.",
        }),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  });
}

interface PunchOutcome {
  punch: Punch;
  locationSent: boolean;
  locationProblem: string | null;
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

/** Re-render every `ms` while `active`, for a live clock. */
function useTicker(active: boolean, ms: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [active, ms]);
  return now;
}

/**
 * Punch in and out, with today's shift and time worked so far.
 *
 * The next direction comes from the last punch, not from today's list: a night
 * shift that punched in yesterday evening must see "Punch out" after midnight.
 * `compact` is the Home dashboard's version — the same punch, less detail.
 */
export function PunchCard({
  onPunched,
  compact = false,
}: {
  onPunched?: () => void;
  compact?: boolean;
}) {
  const today = toISODate(new Date());
  const yesterday = toISODate(new Date(Date.now() - 86_400_000));
  const punchesQuery = useApiQuery<Punch[]>(
    `/attendance/punches?from=${yesterday}&to=${today}`,
  );
  const periodQuery = useApiQuery<MyAttendancePeriod>(
    `/attendance/period?from=${today}&to=${today}`,
  );
  const [shareLocation, setShareLocation] = useState(false);
  const [isPunching, setIsPunching] = useState(false);
  const [outcome, setOutcome] = useState<PunchOutcome | null>(null);

  const punches = useMemo(
    () =>
      [...(punchesQuery.data ?? [])].sort((a, b) => a.punched_at.localeCompare(b.punched_at)),
    [punchesQuery.data],
  );
  const last = punches.at(-1);
  const lastIsOpen =
    last?.direction === "in" &&
    Date.now() - new Date(last.punched_at).getTime() < OPEN_SHIFT_HOURS * 3_600_000;
  const nextDirection = lastIsOpen ? "out" : "in";

  // Today's punches, plus an IN still open from last night.
  const shown = useMemo(() => {
    const todays = punches.filter((p) => toISODate(new Date(p.punched_at)) === today);
    if (lastIsOpen && last && !todays.includes(last)) return [last, ...todays];
    return todays;
  }, [punches, today, lastIsOpen, last]);

  const now = useTicker(lastIsOpen, 30_000);
  const worked = workedSoFar(shown, now);

  const period = periodQuery.data;
  const shift = period?.shift_today ?? null;
  const holiday = period?.holidays.find((h) => h.holiday_date === period.today);
  const leave = period?.leaves.find(
    (l) => l.leave_date === period.today && l.status === "approved",
  );
  const weekOff =
    shift !== null && period !== null && shift.weekly_off_days.includes(isoWeekday(today));

  const punch = async () => {
    setIsPunching(true);
    const direction = nextDirection;
    let locationProblem: string | null = null;
    // Coordinates live only in this call: sent once, never kept in state or storage.
    const body: PunchInput = { direction };
    if (shareLocation) {
      const position = await requestPosition();
      if (position.ok) {
        body.latitude = position.latitude;
        body.longitude = position.longitude;
      } else {
        locationProblem = position.reason;
      }
    }
    const locationSent = body.latitude !== undefined;
    try {
      const created = await post<Punch>("/attendance/punch", body);
      setOutcome({ punch: created, locationSent, locationProblem });
      toast.success(
        `Punched ${created.direction} at ${formatClock(created.punched_at)}`,
        locationProblem
          ? { description: `${locationProblem} The punch was recorded without a location.` }
          : undefined,
      );
      punchesQuery.reload();
      periodQuery.reload();
      onPunched?.();
    } catch (caught) {
      toast.error(errorDetail(caught, "Could not record the punch."));
    } finally {
      setIsPunching(false);
    }
  };

  const isLoading = punchesQuery.isLoading && !punchesQuery.data;
  const error = punchesQuery.error;

  const punchButton = (
    <Button
      onClick={() => void punch()}
      disabled={isPunching || isLoading || error !== null}
      variant={nextDirection === "in" ? "default" : "outline"}
      size={compact ? "default" : "lg"}
      className={cn(!compact && "min-w-36")}
    >
      {isPunching ? (
        <Loader2 className="animate-spin" />
      ) : nextDirection === "in" ? (
        <LogIn />
      ) : (
        <LogOut />
      )}
      {nextDirection === "in" ? "Punch in" : "Punch out"}
    </Button>
  );

  const statusLine = !last
    ? "You have not punched today."
    : lastIsOpen
      ? `Punched in since ${formatClock(last.punched_at)}.`
      : shown.length > 0
        ? `Punched out at ${formatClock(last.punched_at)}.`
        : "You have not punched today.";

  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <Clock className="size-4 text-primary" />
          {compact ? "Attendance today" : "Today"}
          {lastIsOpen && <Badge variant="success">Working</Badge>}
        </CardTitle>
        <CardDescription>
          {formatDay(today, true)}
          {shift && (
            <>
              {" · "}
              {shift.name} {shortTime(shift.start_time)}–{shortTime(shift.end_time)}
              {period?.shift_today_is_default && " (default)"}
            </>
          )}
        </CardDescription>
        <CardAction>{punchButton}</CardAction>
      </CardHeader>

      <CardContent className="space-y-4">
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
        {period?.has_no_shift && !compact && (
          <Alert variant="warning">
            <CalendarOff />
            <AlertTitle>No shift applies to you</AlertTitle>
            <AlertDescription>
              Your punches are recorded, but your days cannot be judged present or absent until HR
              assigns you a shift or sets a default shift for the company.
            </AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : error ? (
          <LoadError error={error} onRetry={punchesQuery.reload} />
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <p className="text-sm text-foreground">{statusLine}</p>
              {shown.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  Worked so far{" "}
                  <span className="text-lg font-semibold tabular-nums text-foreground">
                    {formatMinutes(worked)}
                  </span>
                </p>
              )}
            </div>

            {shown.length === 0 ? (
              !compact && (
                <EmptyState
                  icon={Fingerprint}
                  className="py-6"
                  title="No punches today"
                  description="Punches from this screen, the mobile app and biometric devices appear here once recorded."
                />
              )
            ) : (
              <ul className="flex flex-wrap gap-2">
                {shown.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm"
                  >
                    <Badge variant={row.direction === "in" ? "success" : "secondary"}>
                      {row.direction === "in" ? "In" : "Out"}
                    </Badge>
                    <span className="font-medium tabular-nums">{formatClock(row.punched_at)}</span>
                    {!compact && (
                      <span className="text-xs text-muted-foreground">
                        {row.source.replace("_", " ")}
                      </span>
                    )}
                    {row.outside_geofence && <Badge variant="warning">Outside geofence</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {compact ? (
          <Button asChild variant="link" className="h-auto px-0">
            <Link href="/time/attendance">Open my attendance</Link>
          </Button>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2.5">
              <div>
                <Label htmlFor="share-location" className="flex items-center gap-1.5">
                  <MapPin className="size-4" /> Share my location with this punch
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Your browser asks when you punch. If you decline, the punch is still recorded,
                  without a location.
                </p>
              </div>
              <Switch
                id="share-location"
                checked={shareLocation}
                onCheckedChange={setShareLocation}
                disabled={isPunching}
              />
            </div>
            {outcome && <PunchOutcomeNote outcome={outcome} />}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function isoWeekday(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  const weekday = new Date(year, month - 1, day).getDay();
  return weekday === 0 ? 7 : weekday;
}

function PunchOutcomeNote({ outcome }: { outcome: PunchOutcome }) {
  const { punch, locationSent, locationProblem } = outcome;
  if (punch.outside_geofence) {
    return (
      <Alert variant="warning">
        <MapPin />
        <AlertTitle>Recorded and flagged for HR, not rejected</AlertTitle>
        <AlertDescription>
          Your {punch.direction} punch at {formatClock(punch.punched_at)} was outside every work
          location&apos;s radius
          {punch.nearest_location_metres !== null && (
            <>
              {" "}
              (nearest is{" "}
              <span className="tabular-nums">
                {punch.nearest_location_metres.toLocaleString("en-IN")} m
              </span>{" "}
              away)
            </>
          )}
          . HR can see the flag.
        </AlertDescription>
      </Alert>
    );
  }
  if (locationSent) {
    return (
      <Alert variant="success">
        <MapPin />
        <AlertTitle>Recorded with your location</AlertTitle>
        <AlertDescription>
          Your {punch.direction} punch at {formatClock(punch.punched_at)} was not flagged as
          outside a work location.
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <Alert>
      <MapPin />
      <AlertTitle>Recorded without a location</AlertTitle>
      <AlertDescription>
        {locationProblem
          ? `${locationProblem} Your ${punch.direction} punch at ${formatClock(punch.punched_at)} was still recorded.`
          : `Your ${punch.direction} punch at ${formatClock(punch.punched_at)} was recorded. You chose not to share a location.`}
      </AlertDescription>
    </Alert>
  );
}
