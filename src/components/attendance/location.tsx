"use client";

import { ExternalLink, Loader2, LocateFixed, MapPin, MapPinOff } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { Punch, WorkLocationPin } from "@/lib/types/attendance";
import { cn } from "@/lib/utils";

/** 850 → "850 m", 2340 → "2.3 km". */
export function formatDistance(metres: number): string {
  const value = Math.abs(metres);
  return value >= 1000 ? `${(value / 1000).toFixed(1)} km` : `${Math.round(value)} m`;
}

/**
 * Where a punch was made, in words: "At Bengaluru HQ", "2.3 km from
 * Bengaluru HQ", "Location shared" (no work locations set up to compare
 * against), or null when no location was shared.
 */
export function punchLocationText(punch: Pick<Punch, "latitude" | "location_label" | "outside_geofence" | "nearest_location_metres">): string | null {
  if (punch.latitude === null || punch.latitude === undefined) return null;
  if (!punch.location_label) return "Location shared";
  if (!punch.outside_geofence) return `At ${punch.location_label}`;
  const beyond = punch.nearest_location_metres;
  return beyond !== null && beyond !== undefined
    ? `${formatDistance(beyond)} from ${punch.location_label}`
    : `Away from ${punch.location_label}`;
}

/** Google Maps at the punch's coordinates. A link only: nothing loads until clicked. */
export function mapUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
}

/** One punch's location: where, whether it was outside every work location, and a map link. */
export function PunchLocation({ punch, className }: { punch: Punch; className?: string }) {
  const text = punchLocationText(punch);
  if (!text) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", className)}>
        <MapPinOff className="size-3.5" /> No location
      </span>
    );
  }
  return (
    <span className={cn("inline-flex flex-col gap-0.5 text-xs", className)}>
      <span
        className={cn(
          "inline-flex flex-wrap items-center gap-1",
          punch.outside_geofence ? "text-marigold-900 dark:text-marigold-100" : "text-muted-foreground",
        )}
      >
        <MapPin className="size-3.5" />
        {text}
        {punch.latitude !== null && punch.longitude !== null && (
          <MapLink latitude={punch.latitude} longitude={punch.longitude} />
        )}
      </span>
      {punch.address && <span className="pl-[18px] text-muted-foreground">{punch.address}</span>}
    </span>
  );
}

/** "Map ↗": the point in Google Maps, in a new tab. */
export function MapLink({ latitude, longitude }: { latitude: number; longitude: number }) {
  return (
    <Button asChild variant="link" className="h-auto p-0 text-xs">
      <a href={mapUrl(latitude, longitude)} target="_blank" rel="noopener noreferrer">
        Map <ExternalLink className="size-3" />
      </a>
    </Button>
  );
}

const EARTH_RADIUS_METRES = 6_371_000;

/** Great-circle distance in metres; the same formula the API uses for geofences. */
export function haversineMetres(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dPhi = toRad(lat2 - lat1);
  const dLambda = toRad(lon2 - lon1);
  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLambda / 2) ** 2;
  return 2 * EARTH_RADIUS_METRES * Math.asin(Math.sqrt(a));
}

/** The work location whose edge is nearest, and how far beyond it (negative inside). */
export function nearestPlace(
  latitude: number,
  longitude: number,
  places: WorkLocationPin[],
): { place: WorkLocationPin; beyond: number } | null {
  let best: { place: WorkLocationPin; beyond: number } | null = null;
  for (const place of places) {
    const beyond =
      haversineMetres(latitude, longitude, place.latitude, place.longitude) - place.radius_metres;
    if (!best || beyond < best.beyond) best = { place, beyond };
  }
  return best;
}

/** The accuracy a workspace asks for when it has not set one (metres). */
export const DEFAULT_ACCURACY_METRES = 100;
/** A fix older than this is asked for again before it is recorded. */
export const FRESH_FIX_MS = 60_000;

export interface LiveFix {
  latitude: number;
  longitude: number;
  /** Metres, as the browser reports it. */
  accuracy: number;
  /** When the fix arrived (ms since epoch). */
  at: number;
}

/**
 * Why there is no location: the person blocked it for this site, the device's
 * location is off (or no fix came), or it is taking long.
 */
export type LocationProblem = "blocked" | "unavailable" | "slow" | null;

export interface LivePositionState {
  position: LiveFix | null;
  error: string | null;
  problem: LocationProblem;
  /** True while a "find me now" request (the map's locate button) is running. */
  locating: boolean;
  /** Ask the browser for a fresh, high-accuracy fix now; resolves to it, or null. */
  locate: () => Promise<LiveFix | null>;
}

function problemOf(failure: GeolocationPositionError): LocationProblem {
  if (failure.code === failure.PERMISSION_DENIED) return "blocked";
  if (failure.code === failure.TIMEOUT) return "slow";
  return "unavailable";
}

function failureText(failure: GeolocationPositionError, watching: boolean): string {
  if (failure.code === failure.PERMISSION_DENIED) {
    return "Location access is blocked for this site. Allow it from the lock icon in the address bar, then press the locate button.";
  }
  if (failure.code === failure.TIMEOUT) {
    return watching ? "Still finding your location…" : "Your location took too long to find. Try again.";
  }
  return "Your location is not available right now. Turn on location for this device and try again.";
}

/**
 * Where the browser says this person is, kept current while `enabled`.
 * Asks for permission the first time; stops watching when disabled or unmounted.
 * `locate()` asks for a fresh high-accuracy fix at once, like the "my
 * location" button on Google Maps.
 */
