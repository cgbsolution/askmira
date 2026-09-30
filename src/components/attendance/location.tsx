"use client";

import { ExternalLink, MapPin, MapPinOff } from "lucide-react";
import React from "react";

import { Button } from "@/components/ui/button";
import type { Punch } from "@/lib/types/attendance";
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
