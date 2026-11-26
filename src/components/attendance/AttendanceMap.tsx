"use client";

import { Loader2, LocateFixed } from "lucide-react";
import dynamic from "next/dynamic";
import React, { useCallback, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  onLocate,
  locating = false,
  ...props
}: Omit<React.ComponentProps<typeof LeafletCanvas>, "focusKey"> & {
  className?: string;
  /**
   * Show the "find my location" button (as on Google Maps): it calls this,
   * and the map centres on the fix that comes back.
   */
  onLocate?: () => Promise<unknown> | void;
  locating?: boolean;
}) {
  const [useGoogle, setUseGoogle] = useState(googleMapsMayWork);
  const fallBack = useCallback(() => setUseGoogle(false), []);
  // Bumped after each locate, so the map centres on the person even when the
  // fix has not moved.
  const [focusKey, setFocusKey] = useState(0);

  const locate = async () => {
    if (!onLocate) return;
    await onLocate();
    setFocusKey((key) => key + 1);
  };

  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-lg border border-border bg-muted",
        className,
      )}
    >
      {useGoogle ? (
        <GoogleCanvas {...props} focusKey={focusKey} onFail={fallBack} className="size-full" />
      ) : (
        <>
          <LeafletCanvas {...props} focusKey={focusKey} className="size-full" />
          <FallbackNote />
        </>
      )}
      {onLocate && (
        <div className="absolute right-2 bottom-6 z-[1000]">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="size-10 rounded-full bg-card shadow-md"
                onClick={() => void locate()}
                disabled={locating}
                aria-label="Find my location"
              >
                {locating ? <Loader2 className="animate-spin" /> : <LocateFixed className="text-primary" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Find my location</TooltipContent>
          </Tooltip>
        </div>
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
