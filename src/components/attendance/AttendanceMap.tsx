"use client";

import dynamic from "next/dynamic";
import React, { useCallback, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { googleMapsFailureReason, googleMapsMayWork } from "@/lib/maps";
import { cn } from "@/lib/utils";

export type { LivePosition, MapPoint, MapPointKind } from "./AttendanceMapCanvas";

/**
 * An attendance map: work-location geofences, punches and (optionally) where
 * the person is right now.
 *
 * Google Maps first; Leaflet (OpenStreetMap) when the API has no Google key
 * or Google fails to load (see `lib/maps.ts`). Both are client-only and loaded after the
 * page, with a placeholder of the same size.
 */
const LeafletCanvas = dynamic(() => import("./AttendanceMapCanvas"), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-lg" />,
});
const GoogleCanvas = dynamic(() => import("./AttendanceMapGoogle"), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-lg" />,
});

export function AttendanceMap({
  className,
  ...props
}: React.ComponentProps<typeof LeafletCanvas> & { className?: string }) {
  const [useGoogle, setUseGoogle] = useState(googleMapsMayWork);
  const fallBack = useCallback(() => setUseGoogle(false), []);

  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-lg border border-border bg-muted",
        className,
      )}
    >
      {useGoogle ? (
        <GoogleCanvas {...props} onFail={fallBack} className="size-full" />
      ) : (
        <>
          <LeafletCanvas {...props} className="size-full" />
          <FallbackNote />
        </>
      )}
    </div>
  );
}

/** On the free map: says Google Maps is not in use, and why when it is known. */
function FallbackNote() {
  const reason = googleMapsFailureReason();
  return (
    <div className="pointer-events-none absolute top-2 left-2 z-[1000]">
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="pointer-events-auto bg-card/95 shadow-xs">
            OpenStreetMap
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-72">
          {reason ? `Google Maps is not shown: ${reason}.` : "Google Maps is not shown on this page."}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
