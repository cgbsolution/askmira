"use client";

import React from "react";

import { useT } from "./index";

/**
 * A translated string, usable from a server component.
 *
 * `DataPanel` and `EmptyState` render on the server for some pages, so they
 * cannot call `useT()` themselves; they render this client leaf instead.
 */
export function Tr({ text }: { text: string }) {
  const t = useT();
  return <>{t(text)}</>;
}
