import type { Audience } from "@/lib/types";

import { GUIDES } from "./guides";

/**
 * In-app help: a guide for every page, opened from the Help button in the top
 * bar (or the "?" key). A guide says what the page is for, how to do each task
 * on it step by step, and what is worth knowing — in the words the page itself
 * uses, so a person can follow it with the page open beside it.
 *
 * Tasks can be limited to the roles that can do them: an employee reading the
 * leave guide is not told how to approve leave. The guide never claims a
 * button that the page does not have; GUIDES is written from the pages.
 */

export interface HelpTask {
  /** What the person wants to do, as they would put it: "Apply for leave". */
  title: string;
  /** One action each, in order. */
  steps: string[];
  /** Who can do it. Omitted: everyone who can open the page. */
  roles?: Audience[];
}

export interface PageGuide {
  /** What the page is for, in a sentence or two. */
  summary: string;
  tasks: HelpTask[];
  /** Things worth knowing: rules, timings, where a result shows up. */
  tips?: string[];
  /** Pages people often need next. */
  related?: { label: string; href: string }[];
}

/** Turn "/payroll/runs/[id]" into a pattern; "[...]" matches one path segment. */
function patternOf(key: string): RegExp {
  const body = key
    .split("/")
    .map((part) => (part.startsWith("[") ? "[^/]+" : part.replace(/[.*+?^${}()|\\]/g, "\\$&")))
    .join("/");
  return new RegExp(`^${body}/?$`);
}

const COMPILED = Object.keys(GUIDES).map((key) => ({ key, pattern: patternOf(key) }));

/** The guide for a path: exact or patterned match, else the nearest parent's. */
export function guideFor(pathname: string): { key: string; guide: PageGuide } | null {
  let path = pathname.replace(/\/+$/, "") || "/";
  for (;;) {
    const hit = COMPILED.find(({ pattern }) => pattern.test(path));
    if (hit) return { key: hit.key, guide: GUIDES[hit.key] };
    if (path === "/") return null;
    path = path.slice(0, path.lastIndexOf("/")) || "/";
  }
}

export { GUIDES };
