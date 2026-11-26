"use client";

import { Briefcase, Camera, Loader2, LogIn, LogOut, MapPin, X } from "lucide-react";
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
import { HiddenFileInput } from "@/components/ui/file-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type {
  AttendanceSettingsRead,
  FieldVisit,
  FieldVisitList,
} from "@/lib/types/attendance";
import { cn, toISODate } from "@/lib/utils";

import { AttendanceMap, type MapPoint } from "./AttendanceMap";
import {
  DEFAULT_ACCURACY_METRES,
  fixReadiness,
  formatDistance,
  FRESH_FIX_MS,
  LocationHelp,
  MapLink,
  useLivePosition,
} from "./location";
import { PhotoButton } from "./PunchPhoto";
import { errorDetail, formatClock, formatMinutes, LoadError } from "./shared";
import { shrinkPhoto } from "./shrinkPhoto";

const NAME_LIMIT = 160;

function useNow(ms: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}

/**
 * Client visits: Visit in when you reach a client, Visit out when you leave.
 *
 * Location is always on here, whatever the punch rule: both buttons stay off
 * until the browser finds you within the workspace's accuracy, and the map's
 * locate button asks again. Visit in also needs who or where it is and a
 * selfie. A visit never changes the day's attendance.
 */
export function FieldVisitCard() {
  const now = useNow(30_000);
  const today = toISODate(new Date(now));
  const yesterday = toISODate(new Date(now - 86_400_000));
  // From yesterday, so a visit left open overnight still offers Visit out.
  const visitsQuery = useApiQuery<FieldVisitList>(
    `/attendance/visits/mine?from=${yesterday}&to=${today}`,
  );
  const settingsQuery = useApiQuery<AttendanceSettingsRead>("/attendance/settings");
  const needed = settingsQuery.data?.location_accuracy_metres ?? DEFAULT_ACCURACY_METRES;
  const live = useLivePosition(true);
  const readiness = fixReadiness(live, needed);

  const [clientName, setClientName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoKey, setPhotoKey] = useState(0);
  const [busy, setBusy] = useState<"in" | "out" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const visits = useMemo(() => visitsQuery.data?.visits ?? [], [visitsQuery.data]);
  const open = visits.find((visit) => visit.ended_at === null) ?? null;
  const todays = visits.filter((visit) => toISODate(new Date(visit.started_at)) === today);
  const shown = open && !todays.includes(open) ? [open, ...todays] : todays;

  const clearPhoto = () => {
    setPhoto(null);
    setPhotoKey((key) => key + 1);
  };

  const takePhoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      setPhoto(await shrinkPhoto(file));
    } catch (caught) {
      clearPhoto();
      toast.error(caught instanceof Error ? caught.message : "The photo could not be used.");
    }
  };

  /** A fix good enough to record, asking again when the one on screen is old. */
  const freshFix = async () => {
    const recent =
      live.position && Date.now() - live.position.at < FRESH_FIX_MS ? live.position : null;
    const fix = recent ?? (await live.locate());
    if (!fix) {
      return { fix: null, reason: "Your location could not be found. Allow location for this site and try again." };
    }
    if (fix.accuracy > needed) {
      return {
        fix: null,
        reason: `Your location is only accurate to ±${formatDistance(fix.accuracy)}; your company needs it within ${formatDistance(needed)}. Press the locate button on the map and try again.`,
      };
    }
    return { fix, reason: null };
  };

  const visitIn = async () => {
    const name = clientName.split(/\s+/).filter(Boolean).join(" ");
    if (!name) {
      setNameError("Say who or where you are visiting.");
      return;
    }
    if (name.length > NAME_LIMIT) {
      setNameError(`Keep it to ${NAME_LIMIT} characters.`);
      return;
    }
    if (!photo) {
      toast.error("Take a selfie at the client's place first.");
      return;
    }
    setBusy("in");
    setProblem(null);
    try {
      const { fix, reason } = await freshFix();
      if (!fix) {
        setProblem(reason);
        return;
      }
      const created = await post<FieldVisit>("/attendance/visits", {
        client_name: name,
        latitude: fix.latitude,
        longitude: fix.longitude,
        accuracy_metres: Math.round(fix.accuracy),
        photo,
        source: "web",
      });
      toast.success(`Visit in at ${created.client_name}`, {
        description: `Recorded at ${formatClock(created.started_at)}.`,
      });
      setClientName("");
      setNameError(null);
      clearPhoto();
      visitsQuery.reload();
    } catch (caught) {
      setProblem(errorDetail(caught, "The visit could not be recorded."));
    } finally {
      setBusy(null);
    }
  };

  const visitOut = async () => {
    if (!open) return;
    setBusy("out");
    setProblem(null);
    try {
      const { fix, reason } = await freshFix();
      if (!fix) {
        setProblem(reason);
        return;
      }
      const closed = await post<FieldVisit>(`/attendance/visits/${open.id}/end`, {
        latitude: fix.latitude,
        longitude: fix.longitude,
        accuracy_metres: Math.round(fix.accuracy),
        source: "web",
      });
      toast.success(`Visit out from ${closed.client_name}`, {
        description: `${formatMinutes(closed.duration_minutes ?? 0)} there.`,
      });
      visitsQuery.reload();
    } catch (caught) {
      setProblem(errorDetail(caught, "The visit out could not be recorded."));
    } finally {
      setBusy(null);
    }
  };

  const points: MapPoint[] = shown.flatMap((visit) => {
    const list: MapPoint[] = [
      {
        id: `${visit.id}-in`,
        latitude: visit.start_latitude,
        longitude: visit.start_longitude,
        label: `${visit.client_name} · in ${formatClock(visit.started_at)}`,
        kind: "in",
      },
    ];
    if (visit.end_latitude !== null && visit.end_longitude !== null) {
      list.push({
        id: `${visit.id}-out`,
        latitude: visit.end_latitude,
        longitude: visit.end_longitude,
        label: `${visit.client_name} · out ${formatClock(visit.ended_at)}`,
        kind: "out",
      });
    }
    return list;
  });

  const locationWait = !readiness.ready;
  const openMinutes = open
    ? Math.max(0, Math.floor((now - new Date(open.started_at).getTime()) / 60_000))
    : 0;

  return (
    <Card tier="tier2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="size-4 text-primary" /> Client visits
        </CardTitle>
        <CardDescription>
          Press Visit in when you reach a client and Visit out when you leave. Your location is
          always recorded; a visit does not change your attendance.
        </CardDescription>
        <CardAction>
          <Badge variant="outline" className="tabular-nums">
            {todays.length} today
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <AttendanceMap
          className="h-72 lg:h-80"
          places={settingsQuery.data?.work_locations ?? []}
          points={points}
          live={live.position}
          onLocate={live.locate}
          locating={live.locating}
        />

        <div className="flex min-w-0 flex-col gap-4">
          <p
            className={cn(
              "flex items-start gap-1.5 text-xs",
              locationWait ? "text-destructive" : "text-muted-foreground",
            )}
            role={locationWait ? "status" : undefined}
          >
            <MapPin className="mt-0.5 size-3.5 shrink-0" />
            <span>
              {readiness.text}
              {locationWait && " Visit in and out unlock once it is found."}
            </span>
          </p>

          <LocationHelp live={live} what="Visit in and Visit out" />

          {visitsQuery.isLoading && !visitsQuery.data ? (
            <Skeleton className="h-32 w-full" />
          ) : visitsQuery.error ? (
            <LoadError error={visitsQuery.error} onRetry={visitsQuery.reload} />
          ) : open ? (
            <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
              <div className="flex items-center gap-2">
                <Badge variant="success">On a visit</Badge>
                <span className="text-xs text-muted-foreground tabular-nums">
                  since {formatClock(open.started_at)} · {formatMinutes(openMinutes)}
                </span>
              </div>
              <p className="text-base font-semibold break-words">{open.client_name}</p>
              <Button
                size="lg"
                onClick={() => void visitOut()}
                disabled={busy !== null || locationWait}
              >
                {busy === "out" ? <Loader2 className="animate-spin" /> : <LogOut />}
                {busy === "out" ? "Locating…" : "Visit out"}
              </Button>
            </div>
          ) : (
            <form
              className="flex flex-col gap-3"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void visitIn();
              }}
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="visit-client">Client or place</Label>
                <Input
                  id="visit-client"
                  value={clientName}
                  maxLength={NAME_LIMIT}
                  placeholder="e.g. Sharma Traders, Lajpat Nagar"
                  aria-invalid={nameError !== null}
                  onChange={(event) => {
                    setClientName(event.target.value);
                    if (nameError) setNameError(null);
                  }}
                  disabled={busy !== null}
                />
                {nameError && <p className="text-xs text-destructive">{nameError}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {photo ? (
                  <>
                    <Badge variant="success">
                      <Camera /> Selfie ready
                    </Badge>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      onClick={clearPhoto}
                      aria-label="Remove the selfie"
                    >
                      <X />
                    </Button>
                  </>
                ) : (
                  <Button type="button" variant="outline" size="sm" asChild>
                    <Label htmlFor="visit-selfie" className="cursor-pointer">
                      <Camera /> Take a selfie
                    </Label>
                  </Button>
                )}
                <HiddenFileInput
                  key={photoKey}
                  id="visit-selfie"
                  accept="image/*"
                  capture="user"
                  shrink={false}
                  maxBytes={false}
                  disabled={busy !== null}
                  onChange={(event) => void takePhoto(event.target.files?.[0])}
                />
              </div>
              <Button type="submit" size="lg" disabled={busy !== null || locationWait}>
                {busy === "in" ? <Loader2 className="animate-spin" /> : <LogIn />}
                {busy === "in" ? "Locating…" : "Visit in"}
              </Button>
            </form>
          )}

          {problem && (
            <Alert variant="warning">
              <MapPin />
              <AlertTitle>Visit not recorded</AlertTitle>
              <AlertDescription>{problem}</AlertDescription>
            </Alert>
          )}
        </div>

        <div className="lg:col-span-2">
          <p className="mb-3 text-sm font-medium">Today&apos;s visits</p>
          {shown.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              className="py-4"
              title="No visits today"
              description="Visits from this screen and the mobile app appear here."
            />
          ) : (
            <ol className="grid gap-2 md:grid-cols-2">
              {shown.map((visit) => (
                <VisitRow key={visit.id} visit={visit} />
              ))}
            </ol>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** One visit: who, when in and out, how long, where, and the selfie. */
export function VisitRow({ visit, showPerson = false }: { visit: FieldVisit; showPerson?: boolean }) {
  return (
    <li className="flex flex-col gap-1.5 rounded-lg border border-border px-3 py-2.5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold break-words">{visit.client_name}</span>
        {visit.ended_at === null ? (
          <Badge variant="success">Open</Badge>
        ) : (
          <Badge variant="outline" className="tabular-nums">
            {formatMinutes(visit.duration_minutes ?? 0)}
          </Badge>
        )}
        {showPerson && visit.employee_name && (
          <span className="text-xs text-muted-foreground">{visit.employee_name}</span>
        )}
      </div>
      <VisitEnd
        label="In"
        at={visit.started_at}
        latitude={visit.start_latitude}
        longitude={visit.start_longitude}
        address={visit.start_address}
        accuracy={visit.start_accuracy_metres}
      />
      {visit.ended_at && (
        <VisitEnd
          label="Out"
          at={visit.ended_at}
          latitude={visit.end_latitude}
          longitude={visit.end_longitude}
          address={visit.end_address}
          accuracy={visit.end_accuracy_metres}
        />
      )}
      {visit.has_photo && (
        <PhotoButton
          path={`/attendance/visits/${visit.id}/photo`}
          title={`${visit.client_name} · ${formatClock(visit.started_at)}`}
          description="The selfie taken at visit in. Nothing checks the face; look at it yourself."
          alt={`Selfie at ${visit.client_name}`}
          label="Selfie"
        />
      )}
    </li>
  );
}

function VisitEnd({
  label,
  at,
  latitude,
  longitude,
  address,
  accuracy,
}: {
  label: string;
  at: string;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  accuracy: number | null;
}) {
  return (
    <span className="flex flex-col gap-0.5 text-xs text-muted-foreground">
      <span className="flex flex-wrap items-center gap-1">
        <span className="font-medium text-foreground tabular-nums">
          {label} {formatClock(at)}
        </span>
        {accuracy !== null && <span>· ±{formatDistance(accuracy)}</span>}
        {latitude !== null && longitude !== null && (
          <>
            · <MapLink latitude={latitude} longitude={longitude} />
          </>
        )}
      </span>
      {address && <span className="break-words">{address}</span>}
    </span>
  );
}
