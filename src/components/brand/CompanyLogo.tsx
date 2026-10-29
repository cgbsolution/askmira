"use client";

import React, { useEffect, useState } from "react";

import type { CompanyBrand } from "@/lib/types";
import { cn, initials } from "@/lib/utils";

/** Wider than this, a logo is a wordmark and unreadable in a 40px square. */
const SQUARE_ENOUGH = 1.6;

/**
 * The company's logo, small, for the phone header (where the rail is a drawer).
 * Its initials when it has no logo.
 */
export function CompanyMark({ company, fallbackName }: { company: CompanyBrand | null; fallbackName: string }) {
  const name = company?.name || fallbackName;
  const url = company?.logo_url ?? null;
  const [failed, setFailed] = useState<string | null>(null);
  if (url && failed !== url) {
    // On the light plate, as in the rail: the header is dark in dark mode.
    return (
      <span data-slot="company-mark" className="flex h-10 items-center rounded-lg bg-logo-plate px-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={name}
          onError={() => setFailed(url)}
          className="max-h-8 w-auto max-w-28 object-contain"
        />
      </span>
    );
  }
  return (
    <span
      role="img"
      aria-label={name}
      className="flex size-10 items-center justify-center rounded-xl bg-primary text-xs font-bold text-primary-foreground"
    >
      {initials(name)}
    </span>
  );
}

/**
 * The signed-in person's company at the top of the navigation: their legal
 * entity's logo (a sister company, a client the group staffs), the workspace's
 * when their company has none, and the company's name when there is no logo
 * at all — never a stand-in picture.
 *
 * Logos are drawn for white, so the logo sits on a light plate in both
 * themes. In the collapsed rail a squarish logo stays; a wide wordmark gives
 * way to the company's initials, which a 40px square can still show.
 */
export function CompanyLogo({
  company,
  fallbackName,
  className,
  onLogoShown,
}: {
  company: CompanyBrand | null;
  /** Shown while the session has no company yet (the workspace's name). */
  fallbackName: string;
  className?: string;
  /** Told whether the logo is drawn, or the name instead (no logo, or it failed to load). */
  onLogoShown?: (shown: boolean) => void;
}) {
  const name = company?.name || fallbackName;
  const url = company?.logo_url ?? null;
  const [failed, setFailed] = useState<string | null>(null);
  const [ratio, setRatio] = useState<number | null>(null);
  const showLogo = Boolean(url) && failed !== url;
  useEffect(() => {
    onLogoShown?.(showLogo);
  }, [showLogo, onLogoShown]);

  return (
    <span className={cn("flex min-w-0 items-center", className)}>
      {showLogo ? (
        <span
          data-slot="company-logo"
          className="flex h-12 w-full min-w-0 items-center justify-center rounded-xl bg-logo-plate px-3 py-1.5 shadow-xs group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:px-1"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url!}
            alt={name}
            onError={() => setFailed(url)}
            onLoad={(event) => {
              const image = event.currentTarget;
              if (image.naturalHeight) setRatio(image.naturalWidth / image.naturalHeight);
            }}
            className={cn(
              "max-h-full max-w-full object-contain",
              ratio !== null && ratio > SQUARE_ENOUGH && "group-data-[collapsible=icon]:hidden",
            )}
          />
          {ratio !== null && ratio > SQUARE_ENOUGH && (
            <span
              aria-hidden
              className="hidden text-xs font-bold text-logo-plate-foreground group-data-[collapsible=icon]:inline"
            >
              {initials(name)}
            </span>
          )}
        </span>
      ) : (
        <>
          <span className="line-clamp-2 font-display text-lg leading-tight font-semibold text-sidebar-foreground group-data-[collapsible=icon]:hidden">
            {name}
          </span>
          <span
            aria-hidden
            className="hidden size-10 items-center justify-center rounded-xl bg-logo-plate text-xs font-bold text-logo-plate-foreground group-data-[collapsible=icon]:flex"
          >
            {initials(name)}
          </span>
        </>
      )}
    </span>
  );
}
