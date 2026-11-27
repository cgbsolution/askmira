"use client";

import { ExternalLink, Loader2, LocateFixed, MapPin, MapPinOff } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AllowLocationButton } from "@/components/ui/allow-location-button";
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

/**
 * The accuracy a workspace asks for when it has not set one: none (off), any
 * location is taken. Office desktops have no GPS and report 100 m to a few km.
 */
export const DEFAULT_ACCURACY_METRES: number | null = null;
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

const BLOCKED_TEXT = "Location is off for this site.";

/** How often a blocked page checks whether location has been allowed since. */
const BLOCKED_RECHECK_MS = 3_000;

function failureText(failure: GeolocationPositionError, watching: boolean): string {
  if (failure.code === failure.PERMISSION_DENIED) return BLOCKED_TEXT;
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
 *
 * Live both ways, with no reload: blocking location clears the fix (so a
 * required punch switches off at once), and allowing it again is noticed
 * within seconds, when the tab regains focus, or when the browser reports the
 * change. A fix that arrived is proof location is allowed, so a slower,
 * out-of-date "denied" from the Permissions API never overrides it.
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
    // A fix in this run: location is allowed, whatever a stale check says.
    let fixed = false;
    const accept = (found: GeolocationPosition) => {
      if (!alive) return;
      fixed = true;
      setPosition({
        latitude: found.coords.latitude,
        longitude: found.coords.longitude,
        accuracy: found.coords.accuracy,
        at: Date.now(),
      });
      setError(null);
      setProblem(null);
    };
    const block = () => {
      if (!alive) return;
      fixed = false;
      // The old fix no longer stands: nothing can be recorded until it is allowed.
      setPosition(null);
      setError(BLOCKED_TEXT);
      setProblem("blocked");
    };
    // One fix straight away: a watch can take a while to report its first.
    navigator.geolocation.getCurrentPosition(
      accept,
      (failure) => {
        if (failure.code === failure.PERMISSION_DENIED) block();
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
    const id = navigator.geolocation.watchPosition(
      accept,
      (failure) => {
        if (!alive) return;
        if (failure.code === failure.PERMISSION_DENIED) {
          block();
          return;
        }
        setError(failureText(failure, true));
        setProblem(problemOf(failure));
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
    // When the person changes the site's location permission (the icon in
    // the address bar), start again at once: no reload needed.
    let status: PermissionStatus | null = null;
    const onChange = () => {
      if (!alive || !status) return;
      if (status.state === "denied") block();
      else setAttempt((n) => n + 1);
    };
    navigator.permissions
      ?.query({ name: "geolocation" as PermissionName })
      .then((found) => {
        if (!alive) return;
        status = found;
        if (found.state === "denied" && !fixed) block();
        found.addEventListener("change", onChange);
      })
      .catch(() => {});
    return () => {
      alive = false;
      navigator.geolocation.clearWatch(id);
      status?.removeEventListener("change", onChange);
    };
  }, [enabled, attempt]);

  // While blocked, keep checking: not every browser reports the change (Chrome
  // shows "Reload this page" instead), so ask quietly every few seconds and
  // whenever the person comes back to the tab. A blocked site is never shown
  // a prompt by this, so it costs nothing until location is allowed.
  useEffect(() => {
    if (!enabled || problem !== "blocked") return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    let alive = true;
    const check = () => {
      navigator.geolocation.getCurrentPosition(
        () => {
          if (alive) setAttempt((n) => n + 1);
        },
        () => {},
        { enableHighAccuracy: false, maximumAge: 60_000, timeout: 10_000 },
      );
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    const timer = window.setInterval(check, BLOCKED_RECHECK_MS);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, problem]);

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
          if (failure.code === failure.PERMISSION_DENIED) setPosition(null);
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

/** The computer's own location switch, where a page may open it (the browser asks first). */
function systemSettingsLink(): string | null {
  if (typeof navigator === "undefined") return null;
  const agent = navigator.userAgent;
  if (/windows/i.test(agent)) return "ms-settings:privacy-location";
  if (/macintosh|mac os x/i.test(agent) && navigator.maxTouchPoints <= 1) {
    return "x-apple.systempreferences:com.apple.preference.security?Privacy_LocationServices";
  }
  return null;
}

/**
 * When there is no location: one line and one button.
 *
 * Blocked for the site: "Allow location", which in Chrome and Edge is the
 * browser's own location button and shows its permission prompt even after an
 * earlier Block. Where the browser still refuses (other browsers, after
 * Block), one line says where the switch is.
 * The device's location off: "Turn on location", which opens the computer's
 * location settings on Windows and Mac, otherwise tries again.
 */
export function LocationHelp({
  live,
  what,
}: {
  live: Pick<LivePositionState, "position" | "problem" | "locating" | "locate">;
  /** What stays off until the location is found, e.g. "Punch in and Punch out". */
  what: string;
}) {
  // The plain button was pressed and the browser still said no.
  const [refused, setRefused] = useState(false);
  const [settings, setSettings] = useState<string | null>(null);
  useEffect(() => setSettings(systemSettingsLink()), []);
  useEffect(() => {
    if (live.problem !== "blocked") setRefused(false);
  }, [live.problem]);

  // A fix on screen: a later hiccup in the watch is not worth a panel.
  if (!live.problem || (live.position && live.problem !== "blocked")) return null;

  if (live.problem === "blocked") {
    const ask = async () => {
      const fix = await live.locate();
      setRefused(fix === null);
    };
    return (
      <Alert variant="destructive">
        <MapPinOff />
        <AlertTitle>Location is off</AlertTitle>
        <AlertDescription>
          <p>{what} stay off until you allow your location.</p>
          <AllowLocationButton
            className="mt-2"
            busy={live.locating}
            onRequest={() => void ask()}
            onLocation={() => void live.locate()}
          />
          {refused && (
            <p className="mt-1" role="status">
              Your browser has blocked it for this site: click the icon at the left of the address
              bar and set Location to Allow.
            </p>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  const turnOn = settings && live.problem === "unavailable";
  return (
    <Alert variant={live.problem === "unavailable" ? "destructive" : "warning"}>
      <MapPinOff />
      <AlertTitle>
        {live.problem === "unavailable" ? "Location is off on this device" : "Still finding your location"}
      </AlertTitle>
      <AlertDescription>
        <p>{what} stay off until your location is found.</p>
        {turnOn ? (
          <Button asChild size="sm" className="mt-2 w-fit">
            <a href={settings}>
              <LocateFixed /> Turn on location
            </a>
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            className="mt-2 w-fit"
            onClick={() => void live.locate()}
            disabled={live.locating}
          >
            {live.locating ? <Loader2 className="animate-spin" /> : <LocateFixed />} Try again
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

/**
 * Whether a fix is good enough to record: there is one, and the browser says
 * it is within `needed` metres (null: any fix will do). The words say what to
 * do when it is not.
 */
export function fixReadiness(
  live: Pick<LivePositionState, "position" | "error" | "locating">,
  needed: number | null,
): { ready: boolean; text: string } {
  if (!live.position) {
    return {
      ready: false,
      text: live.error ?? "Finding your location…",
    };
  }
  const accuracy = Math.round(live.position.accuracy);
  if (needed !== null && accuracy > needed) {
    return {
      ready: false,
      text: `Location found to ±${formatDistance(accuracy)}; your company needs it within ${formatDistance(needed)}. On a phone, turn on precise location or step near a window. A computer has no GPS: ask HR to allow a wider area. Then press the locate button.`,
    };
  }
  return { ready: true, text: `Location found (±${formatDistance(accuracy)})` };
}
