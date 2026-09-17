/**
 * Server-side loaders for the public careers pages.
 *
 * Wrapped in React `cache()` so `generateMetadata` and the page share one
 * request per render instead of calling the API twice.
 */
import { cache } from "react";

import { ApiError, get } from "@/lib/api";
import type { PublicCareersPage, PublicJobDetail } from "@/lib/types/hiring";

export type Loaded<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; detail: string };

function failure(error: unknown): { ok: false; status: number; detail: string } {
  if (error instanceof ApiError) return { ok: false, status: error.status, detail: error.detail };
  return { ok: false, status: 0, detail: "Something went wrong while loading this page." };
}

export const loadCareersPage = cache(
  async (slug: string, query: string): Promise<Loaded<PublicCareersPage>> => {
    const suffix = query ? `?${query}` : "";
    try {
      const data = await get<PublicCareersPage>(
        `/public/careers/${encodeURIComponent(slug)}${suffix}`,
        { skipAuthRedirect: true },
      );
      return { ok: true, data };
    } catch (error) {
      return failure(error);
    }
  },
);

export const loadJob = cache(
  async (slug: string, code: string): Promise<Loaded<PublicJobDetail>> => {
    try {
      const data = await get<PublicJobDetail>(
        `/public/careers/${encodeURIComponent(slug)}/jobs/${encodeURIComponent(code)}`,
        { skipAuthRedirect: true },
      );
      return { ok: true, data };
    } catch (error) {
      return failure(error);
    }
  },
);

/** "2–5 years", "3+ years", "Up to 2 years" — or null when the role gives no range. */
export function experienceRange(min: number | null, max: number | null): string | null {
  if (min !== null && max !== null) return min === max ? `${min} years` : `${min}–${max} years`;
  if (min !== null) return `${min}+ years`;
  if (max !== null) return `Up to ${max} years`;
  return null;
}

/** Turn a single search-param value (string | string[] | undefined) into a string. */
export function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}
