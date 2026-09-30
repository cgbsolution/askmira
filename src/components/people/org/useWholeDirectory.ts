"use client";

import { useCallback, useEffect, useState } from "react";

import { ApiError, get } from "@/lib/api";
import type { EmployeeSummary, Page } from "@/lib/types";

const PAGE_SIZE = 200;
/** Beyond this the chart stops loading and says so rather than freezing the tab. */
const MAX_PEOPLE = 5000;

/**
 * Everybody who has not left — active, on notice, on leave, about to join —
 * paged through 200 at a time. `status=active` alone dropped everyone on notice
 * or on leave, and their reports floated to the top of the chart.
 *
 * A reporting-line chart needs the whole set to find the roots — somebody's
 * manager may be on page nine — so it cannot be drawn from one page. The
 * directory endpoint is readable by every role, which is why the people chart
 * works for employees while the positions chart (HR and managers only) does not.
 */
export function useWholeDirectory() {
  const [people, setPeople] = useState<EmployeeSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [truncated, setTruncated] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    (async () => {
      const all: EmployeeSummary[] = [];
      let page = 1;
      let total = Infinity;
      while (all.length < total && all.length < MAX_PEOPLE) {
        const result = await get<Page<EmployeeSummary>>(
          `/employees?current=true&page=${page}&page_size=${PAGE_SIZE}`,
        );
        total = result.total;
        all.push(...result.items);
        if (result.items.length < PAGE_SIZE) break;
        page += 1;
      }
      if (cancelled) return;
      setPeople(all);
      setTruncated(all.length < total);
    })()
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof ApiError ? caught.detail : "Could not load the directory.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [version]);

  const reload = useCallback(() => setVersion((current) => current + 1), []);

  return { people, error, isLoading, truncated, reload, limit: MAX_PEOPLE };
}
