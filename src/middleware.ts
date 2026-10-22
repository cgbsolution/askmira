import { NextResponse, type NextRequest } from "next/server";

/**
 * Tells the API who is really calling.
 *
 * `/api/v1/*` is proxied to the API (see next.config.ts), so to the API every
 * request comes from one of Vercel's addresses: sign-in rate limits run out for
 * everybody at once, and the audit log and IP allowlists see Vercel. With
 * `PROXY_SHARED_SECRET` set, the request is forwarded with the address Vercel
 * saw and the secret, which the API checks before believing the address
 * (backend app/core/proxy.py). Without it, the plain rewrite in next.config.ts
 * runs as before.
 *
 * Vercel overwrites `x-real-ip` and `x-forwarded-for` with the address it saw,
 * so a caller cannot choose it. Behind another host that does not, this would
 * trust a caller-supplied header: keep the secret unset there.
 */
const API_BASE = (process.env.ASKMIRA_SERVER_API_BASE ?? "http://localhost:8000").replace(/\/+$/, "");

export function middleware(request: NextRequest) {
  const secret = process.env.PROXY_SHARED_SECRET;
  const address =
    request.headers.get("x-real-ip")?.trim() || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!secret || !address) return NextResponse.next();

  const headers = new Headers(request.headers);
  headers.set("x-askmira-client-ip", address);
  headers.set("x-askmira-proxy-secret", secret);
  const target = new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, API_BASE);
  return NextResponse.rewrite(target, { request: { headers } });
}

export const config = { matcher: ["/api/v1/:path*"] };
