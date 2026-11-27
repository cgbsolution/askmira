"use client";

import { Loader2, LocateFixed } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type GeolocationElement = HTMLElement & {
  position?: GeolocationPosition | null;
  error?: GeolocationPositionError | null;
};

/** Chrome 144+ draws its own location button (`<geolocation>`). */
function hasGeolocationElement(): boolean {
  return typeof window !== "undefined" && "HTMLGeolocationElement" in window;
}

/**
 * One button that asks the browser for location access.
 *
 * In Chrome and Edge 144+ it is the browser's own location button: a click on
 * it shows the browser's permission prompt, even for a site the person blocked
 * before (a website's own button cannot). Its label and icon are the
 * browser's. Elsewhere it is a plain button that asks through the Geolocation
 * API, which shows the prompt whenever the browser still allows one.
 *
 * `onLocation` gets the position once the browser hands one over;
 * `onRequest` is the fallback's click.
 */
function AllowLocationButton({
  onLocation,
  onRequest,
  busy = false,
  className,
}: {
  onLocation: (position: GeolocationPosition) => void;
  onRequest: () => void;
  busy?: boolean;
  className?: string;
}) {
  const [native, setNative] = React.useState(false);
  const ref = React.useRef<GeolocationElement | null>(null);
  const latest = React.useRef(onLocation);
  latest.current = onLocation;

  React.useEffect(() => setNative(hasGeolocationElement()), []);

  React.useEffect(() => {
    const element = ref.current;
    if (!native || !element) return;
    const handle = () => {
      if (element.position) latest.current(element.position);
    };
    element.addEventListener("location", handle);
    return () => element.removeEventListener("location", handle);
  }, [native]);

  if (native) {
    // The browser's own control: it renders its label and icon itself and
    // ignores children. Opacity must stay 1 and contrast at least 3:1.
    return React.createElement("geolocation", {
      ref,
      accuracymode: "precise",
      "data-slot": "allow-location-button",
      className: cn(
        "rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground",
        className,
      ),
    });
  }
  return (
    <Button
      type="button"
      size="sm"
      data-slot="allow-location-button"
      className={cn("w-fit", className)}
      onClick={onRequest}
      disabled={busy}
    >
      {busy ? <Loader2 className="animate-spin" /> : <LocateFixed />} Allow location
    </Button>
  );
}

export { AllowLocationButton };
