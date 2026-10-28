"use client";

import React, { useEffect, useRef, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { loadGoogleMaps, onGoogleMapsFailure } from "@/lib/maps";
import type { WorkLocationPin } from "@/lib/types/attendance";
import { cn } from "@/lib/utils";

import type { LivePosition, MapPoint, MapPointKind } from "./AttendanceMapCanvas";

/** Centre of India, for a map with nothing on it yet. */
const INDIA = { lat: 22.5, lng: 79 };

const DOT_CLASS: Record<MapPointKind, string> = {
  in: "size-3.5 border-2 bg-success",
  out: "size-3.5 border-2 bg-marigold-500",
  person: "size-3.5 border-2 bg-primary",
  "person-away": "size-3.5 border-2 bg-marigold-500",
};
const LIVE_DOT_CLASS = "size-4 border-[3px] bg-brand-600";

const LABEL_CLASS =
  "pointer-events-none absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs font-medium text-popover-foreground shadow-md";

/**
 * A theme colour as the browser resolves it (light or dark), for the parts of
 * Google Maps that take a colour string rather than a class.
 */
function tokenColour(className: string): string {
  const probe = document.createElement("span");
  probe.className = className;
  probe.style.display = "none";
  document.body.appendChild(probe);
  const colour = getComputedStyle(probe).color;
  probe.remove();
  return colour;
}

interface HtmlOverlay extends google.maps.OverlayView {
  setPosition(position: google.maps.LatLngLiteral): void;
  setVisible(visible: boolean): void;
}

/** An HTML element pinned to a map position, styled with theme classes. */
function htmlOverlay(
  maps: typeof google.maps,
  position: google.maps.LatLngLiteral,
  element: HTMLElement,
): HtmlOverlay {
  class Overlay extends maps.OverlayView implements HtmlOverlay {
    private at = position;
    onAdd() {
      this.getPanes()?.overlayMouseTarget.appendChild(element);
    }
    draw() {
      const point = this.getProjection()?.fromLatLngToDivPixel(this.at);
      if (!point) return;
      element.style.left = `${point.x}px`;
      element.style.top = `${point.y}px`;
    }
    onRemove() {
      element.remove();
    }
    setPosition(next: google.maps.LatLngLiteral) {
      this.at = next;
      this.draw();
    }
    setVisible(visible: boolean) {
      element.style.display = visible ? "" : "none";
    }
  }
  return new Overlay();
}

/** A round marker with a label on hover or keyboard focus (or always shown). */
function dotElement(dotClass: string, label: string, permanent = false): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "group absolute -translate-x-1/2 -translate-y-1/2 outline-none";
  wrap.tabIndex = 0;
  wrap.setAttribute("role", "img");
  wrap.setAttribute("aria-label", label);
  const dot = document.createElement("div");
  dot.className = `rounded-full border-card shadow-sm group-focus-visible:ring-2 group-focus-visible:ring-ring ${dotClass}`;
  const text = document.createElement("div");
  text.className = permanent
    ? LABEL_CLASS
    : `${LABEL_CLASS} hidden group-hover:block group-focus-visible:block`;
  text.textContent = label;
  wrap.append(dot, text);
  return wrap;
}

/**
 * The attendance map drawn with Google Maps. Calls `onFail` if Google cannot
 * be used, so the caller can draw the Leaflet map instead.
 */
