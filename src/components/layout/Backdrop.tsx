"use client";

import React from "react";

import { useSidebar } from "@/context/SidebarContext";

/** Dim layer behind the mobile drawer. Tapping it closes the drawer. */
export function Backdrop() {
  const { isMobileOpen, toggleMobileSidebar } = useSidebar();

  if (!isMobileOpen) return null;

  return (
    <div
      onClick={toggleMobileSidebar}
      aria-hidden
      className="fixed inset-0 z-40 bg-ink-950/40 backdrop-blur-[2px] lg:hidden"
    />
  );
}
