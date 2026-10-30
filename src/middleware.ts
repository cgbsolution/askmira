import { NextResponse, type NextRequest } from "next/server";

/**
 * Routes `/api/v1/*`.
 *
 * Most requests continue to the route handler at `app/api/v1/[...path]`, which
 * forwards them to the API and retries a connection that does not open (see
 * `src/lib/server/apiProxy.ts`).
 *
 * A body larger than a Vercel function accepts (4.5 MB) cannot go that way,
 * so a big upload is rewritten straight to the API as before. With
 * `PROXY_SHARED_SECRET` set it carries the address Vercel saw and the secret,
 * which the API checks before believing the address (backend
 * app/core/proxy.py): otherwise every request would seem to come from Vercel,
 * and sign-in rate limits would run out for everybody at once.
 *
 * Vercel overwrites `x-real-ip` and `x-forwarded-for` with the address it saw,
 * so a caller cannot choose it. Behind another host that does not, this would
 * trust a caller-supplied header: keep the secret unset there.
 */
const API_BASE = (process.env.ASKMIRA_SERVER_API_BASE ?? "http://localhost:8000").replace(/\/+$/, "");

/** Below Vercel's 4.5 MB function body limit, with room for headers. */
const FUNCTION_BODY_LIMIT = 4 * 1024 * 1024;

export function middleware(request: NextRequest) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (!(length > FUNCTION_BODY_LIMIT)) return NextResponse.next();

  const headers = new Headers(request.headers);
  const secret = process.env.PROXY_SHARED_SECRET;
  const address =
    request.headers.get("x-real-ip")?.trim() || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (secret && address) {
    headers.set("x-askmira-client-ip", address);
    headers.set("x-askmira-proxy-secret", secret);
  }
  const target = new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, API_BASE);
  return NextResponse.rewrite(target, { request: { headers } });
}

export const config = { matcher: ["/api/v1/:path*"] };