export default function AttendanceMapGoogle({
  places,
  points,
  live,
  className,
  onFail,
}: {
  places: WorkLocationPin[];
  points: MapPoint[];
  live: LivePosition | null;
  className?: string;
  onFail: () => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const [ready, setReady] = useState(false);

  // Load Google and create the map once.
  useEffect(() => {
    let cancelled = false;
    const unsubscribe = onGoogleMapsFailure(() => {
      if (!cancelled) onFail();
    });
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !container.current) return;
        mapRef.current = new maps.Map(container.current, {
          center: INDIA,
          zoom: 4,
          // Scrolling the page must not zoom the map; Ctrl/⌘ + scroll does.
          gestureHandling: "cooperative",
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        });
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) onFail();
      });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [onFail]);

  // Draw geofences, punches and the live position.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const maps = google.maps;
    const drawn: { setMap(map: google.maps.Map | null): void }[] = [];

    const primary = tokenColour("text-primary");
    const live400 = tokenColour("text-brand-400");

    const hoverText = document.createElement("div");
    hoverText.className = "absolute";
    const hoverLabel = document.createElement("div");
    hoverLabel.className = LABEL_CLASS;
    hoverText.appendChild(hoverLabel);
    const hover = htmlOverlay(maps, INDIA, hoverText);
    hover.setVisible(false);
    hover.setMap(map);
    drawn.push(hover);

    for (const place of places) {
      const circle = new maps.Circle({
        map,
        center: { lat: place.latitude, lng: place.longitude },
        radius: place.radius_metres,
        strokeColor: primary,
        strokeWeight: 1.5,
        strokeOpacity: 0.9,
        fillColor: primary,
        fillOpacity: 0.08,
      });
      const text = `${place.name} · ${place.radius_metres} m radius`;
      circle.addListener("mousemove", (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        hoverLabel.textContent = text;
        hover.setPosition(e.latLng.toJSON());
        hover.setVisible(true);
      });
      circle.addListener("mouseout", () => hover.setVisible(false));
      drawn.push(circle);
    }

    if (live) {
      drawn.push(
        new maps.Circle({
          map,
          center: { lat: live.latitude, lng: live.longitude },
          radius: Math.min(live.accuracy, 2000),
          strokeColor: live400,
          strokeWeight: 1,
          strokeOpacity: 0.8,
          fillColor: live400,
          fillOpacity: 0.12,
          clickable: false,
        }),
      );
      const you = htmlOverlay(
        maps,
        { lat: live.latitude, lng: live.longitude },
        dotElement(LIVE_DOT_CLASS, "You are here", true),
      );
      you.setMap(map);
      drawn.push(you);
    }

    for (const point of points) {
      const dot = htmlOverlay(
        maps,
        { lat: point.latitude, lng: point.longitude },
        dotElement(DOT_CLASS[point.kind], point.label),
      );
      dot.setMap(map);
      drawn.push(dot);
    }

    return () => drawn.forEach((item) => item.setMap(null));
  }, [ready, places, points, live]);

  // Frame everything; a lone point gets a street-level zoom. Only when what
  // is on the map moves, not on every render.
  const frameKey = JSON.stringify([
    places.map((p) => [p.latitude, p.longitude, p.radius_metres]),
    points.map((p) => [p.latitude, p.longitude]),
    live ? [Math.round(live.latitude * 1e4), Math.round(live.longitude * 1e4)] : null,
  ]);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const coords: google.maps.LatLngLiteral[] = [
      ...places.map((p) => ({ lat: p.latitude, lng: p.longitude })),
      ...points.map((p) => ({ lat: p.latitude, lng: p.longitude })),
      ...(live ? [{ lat: live.latitude, lng: live.longitude }] : []),
    ];
    if (coords.length === 0) {
      map.setCenter(INDIA);
      map.setZoom(4);
    } else if (coords.length === 1) {
      map.setCenter(coords[0]);
      map.setZoom(16);
    } else {
      const bounds = new google.maps.LatLngBounds();
      coords.forEach((c) => bounds.extend(c));
      map.fitBounds(bounds, 32);
      google.maps.event.addListenerOnce(map, "idle", () => {
        if ((map.getZoom() ?? 0) > 17) map.setZoom(17);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, frameKey]);

  return (
    <div className={cn("relative", className)}>
      <div ref={container} className="size-full" />
      {!ready && <Skeleton className="absolute inset-0 rounded-none" />}
    </div>
  );
}
