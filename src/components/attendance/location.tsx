"use client";

import { ExternalLink, MapPin, MapPinOff } from "lucide-react";
import React, { useEffect, useState } from "react";

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

/** OpenStreetMap at the punch's coordinates. A link only: nothing loads until clicked. */
export function mapUrl(latitude: number, longitude: number): string {
  const lat = latitude.toFixed(6);
  const lon = longitude.toFixed(6);
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`;
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
    <span
      className={cn(
        "inline-flex flex-wrap items-center gap-1 text-xs",
        punch.outside_geofence ? "text-mustard-900 dark:text-mustard-100" : "text-muted-foreground",
        className,
      )}
    >
      <MapPin className="size-3.5" />
      {text}
      {punch.latitude !== null && punch.longitude !== null && (
        <Button asChild variant="link" className="h-auto p-0 text-xs">
          <a href={mapUrl(punch.latitude, punch.longitude)} target="_blank" rel="noopener noreferrer">
            Map <ExternalLink className="size-3" />
          </a>
        </Button>
      )}
    </span>
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

export interface LivePositionState {
  position: { latitude: number; longitude: number; accuracy: number; at: number } | null;
  error: string | null;
}

/**
 * Where the browser says this person is, kept current while `enabled`.
 * Asks for permission the first time; stops watching when disabled or unmounted.
 */
export function useLivePosition(enabled: boolean): LivePositionState {
  const [state, setState] = useState<LivePositionState>({ position: null, error: null });
  useEffect(() => {
    if (!enabled) {
      setState({ position: null, error: null });
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ position: null, error: "This browser cannot share a location." });
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (found) =>
        setState({
          position: {
            latitude: found.coords.latitude,
            longitude: found.coords.longitude,
            accuracy: found.coords.accuracy,
            at: Date.now(),
          },
          error: null,
        }),
      (failure) =>
        setState((current) => ({
          position: current.position,
          error:
            failure.code === failure.PERMISSION_DENIED
              ? "Location access is blocked for this site. Allow it from the lock icon in the address bar."
              : failure.code === failure.TIMEOUT
                ? "Still finding your location…"
                : "Your location is not available right now.",
        })),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [enabled]);
  return state;
}
