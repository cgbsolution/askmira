"use client";

import { useCallback, useEffect, useState } from "react";

import { ApiError, get } from "@/lib/api";

/**
 * Load one GET endpoint, with loading and error state and a `reload`.
 *
 * Pass `null` as the path to wait (for example until a selection exists). A
 * response that arrives after the path has changed is discarded, so a slow
 * earlier request cannot overwrite a newer one.
 */
export function useApiQuery<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(path !== null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (path === null) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    get<T>(path)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
      })
      .catch((caught) => {
        if (cancelled) return;
        setError(caught instanceof ApiError ? caught : new ApiError(0, "Something went wrong."));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path, version]);

  const reload = useCallback(() => setVersion((current) => current + 1), []);

  return { data, error, isLoading, reload, setData };
}
