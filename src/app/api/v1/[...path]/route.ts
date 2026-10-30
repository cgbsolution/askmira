import { proxyToApi } from "@/lib/server/apiProxy";

/**
 * Every `/api/v1/*` call from the portal, forwarded to the API with a retry
 * for connections that do not open (see `src/lib/server/apiProxy.ts`).
 * Uploads too large for a function still go by the rewrite in middleware.ts.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const base = (process.env.ASKMIRA_SERVER_API_BASE ?? "http://localhost:8000").replace(/\/+$/, "");

const forward = (request: Request) => proxyToApi(request, { base, secret: process.env.PROXY_SHARED_SECRET });

export const GET = forward;
export const HEAD = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
export const OPTIONS = forward;
