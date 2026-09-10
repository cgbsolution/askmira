"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

interface SidebarContextValue {
  /** Pinned open by the user. */
  isExpanded: boolean;
  /** Temporarily open because the pointer is over the collapsed rail. */
  isHovered: boolean;
  /** Mobile drawer state — separate, because it overlays rather than pushes. */
  isMobileOpen: boolean;
  setIsHovered: (value: boolean) => void;
  toggleSidebar: () => void;
  toggleMobileSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextValue | undefined>(undefined);

const STORAGE_KEY = "askmira.sidebar.expanded";

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Remember the pinned state across sessions. Reading in an effect rather
  // than in the initial state keeps server and client markup identical.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored !== null) setIsExpanded(stored === "true");
    } catch {
      // Storage blocked (private mode). The default is fine.
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsExpanded((previous) => {
      const next = !previous;
      try {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // Non-fatal.
      }
      return next;
    });
  }, []);

  const toggleMobileSidebar = useCallback(() => setIsMobileOpen((previous) => !previous), []);

  const value = useMemo(
    () => ({
      isExpanded,
      isHovered,
      isMobileOpen,
      setIsHovered,
      toggleSidebar,
      toggleMobileSidebar,
    }),
    [isExpanded, isHovered, isMobileOpen, toggleSidebar, toggleMobileSidebar],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar(): SidebarContextValue {
  const context = useContext(SidebarContext);
  if (!context) throw new Error("useSidebar must be used inside a SidebarProvider");
  return context;
}
