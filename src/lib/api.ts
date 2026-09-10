import Cookies from "js-cookie";

/**
 * Central API client for the FastAPI backend.
 *
 * Every request carries our own JWT as a Bearer token. There is no Supabase
 * client here and there should not be one — Supabase is the database behind
 * the API, not something the browser talks to.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const API_V1 = "/api/v1";

export const TOKEN_KEY = "askmira_token";
export const REFRESH_KEY = "askmira_refresh";
export const USER_KEY = "askmira_user";

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(detail);
    this.name = "ApiError";
  }
}

interface ApiOptions extends Omit<RequestInit, "body" | "signal"> {
  /** Serialised as JSON unless it is already a FormData. */
  body?: unknown;
  /** Milliseconds before the request aborts. */
  timeout?: number;
  /** Skip the Authorization header, for sign-in and sign-up. */
  skipAuth?: boolean;
}

export function getToken(): string | undefined {
  return Cookies.get(TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string, expiresIn: number): void {
  // Cookies rather than localStorage so Next.js middleware can gate routes
  // without waiting for the client bundle. The backend never trusts these —
  // it verifies the Bearer token on every request.
  const expires = new Date(Date.now() + expiresIn * 1000);
  Cookies.set(TOKEN_KEY, accessToken, { expires, sameSite: "lax" });
  Cookies.set(REFRESH_KEY, refreshToken, { expires: 30, sameSite: "lax" });
}

export function clearTokens(): void {
  Cookies.remove(TOKEN_KEY);
  Cookies.remove(REFRESH_KEY);
  Cookies.remove(USER_KEY);
}

/**
 * Typed fetch wrapper.
 *
 * @example
 *   const page = await api<Page<EmployeeSummary>>("/employees?page=1");
 */
export async function api<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const { timeout = 30_000, skipAuth = false, body, headers: extraHeaders, ...rest } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  const headers: Record<string, string> = { ...(extraHeaders as Record<string, string>) };
  const isFormData = body instanceof FormData;
  if (body !== undefined && !isFormData) headers["Content-Type"] = "application/json";
  if (!skipAuth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE}${API_V1}${path}`, {
      ...rest,
      headers,
      body: isFormData ? (body as FormData) : body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (response.status === 204) return undefined as T;

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      // FastAPI puts the message in `detail`; our validation handler already
      // flattens Pydantic errors into a single readable sentence.
      const detail =
        typeof payload?.detail === "string"
          ? payload.detail
          : `Request failed with status ${response.status}`;

      if (response.status === 401 && typeof window !== "undefined") {
        clearTokens();
        if (!window.location.pathname.startsWith("/signin")) {
          window.location.href = "/signin?expired=1";
        }
      }
      throw new ApiError(response.status, detail);
    }

    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError(408, "The request timed out. Please try again.");
    }
    throw new ApiError(0, "Could not reach the server. Check your connection.");
  } finally {
    clearTimeout(timer);
  }
}

export const get = <T>(path: string, options?: ApiOptions) => api<T>(path, { ...options });

export const post = <T>(path: string, body?: unknown, options?: ApiOptions) =>
  api<T>(path, { ...options, method: "POST", body });

export const patch = <T>(path: string, body?: unknown, options?: ApiOptions) =>
  api<T>(path, { ...options, method: "PATCH", body });

export const del = <T>(path: string, options?: ApiOptions) =>
  api<T>(path, { ...options, method: "DELETE" });
