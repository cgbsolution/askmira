"use client";

import "leaflet/dist/leaflet.css";

import { latLngBounds, type LatLngExpression } from "leaflet";
import React, { useEffect } from "react";
import { Circle, CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";

import type { WorkLocationPin } from "@/lib/types/attendance";

export type MapPointKind = "in" | "out" | "person" | "person-away";

export interface MapPoint {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  kind: MapPointKind;
}

export interface LivePosition {
  latitude: number;
  longitude: number;
  /** Metres, as the browser reports it. */
  accuracy: number;
}

/** Centre of India, for a map with nothing on it yet. */
const INDIA: LatLngExpression = [22.5, 79];

// Colours come from the theme tokens through classes: a class on an SVG path
// outranks the stroke/fill attributes Leaflet writes.
const POINT_CLASS: Record<MapPointKind, string> = {
  in: "stroke-card fill-success",
  out: "stroke-card fill-marigold-500",
  person: "stroke-card fill-primary",
  "person-away": "stroke-card fill-marigold-500",
};

/** Frame everything on the map; a lone point gets a street-level zoom. */
function FitToContent({
  places,
  points,
  live,
}: {
  places: WorkLocationPin[];
  points: MapPoint[];
  live: LivePosition | null;
}) {
  const map = useMap();
  const key = JSON.stringify([
    places.map((p) => [p.latitude, p.longitude, p.radius_metres]),
    points.map((p) => [p.latitude, p.longitude]),
    live ? [Math.round(live.latitude * 1e4), Math.round(live.longitude * 1e4)] : null,
  ]);
  useEffect(() => {
    const coords: [number, number][] = [
      ...places.map((p) => [p.latitude, p.longitude] as [number, number]),
      ...points.map((p) => [p.latitude, p.longitude] as [number, number]),
      ...(live ? [[live.latitude, live.longitude] as [number, number]] : []),
    ];
    if (coords.length === 0) {
      map.setView(INDIA, 4);
    } else if (coords.length === 1) {
      map.setView(coords[0], 16);
    } else {
      map.fitBounds(latLngBounds(coords), { padding: [32, 32], maxZoom: 17 });
    }
    // Only when what is on the map changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);
  return null;
}

/**
 * The map itself. Loaded only in the browser (see `AttendanceMap`): Leaflet
 * touches `window` on import.
 */
export default function AttendanceMapCanvas({
  places,
  points,
  live,
  className,
}: {
  places: WorkLocationPin[];
  points: MapPoint[];
  live: LivePosition | null;
  className?: string;
}) {
  return (
    <MapContainer
      center={INDIA}
      zoom={4}
      scrollWheelZoom={false}
      className={className}
      attributionControl
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
      />
      {places.map((place) => (
        <Circle
          key={`${place.name}-${place.latitude}-${place.longitude}`}
          center={[place.latitude, place.longitude]}
          radius={place.radius_metres}
          pathOptions={{
            className: "stroke-primary fill-primary",
            weight: 1.5,
            fillOpacity: 0.08,
            dashArray: "4 4",
          }}
        >
          <Tooltip>
            {place.name} · {place.radius_metres} m radius
          </Tooltip>
        </Circle>
      ))}
      {live && (
        <>
          <Circle
            center={[live.latitude, live.longitude]}
            radius={Math.min(live.accuracy, 2000)}
            pathOptions={{
              className: "stroke-brand-400 fill-brand-400",
              weight: 1,
              fillOpacity: 0.12,
            }}
          />
          <CircleMarker
            center={[live.latitude, live.longitude]}
            radius={8}
            pathOptions={{ className: "stroke-card fill-brand-600", weight: 3, fillOpacity: 1 }}
          >
            <Tooltip permanent direction="top" offset={[0, -8]}>
              You are here
            </Tooltip>
          </CircleMarker>
        </>
      )}
      {points.map((point) => (
        <CircleMarker
          key={point.id}
          center={[point.latitude, point.longitude]}
          radius={7}
          pathOptions={{ className: POINT_CLASS[point.kind], weight: 2, fillOpacity: 1 }}
        >
          <Tooltip direction="top" offset={[0, -6]}>
            {point.label}
          </Tooltip>
        </CircleMarker>
      ))}
      <FitToContent places={places} points={points} live={live} />
    </MapContainer>
  );
}
