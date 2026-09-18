import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Where `/api/v1/*` is forwarded. The browser never calls the API host itself.
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
 * Content-Security-Policy for the portal.
 *
 * - Scripts only from this origin. `'unsafe-inline'` is needed for the inline
 *   bootstrap scripts Next.js emits; `'unsafe-eval'` only in development, for
 *   fast refresh.
 * - The browser may talk to this origin and the API, nothing else.
 * - Documents such as offer letters are previewed in a sandboxed iframe
 *   (`srcdoc` or a blob), never injected into the page.
 * - Nobody may frame the portal.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin}${isDev ? " ws://localhost:* http://localhost:*" : ""}`,
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
  // Employee photos and document thumbnails are served from Supabase Storage.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${apiTarget}/api/v1/:path*` }];
  },
};

export default nextConfig;
