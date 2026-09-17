"use client";

import { useCallback, useEffect, useState } from "react";

import { ApiError, get } from "@/lib/api";

/**
 * `useApiQuery` for the no-session pages: the same loading/error/reload shape,
 * but never attempts a session refresh or a sign-in redirect.
 */
export function usePublicQuery<T>(path: string | null) {
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
    get<T>(path, { skipAuthRedirect: true })
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