export function useLivePosition(enabled: boolean): LivePositionState {
  const [position, setPosition] = useState<LiveFix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [problem, setProblem] = useState<LocationProblem>(null);
  const [locating, setLocating] = useState(false);
  // Bumped when the person allows location in the browser, to start again.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setPosition(null);
      setError(null);
      setProblem(null);
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("This browser cannot share a location.");
      setProblem("unavailable");
      return;
    }
    let alive = true;
    const accept = (found: GeolocationPosition) => {
      if (!alive) return;
      setPosition({
        latitude: found.coords.latitude,
        longitude: found.coords.longitude,
        accuracy: found.coords.accuracy,
        at: Date.now(),
      });
      setError(null);
      setProblem(null);
    };
    // One fix straight away: a watch can take a while to report its first.
    navigator.geolocation.getCurrentPosition(accept, () => {}, {
      enableHighAccuracy: true,
      maximumAge: 10_000,
      timeout: 20_000,
    });
    const id = navigator.geolocation.watchPosition(
      accept,
      (failure) => {
        if (!alive) return;
        setError(failureText(failure, true));
        setProblem(problemOf(failure));
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
    // When the person changes the site's location permission (the lock icon
    // in the address bar), start again at once: no reload needed.
    let status: PermissionStatus | null = null;
    const onChange = () => {
      if (!alive || !status) return;
      if (status.state === "denied") setProblem("blocked");
      else setAttempt((n) => n + 1);
    };
    navigator.permissions
      ?.query({ name: "geolocation" as PermissionName })
      .then((found) => {
        if (!alive) return;
        status = found;
        if (found.state === "denied") {
          setProblem("blocked");
          setError(
            "Location access is blocked for this site. Allow it from the lock icon in the address bar, then press Try again.",
          );
        }
        found.addEventListener("change", onChange);
      })
      .catch(() => {});
    return () => {
      alive = false;
      navigator.geolocation.clearWatch(id);
      status?.removeEventListener("change", onChange);
    };
  }, [enabled, attempt]);

  const locate = useCallback((): Promise<LiveFix | null> => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("This browser cannot share a location.");
      return Promise.resolve(null);
    }
    setLocating(true);
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (found) => {
          const fix = {
            latitude: found.coords.latitude,
            longitude: found.coords.longitude,
            accuracy: found.coords.accuracy,
            at: Date.now(),
          };
          setPosition(fix);
          setError(null);
          setProblem(null);
          setLocating(false);
          resolve(fix);
        },
        (failure) => {
          setError(failureText(failure, false));
          setProblem(problemOf(failure));
          setLocating(false);
          resolve(null);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
      );
    });
  }, []);

  return { position, error, problem, locating, locate };
}

/**
 * What to do when there is no location, with a Try again button. A website
 * cannot open the browser's or the computer's settings, nor ask again once
 * the person pressed Block, so this says exactly where to click.
 */
export function LocationHelp({
  live,
  what,
}: {
  live: Pick<LivePositionState, "position" | "problem" | "locating" | "locate">;
  /** What stays off until the location is found, e.g. "Punch in and Punch out". */
  what: string;
}) {
  // A fix on screen: a later hiccup in the watch is not worth a panel.
  if (!live.problem || (live.position && live.problem !== "blocked")) return null;
  const retry = (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="mt-2 w-fit"
      onClick={() => void live.locate()}
      disabled={live.locating}
    >
      {live.locating ? <Loader2 className="animate-spin" /> : <LocateFixed />} Try again
    </Button>
  );
  if (live.problem === "blocked") {
    return (
      <Alert variant="destructive">
        <MapPinOff />
        <AlertTitle>Location is blocked for this site</AlertTitle>
        <AlertDescription>
          <p>{what} stay off until you allow your location:</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-4">
            <li>Click the icon at the left of the address bar (a lock or two sliders).</li>
            <li>Find Location (under Site settings or Permissions) and choose Allow.</li>
            <li>Come back here. The page notices on its own, or press Try again.</li>
          </ol>
          {retry}
        </AlertDescription>
      </Alert>
    );
  }
  if (live.problem === "unavailable") {
    return (
      <Alert variant="destructive">
        <MapPinOff />
        <AlertTitle>Your location could not be found</AlertTitle>
        <AlertDescription>
          <p>{what} stay off until it is found. Turn on location for this device:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            <li>Windows: Settings → Privacy &amp; security → Location → turn on Location services and &quot;Let desktop apps access your location&quot;.</li>
            <li>Mac: System Settings → Privacy &amp; Security → Location Services → on, and on for your browser.</li>
            <li>Phone browser: turn on Location (precise) in the quick settings.</li>
          </ul>
          {retry}
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <Alert variant="warning">
      <LocateFixed />
      <AlertTitle>Still finding your location</AlertTitle>
      <AlertDescription>
        <p>{what} unlock as soon as it is found. Near a window or with Wi-Fi on it is quicker.</p>
        {retry}
      </AlertDescription>
    </Alert>
  );
}

/**
 * Whether a fix is good enough to record: there is one, and the browser says
 * it is within `needed` metres. The words say what to do when it is not.
 */
export function fixReadiness(
  live: Pick<LivePositionState, "position" | "error" | "locating">,
  needed: number,
): { ready: boolean; text: string } {
  if (!live.position) {
    return {
      ready: false,
      text: live.error ?? "Finding your location…",
    };
  }
  const accuracy = Math.round(live.position.accuracy);
  if (accuracy > needed) {
    return {
      ready: false,
      text: `Location found to ±${formatDistance(accuracy)}; your company needs it within ${formatDistance(needed)}. Turn on precise location or step near a window, then press the locate button.`,
    };
  }
  return { ready: true, text: `Location found (±${formatDistance(accuracy)})` };
}
