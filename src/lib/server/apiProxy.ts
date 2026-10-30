import http from "node:http";
import https from "node:https";
import { Readable } from "node:stream";

/**
 * Forwards one `/api/v1/*` request to the API, retrying a connection that does
 * not open.
 *
 * Why not a plain rewrite: on 2026-10-30 about one in three connections from
 * Vercel's Mumbai edge to the API server (Hostinger, Mumbai) never opened.
 * Vercel's rewrite waits 30 s for each and then answers 502, so every page had
 * requests that hung and failed. The server, its firewall and Hostinger's
 * filters were all clean, and a fresh connection usually got through.
 *
 * So each attempt gets a short time to connect. A connection that does not
 * open has carried nothing, so trying again on a new one is safe for every
 * method, a POST included. Once connected, the request is never sent twice:
 * a failure after that is answered 502, as the rewrite did.
 */

/** Seconds-scale waits for a connection, one per attempt. */
export const CONNECT_WAITS_MS = [3000, 3000, 4000, 8000];

/** The least time between two attempts, when one fails at once. */
const RETRY_PAUSE_MS = 500;

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

/** Set here from what this server saw, never passed on from the caller. */
const NOT_FORWARDED = new Set([
  ...HOP_BY_HOP,
  "host",
  "content-length",
  "forwarded",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
  "x-real-ip",
  "x-askmira-client-ip",
  "x-askmira-proxy-secret",
]);

/** Statuses whose response may not carry a body. */
const NO_BODY = new Set([101, 204, 205, 304]);

export type ProxyOptions = {
  /** The API's origin, e.g. https://hrms.epfassist.com. */
  base: string;
  /** With it, the caller's address is passed on (backend app/core/proxy.py). */
  secret?: string;
  connectWaitsMs?: number[];
};

class NotConnected extends Error {}

function send(
  url: URL,
  method: string,
  headers: Record<string, string>,
  body: Buffer | undefined,
  connectWaitMs: number,
  signal: AbortSignal,
): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    const secure = url.protocol === "https:";
    let connected = false;
    // A new connection every time: a pooled one could be one that died idle,
    // and a request written to it might or might not have arrived.
    const request = (secure ? https : http).request(url, { method, headers, agent: false });
    const timer = setTimeout(
      () => request.destroy(new NotConnected(`no connection within ${connectWaitMs} ms`)),
      connectWaitMs,
    );
    const onAbort = () => request.destroy(new Error("the caller went away"));
    signal.addEventListener("abort", onAbort, { once: true });
    request.on("socket", (socket) => {
      socket.once(secure ? "secureConnect" : "connect", () => {
        connected = true;
        clearTimeout(timer);
      });
    });
    request.on("response", (response) => {
      clearTimeout(timer);
      resolve(response);
    });
    request.on("error", (error) => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      reject(connected || error instanceof NotConnected ? error : new NotConnected(error.message));
    });
    request.end(body);
  });
}

function toResponse(upstream: http.IncomingMessage): Response {
  const headers = new Headers();
  for (const [name, value] of Object.entries(upstream.headers)) {
    if (value === undefined || HOP_BY_HOP.has(name)) continue;
    if (Array.isArray(value)) value.forEach((one) => headers.append(name, one));
    else headers.set(name, value);
  }
  const status = upstream.statusCode ?? 502;
  if (NO_BODY.has(status)) {
    upstream.resume();
    return new Response(null, { status, headers });
  }
  // The bytes as the API sent them (compressed or not), streamed through.
  const body = Readable.toWeb(upstream) as unknown as ReadableStream<Uint8Array>;
  return new Response(body, { status, statusText: upstream.statusMessage, headers });
}

function unreachable(detail: string): Response {
  return Response.json({ detail }, { status: 502, headers: { "Retry-After": "5" } });
}

export async function proxyToApi(request: Request, options: ProxyOptions): Promise<Response> {
  const incoming = new URL(request.url);
  const target = new URL(`${incoming.pathname}${incoming.search}`, options.base);

  const headers: Record<string, string> = {};
  request.headers.forEach((value, name) => {
    if (!NOT_FORWARDED.has(name) && !name.startsWith("x-vercel-")) headers[name] = value;
  });
  // Vercel overwrites these with the address it saw, so a caller cannot choose it.
  const address =
    request.headers.get("x-real-ip")?.trim() || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (options.secret && address) {
    headers["x-askmira-client-ip"] = address;
    headers["x-askmira-proxy-secret"] = options.secret;
  }

  const method = request.method.toUpperCase();
  const body = method === "GET" || method === "HEAD" ? undefined : Buffer.from(await request.arrayBuffer());
  if (body) headers["content-length"] = String(body.length);

  for (const wait of options.connectWaitsMs ?? CONNECT_WAITS_MS) {
    if (request.signal.aborted) break;
    const started = Date.now();
    try {
      return toResponse(await send(target, method, headers, body, wait, request.signal));
    } catch (error) {
      if (!(error instanceof NotConnected)) {
        return unreachable("The connection to AskMira broke before it answered. Please try again.");
      }
      // Refused at once (the API restarting for a deploy, say): give it a moment.
      const quick = RETRY_PAUSE_MS - (Date.now() - started);
      if (quick > 0) await new Promise((resolve) => setTimeout(resolve, quick));
    }
  }
  return unreachable("AskMira's server could not be reached. Please try again in a minute.");
}
