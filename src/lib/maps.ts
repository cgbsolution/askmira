/**
 * Which map the portal draws, and loading Google Maps.
 *
 * The setting and the key live on the API (`MAPS_PROVIDER`,
 * `GOOGLE_MAPS_API_KEY` in the backend's .env); the portal asks
 * `GET /attendance/map-config` once per page load. Nothing is configured here.
 *
 * Google Maps is the first choice. Leaflet (OpenStreetMap tiles) is the
 * fallback: when the API says "leaflet" (no key, or switched off), or when
 * Google fails in the browser — script blocked or offline, slow to load, or
 * the key refused (wrong referrer, API not enabled or not allowed, billing off).
 */

import { get } from "@/lib/api";

interface MapConfig {
  provider: "google" | "leaflet";
  google_maps_api_key: string | null;
}

/** Give up on Google and draw Leaflet after this long. */
const LOAD_TIMEOUT_MS = 10_000;

let loading: Promise<typeof google.maps> | null = null;
let failed = false;
let failureReason: string | null = null;
const failureListeners = new Set<() => void>();

function markFailed(reason: string) {
  failed = true;
  failureReason ??= reason;
  failureListeners.forEach((listener) => listener());
}

/** Why the free map is drawn instead of Google's, in words an admin can act on. */
export function googleMapsFailureReason(): string | null {
  return failureReason;
}

/** False once Google has failed on this page load; Leaflet from then on. */
export function googleMapsMayWork(): boolean {
  return !failed;
}

/**
 * Called when Google rejects the key after the map has already been drawn
 * (Google then greys the map out). Returns an unsubscribe function.
 */
export function onGoogleMapsFailure(listener: () => void): () => void {
  failureListeners.add(listener);
  return () => failureListeners.delete(listener);
}

declare global {
  interface Window {
    gm_authFailure?: () => void;
    __askmiraMapsReady?: () => void;
  }
}

function injectScript(key: string): Promise<typeof google.maps> {
  return new Promise<typeof google.maps>((resolve, reject) => {
    const fail = (reason: string) => {
      window.clearTimeout(timer);
      markFailed(reason);
      reject(new Error(reason));
    };
    const timer = window.setTimeout(() => fail("Google Maps took too long to load"), LOAD_TIMEOUT_MS);

    // Google calls this global for a refused key, at load or later.
    window.gm_authFailure = () =>
      fail("Google refused the key: allow this site and the Maps JavaScript API on it in Google Cloud");

    window.__askmiraMapsReady = async () => {
      try {
        await Promise.all([google.maps.importLibrary("core"), google.maps.importLibrary("maps")]);
        if (failed) return;
        window.clearTimeout(timer);
        resolve(google.maps);
      } catch {
        fail("Google Maps libraries did not load");
      }
    };

    const script = document.createElement("script");
    const params = new URLSearchParams({
      key,
      v: "weekly",
      loading: "async",
      callback: "__askmiraMapsReady",
      region: "IN",
    });
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.onerror = () => fail("Google Maps script could not be loaded");
    document.head.appendChild(script);
  });
}

/**
 * Loads the Maps JavaScript API once per page; later calls share it. Rejects
 * when Google is not configured on the API or cannot be used — draw Leaflet.
 */
export function loadGoogleMaps(): Promise<typeof google.maps> {
  if (failed) return Promise.reject(new Error("Google Maps unavailable"));
  if (loading) return loading;

  loading = get<MapConfig>("/attendance/map-config")
    .catch(() => null)
    .then((config) => {
      const key = config?.provider === "google" ? config.google_maps_api_key?.trim() : "";
      if (!key) {
        const reason = config
          ? "the Google Maps key is not set on the AskMiraa server (GOOGLE_MAPS_API_KEY)"
          : "the map settings could not be read";
        markFailed(reason);
        throw new Error(reason);
      }
      return injectScript(key);
    });
  return loading;
}
