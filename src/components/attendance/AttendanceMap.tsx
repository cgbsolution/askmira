"use client";

import dynamic from "next/dynamic";
import React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type { LivePosition, MapPoint, MapPointKind } from "./AttendanceMapCanvas";

/**
 * An attendance map: work-location geofences, punches and (optionally) where
 * the person is right now. Client-only — Leaflet reads `window` on import —
 * so it is loaded after the page, with a placeholder of the same size.
 */
const Canvas = dynamic(() => import("./AttendanceMapCanvas"), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-lg" />,
});

export function AttendanceMap({
  className,
  ...props
}: React.ComponentProps<typeof Canvas> & { className?: string }) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-lg border border-border bg-muted",
        className,
      )}
    >
      <Canvas {...props} className="size-full" />
    </div>
  );
}
