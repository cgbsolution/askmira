"use client";

import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { usePathname } from "next/navigation";
import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

import { RailSection } from "@/components/layout/RailSection";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarProvider,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";
import { QUICK_ACCESS, railEntry, resolvePage, sectionByKey } from "@/lib/access";
import { useT } from "@/lib/i18n";

type RailControls = ReturnType<typeof useSidebar>;

const ConnectorRailContext = createContext<RailControls | null>(null);

/**
 * The right-hand rail's own open state, apart from the navigation's. It starts
 * shut on every visit — nothing is remembered — and takes no keyboard
 * shortcut, so Ctrl+B stays the navigation's.
 */
export function ConnectorRailProvider({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen={false} cookieName={null} shortcut={null}>
      <ExposeRail>{children}</ExposeRail>
    </SidebarProvider>
  );
}

/** Republishes the rail's controls where the navigation's provider cannot shadow them. */
function ExposeRail({ children }: { children: React.ReactNode }) {
  const rail = useSidebar();
  return <ConnectorRailContext.Provider value={rail}>{children}</ConnectorRailContext.Provider>;
}

/** The right-hand rail's controls from anywhere in the shell — the header's phone button, say. */
export function useConnectorRail(): RailControls {
  const context = useContext(ConnectorRailContext);
  if (!context) throw new Error("useConnectorRail must be used within a ConnectorRailProvider.");
  return context;
}

/**
 * Quick access, on the right: the companion, the hubs a linked product can take
 * over, and the self-service desks (`QUICK_ACCESS`).
 *
 * An icon strip until opened, and it folds back once a page is picked, so the
 * page keeps its width. Built by the same rules as the navigation: a section
 * shows only where the workspace has it and the person can open it.
 */
export function ConnectorSidebar() {
  const t = useT();
  const { user, tenant } = useAuth();
  const { isMobile, open, setOpen, setOpenMobile, toggleSidebar } = useSidebar();
  const pathname = usePathname();

  const resolved = resolvePage(pathname);
  const activeSection = resolved?.section?.key;
  const activePage = resolved?.page.path;

  // As in the navigation: one section unfolded at a time, the current one by itself.
  const [openSection, setOpenSection] = useState(activeSection);
  const [trackedSection, setTrackedSection] = useState(activeSection);
  if (trackedSection !== activeSection) {
    setTrackedSection(activeSection);
    setOpenSection(activeSection);
  }

  const entries = useMemo(
    () =>
      QUICK_ACCESS.flatMap((key) => {
        const section = sectionByKey(key);
        const entry = section && railEntry(section, user, tenant);
        return entry ? [entry] : [];
      }),
    [user, tenant],
  );

  const fold = useCallback(() => {
    if (isMobile) setOpenMobile(false);
    else setOpen(false);
  }, [isMobile, setOpen, setOpenMobile]);

  if (entries.length === 0) return null;

  const expanded = isMobile || open;
  const label = t("Quick access");

  return (
    <Sidebar side="right" collapsible="icon" aria-label={label}>
      <SidebarHeader className="h-[72px] shrink-0 flex-row items-center justify-between gap-2 py-0 pr-3 pl-5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
        <span className="truncate font-display text-base font-semibold group-data-[collapsible=icon]:hidden">
          {label}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          aria-label={t(expanded ? "Close quick access" : "Open quick access")}
          aria-expanded={expanded}
          className="size-10 shrink-0 rounded-xl text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          {expanded ? <ChevronsRight /> : <ChevronsLeft />}
        </Button>
      </SidebarHeader>

      <SidebarContent className="no-scrollbar gap-1 pb-3 group-data-[collapsible=icon]:overflow-y-auto">
        <SidebarGroup className="px-3 py-1">
          <SidebarMenu className="gap-0.5">
            {entries.map(({ section, pages, launch }) => (
              <RailSection
                key={section.key}
                side="right"
                section={section}
                pages={pages}
                launch={launch}
                inSection={section.key === activeSection}
                activePage={activePage}
                open={openSection === section.key}
                onOpenChange={(next) => setOpenSection(next ? section.key : undefined)}
                onNavigate={fold}
              />
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail aria-label={t("Toggle quick access")} title={t("Toggle quick access")} />
    </Sidebar>
  );
}
