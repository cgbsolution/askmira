"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

import { useAuth } from "@/context/AuthContext";
import { resolvePage, sectionByKey, visiblePages } from "@/lib/access";
import { cn } from "@/lib/utils";

/**
 * The pages of one section, as the segmented bar from FRD 5.13.
 *
 * Reads `lib/access.ts`, so a page appears here only for the roles that may
 * open it. Hidden when the person can see fewer than two pages — a bar with
 * one option is a label pretending to be a control.
 */
export function SectionNav({ section: key, className }: { section: string; className?: string }) {
  const { user, tenant } = useAuth();
  const pathname = usePathname();
  const section = sectionByKey(key);
  if (!section) return null;
  const pages = visiblePages(section, user, tenant);
  if (pages.length < 2) return null;
  const active = resolvePage(pathname)?.page.path;

  return (
    <nav aria-label={`${section.name} pages`} className={cn("no-scrollbar overflow-x-auto", className)}>
      <ul className="inline-flex h-10 w-fit items-center gap-0.5 rounded-full bg-mint-100 p-1 dark:bg-mint-900/40">
        {pages.map((page) => {
          const isActive = active === page.path;
          return (
            <li key={page.path}>
              <Link
                href={page.path}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-flex h-8 items-center whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors outline-none",
                  "focus-visible:ring-[3px] focus-visible:ring-ring/40",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-mint-800 hover:text-brand-700 dark:text-mint-200",
                )}
              >
                {page.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
