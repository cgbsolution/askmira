"use client";

import { FileText } from "lucide-react";
import React, { useEffect, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { fetchFile } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * A letter shown as pictures of its PDF pages: exactly what prints, letterhead
 * and all, on any screen. (A phone's browser shows no PDF inside a page.)
 *
 * `pagePath(n)` is the API path of page n (1-based). The pictures are fetched
 * through the API client and their object URLs revoked when the letter closes.
 * Change `version` to fetch them again, after the letter was signed.
 */
export function LetterPages({
  count,
  pagePath,
  title,
  version = 0,
  publicPage = false,
  className,
}: {
  count: number;
  pagePath: (page: number) => string;
  title: string;
  version?: number;
  /** On a page without a sign-in: a 401 must not send the person to sign in. */
  publicPage?: boolean;
  className?: string;
}) {
  const [urls, setUrls] = useState<(string | null)[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const made: string[] = [];
    setUrls(Array.from({ length: count }, () => null));
    setFailed(false);
    (async () => {
      for (let page = 1; page <= count; page += 1) {
        try {
          const { blob } = await fetchFile(pagePath(page), {
            skipAuthRedirect: publicPage,
          });
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          made.push(url);
          setUrls((current) =>
            current.map((value, index) => (index === page - 1 ? url : value)),
          );
        } catch {
          if (!cancelled) setFailed(true);
          return;
        }
      }
    })();
    return () => {
      cancelled = true;
      made.forEach((url) => URL.revokeObjectURL(url));
    };
    // pagePath is rebuilt each render; the letter is identified by title + version.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, title, version, publicPage]);

  if (count === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-muted/40 p-8 text-center text-sm text-muted-foreground">
        <FileText className="size-8" aria-hidden />
        <p>The letter could not be shown. Download it instead.</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid gap-4 overflow-y-auto rounded-lg border border-border bg-muted/40 p-2 sm:p-4",
        className,
      )}
    >
      {urls.map((url, index) =>
        url ? (
          // Pictures of the letter's own pages, made by the API; not optimisable assets.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={url}
            src={url}
            alt={`${title}, page ${index + 1} of ${count}`}
            className="mx-auto w-full max-w-[800px] rounded-sm bg-white shadow-sm ring-1 ring-border"
          />
        ) : (
          <Skeleton
            key={`page-${index}`}
            className="mx-auto aspect-[1/1.414] w-full max-w-[800px]"
          />
        ),
      )}
      {failed ? (
        <p className="text-center text-sm text-muted-foreground">
          Some pages could not be shown. Download the PDF to read the whole
          letter.
        </p>
      ) : null}
    </div>
  );
}
