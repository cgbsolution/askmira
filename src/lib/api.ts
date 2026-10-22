/**
 * Central API client for the FastAPI backend.
 *
 * Sessions live in httpOnly cookies the page cannot read — a script injected
 * into the page has no token to steal. Because the browser now sends
 * credentials on its own, every state-changing request carries a CSRF token:
 * the backend sets it in a readable cookie, and this client echoes it in a
 * header another site could not read to forge.
 *
 * There is no Supabase client here and there should not be one — Supabase is
 * the database behind the API, not something the browser talks to.
 */

/**
 * Same-origin on purpose: `/api/v1/*` on this site is forwarded to the API by
 * the rewrite in `next.config.ts`. Calling the API host directly from the
 * browser makes the session cookies third-party, and the browser then drops
 * them — see the note there.
 */
const API_BASE = "";
const API_V1 = "/api/v1";

/**
 * Pages rendered on the server (the public careers pages) have no origin for a
 * relative URL to resolve against, so there the API is called directly, at the
 * address the rewrite forwards to. Set in `next.config.ts` at build time.
 */
const SERVER_API_BASE = (process.env.ASKMIRA_SERVER_API_BASE ?? "http://localhost:8000").replace(
  /\/+$/,
  "",
);

function apiBase(): string {
  return typeof window === "undefined" ? SERVER_API_BASE : API_BASE;
}

const CSRF_COOKIE = "askmira_csrf";
const CSRF_HEADER = "X-CSRF-Token";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Pages that must not bounce to sign-in on a 401 (they are the sign-in flow, or public). */
const PUBLIC_PATH_PREFIXES = ["/signin", "/careers", "/candidate", "/interview", "/kiosk", "/act"];

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(detail);
    this.name = "ApiError";
  }
}

interface ApiOptions extends Omit<RequestInit, "body" | "signal" | "credentials"> {
  /** Serialised as JSON unless it is already a FormData. */
  body?: unknown;
  /** Milliseconds before the request aborts. */
  timeout?: number;
  /** Do not try a session refresh or redirect to sign-in on a 401. */
  skipAuthRedirect?: boolean;
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const entry = document.cookie.split("; ").find((part) => part.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : undefined;
}

function isPublicPage(): boolean {
  if (typeof window === "undefined") return true;
  return PUBLIC_PATH_PREFIXES.some((prefix) => window.location.pathname.startsWith(prefix));
}

/** Asks the person to prove who they are; resolves true once they have. */
export type StepUpHandler = (action: string, reason: string) => Promise<boolean>;

let stepUpHandler: StepUpHandler | null = null;

/** Registered once by StepUpProvider; a 428 naming an action is answered through it. */
export function setStepUpHandler(handler: StepUpHandler | null): void {
  stepUpHandler = handler;
}

let refreshing: Promise<boolean> | null = null;

/** One refresh at a time, however many requests hit a 401 together. */
function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = rawFetch("/auth/refresh", { method: "POST" }, 15_000)
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

async function rawFetch(path: string, init: RequestInit, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  headers.set("X-Auth-Transport", "cookie");
  if (!SAFE_METHODS.has(method)) {
    const csrf = readCookie(CSRF_COOKIE);
    if (csrf) headers.set(CSRF_HEADER, csrf);
  }
  try {
    return await fetch(`${apiBase()}${API_V1}${path}`, {
      ...init,
      method,
      headers,
      credentials: "include",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function send(path: string, options: ApiOptions): Promise<Response> {
  const { timeout = 30_000, skipAuthRedirect = false, body, headers: extraHeaders, ...rest } = options;
  const headers = new Headers(extraHeaders);
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  if (body !== undefined && !isFormData) headers.set("Content-Type", "application/json");
  const init: RequestInit = {
    ...rest,
    headers,
    body: isFormData ? (body as FormData) : body !== undefined ? JSON.stringify(body) : undefined,
  };

  let response: Response;
  try {
    response = await rawFetch(path, init, timeout);
    if (response.status === 401 && !skipAuthRedirect && !path.startsWith("/auth/")) {
      if (await refreshSession()) {
        response = await rawFetch(path, init, timeout);
      }
    }
    // A money-moving action wants fresh proof of identity: ask, then try once more.
    const stepUpAction = response.status === 428 ? response.headers.get("X-Step-Up-Action") : null;
    if (stepUpAction && stepUpHandler) {
      const payload = await response.clone().json().catch(() => null);
      const reason = typeof payload?.detail === "string" ? payload.detail : "Confirm it is you to continue.";
      if (await stepUpHandler(stepUpAction, reason)) {
        response = await rawFetch(path, init, timeout);
      }
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError(408, "The request timed out. Please try again.");
    }
    throw new ApiError(0, "Could not reach the server. Check your connection.");
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    // FastAPI puts the message in `detail`; our validation handler already
    // flattens Pydantic errors into a single readable sentence.
    // 502–504 come from the proxy in front of the API, not the API itself:
    // it is restarting (a deploy) or did not answer in time.
    const detail =
      typeof payload?.detail === "string"
        ? payload.detail
        : [502, 503, 504].includes(response.status)
          ? "AskMira is restarting or briefly unavailable. Please try again in a minute."
          : `Request failed with status ${response.status}`;
    if (response.status === 401 && !skipAuthRedirect && !isPublicPage()) {
      window.location.href = "/signin?expired=1";
    }
    throw new ApiError(response.status, detail);
  }
  return response;
}

/**
 * Typed JSON request.
 *
 * @example
 *   const page = await api<Page<EmployeeSummary>>("/employees?page=1");
 */
export async function api<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const response = await send(path, options);
  if (response.status === 204) return undefined as T;
  return (await response.json().catch(() => null)) as T;
}

export const get = <T>(path: string, options?: ApiOptions) => api<T>(path, { ...options });

export const post = <T>(path: string, body?: unknown, options?: ApiOptions) =>
  api<T>(path, { ...options, method: "POST", body });

export const put = <T>(path: string, body?: unknown, options?: ApiOptions) =>
  api<T>(path, { ...options, method: "PUT", body });

export const patch = <T>(path: string, body?: unknown, options?: ApiOptions) =>
  api<T>(path, { ...options, method: "PATCH", body });

export const del = <T>(path: string, options?: ApiOptions) =>
  api<T>(path, { ...options, method: "DELETE" });

/** A file from the API as a Blob, with the filename the server suggested. */
export async function fetchFile(
  path: string,
  options: ApiOptions = {},
): Promise<{ blob: Blob; filename: string | null }> {
  const response = await send(path, options);
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  return { blob: await response.blob(), filename: match ? decodeURIComponent(match[1]) : null };
}

/**
 * Save a file from the API to the user's device.
 *
 * The object URL is revoked straight after the click, so a sensitive document
 * (a payslip, an offer letter) does not linger addressable in the page.
 */
export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const { blob, filename } = await fetchFile(path);
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = (filename ?? fallbackName).replace(/[\\/:*?"<>|]+/g, "_");
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }
}
