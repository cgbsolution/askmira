import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Where `/api/v1/*` is forwarded (by src/app/api/v1/[...path]/route.ts and,
 * for big uploads, src/middleware.ts). The browser never calls the API host itself.
 *
 * The session lives in `SameSite=Lax` cookies set by the API. When the portal
 * (say `askmira-sand.vercel.app`) and the API (`hrms.epfassist.com`) are
 * different sites, the browser does not send those cookies on the portal's
 * requests — sign-in "succeeds", the next call arrives without a session, and
 * the person is bounced back to sign-in. The page also could not read the CSRF
 * cookie of another site. Proxying through this origin makes every cookie
 * first-party, with no need to loosen `SameSite`.
 *
 * `API_PROXY_TARGET` is read at build time; the existing
 * `NEXT_PUBLIC_API_BASE_URL` still works as the fallback.
 */
const apiTarget = (
  process.env.API_PROXY_TARGET ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:8000"
).replace(/\/+$/, "");
const apiOrigin = new URL(apiTarget).origin;

/**
 * Google Maps for attendance (see `src/lib/maps.ts`). The key and the choice of
 * map are API settings, fetched after sign-in, so Google's hosts are always
 * allowed below; with no key the page simply never contacts them.
 * Google's published allowlist for the Maps JavaScript API (raster maps).
 */
const g = (sources: string) => ` ${sources}`;

/**
 * Content-Security-Policy for the portal.
 *
 * - Scripts only from this origin. `'unsafe-inline'` is needed for the inline
 *   bootstrap scripts Next.js emits; `'unsafe-eval'` only in development, for
 *   fast refresh.
 * - The browser may talk to this origin and the API, nothing else.
 * - Attendance maps: Google Maps (its script, tiles and fonts), and
 *   OpenStreetMap tiles, as images only, for the Leaflet fallback.
 * - Documents such as offer letters are previewed in a sandboxed iframe
 *   (`srcdoc` or a blob), never injected into the page.
 * - Nobody may frame the portal.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}${g("https://maps.googleapis.com https://maps.gstatic.com")}`,
  `style-src 'self' 'unsafe-inline'${g("https://fonts.googleapis.com")}`,
  `img-src 'self' data: blob: https://*.supabase.co https://tile.openstreetmap.org${g("https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.googleusercontent.com")}`,
  `font-src 'self' data:${g("https://fonts.gstatic.com")}`,
  `connect-src 'self' ${apiOrigin}${isDev ? " ws://localhost:* http://localhost:*" : ""}${g("https://*.googleapis.com https://*.google.com https://*.gstatic.com")}`,
  "frame-src 'self' blob:",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Geolocation for the attendance punch geofence; nothing else.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), payment=(), geolocation=(self)" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isDev
    ? []
    : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Server-rendered pages call the API directly; a relative URL has no origin there.
  env: { ASKMIRA_SERVER_API_BASE: apiTarget },
  // Employee photos and document thumbnails are served from Supabase Storage.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Adding people lives on Onboarding → Add employees; old links land there.
  async redirects() {
    return [
      { source: "/people/new", destination: "/onboarding/new", permanent: false },
      { source: "/people/import", destination: "/onboarding/new?tab=excel", permanent: false },
      { source: "/onboarding/import", destination: "/onboarding/new?tab=excel", permanent: false },
    ];
  },
  async rewrites() {
    return [
      // `/api/v1/*` is not rewritten here: src/app/api/v1/[...path]/route.ts
      // forwards it, retrying connections that do not open, and middleware.ts
      // rewrites the few uploads too big for that. A rewrite here would run
      // before the catch-all route and take every request back from it.
      // OAuth discovery for MCP connectors (claude.ai, ChatGPT): they look for it at the
      // root of the address they were given, which is this portal.
      {
        source: "/.well-known/oauth-protected-resource/:path*",
        destination: `${apiTarget}/.well-known/oauth-protected-resource/:path*`,
      },
      {
        source: "/.well-known/oauth-protected-resource",
        destination: `${apiTarget}/.well-known/oauth-protected-resource`,
      },
      {
        source: "/.well-known/oauth-authorization-server",
        destination: `${apiTarget}/.well-known/oauth-authorization-server`,
      },
    ];
  },
};

export default nextConfig;
