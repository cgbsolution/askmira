"use client";

import { ChevronRight, ExternalLink, type LucideIcon } from "lucide-react";
import Link from "next/link";
import React from "react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { PRODUCTS, type NavPage, type NavSection } from "@/lib/access";
import { useT } from "@/lib/i18n";
import type { ProductKey } from "@/lib/types";
import { cn } from "@/lib/utils";

/** A top-level row: 44px, the icon in its own chip, label beside it. */
const ROW = "relative h-11 gap-3 rounded-xl px-1.5 font-medium text-sidebar-foreground/90";

/** The icon's chip. Marigold when its section is the one you are in. */
function NavChip({ icon: Icon, active }: { icon: LucideIcon; active: boolean }) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
          : "bg-white/10 text-sidebar-foreground/85",
      )}
    >
      <Icon className="size-4" />
    </span>
  );
}

/** The Marigold bar on the rail's edge beside the active row. */
function ActiveBar() {
  return (
    <span
      aria-hidden
      className="absolute top-1/2 left-0 h-5 w-1 -translate-y-1/2 rounded-r-full bg-sidebar-primary group-data-[collapsible=icon]:hidden"
    />
  );
}

/**
 * One section of a rail, for whichever sidebar it sits in.
 *
 * Expanded, a multi-page section unfolds its pages beneath it. Collapsed to
 * icons there is no room to unfold, so the same pages fly out towards the page.
 */
export function RailSection({
  section,
  pages,
  launch,
  inSection,
  activePage,
  open,
  onOpenChange,
  onNavigate,
  side = "left",
}: {
  section: NavSection;
  pages: NavPage[];
  /** The linked product this row opens when it has no pages to list. */
  launch?: ProductKey;
  inSection: boolean;
  activePage: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: () => void;
  /** The edge of the screen the rail is on; tooltips and flyouts open away from it. */
  side?: "left" | "right";
}) {
  const t = useT();
  const { state, isMobile } = useSidebar();
  const toward = side === "left" ? "right" : "left";
  const tooltip = (children: string) => ({ children, side: toward }) as const;

  // A linked product with no pages for this person: the row opens the product.
  if (launch && pages.length === 0) {
    const label = `${t(section.name)} · ${t(PRODUCTS[launch].name)}`;
    return (
      <SidebarMenuItem>
        <SidebarMenuButton asChild tooltip={tooltip(label)} className={ROW}>
          <Link
            href={`/launch/${launch}`}
            target="_blank"
            rel="noopener"
            onClick={onNavigate}
            aria-label={`${label} (opens in a new tab)`}
          >
            <NavChip icon={section.icon} active={false} />
            <span className="truncate">{t(section.name)}</span>
            <ExternalLink className="mr-1 ml-auto size-3.5 text-sidebar-foreground/60" />
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  if (pages.length === 1) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={inSection}
          tooltip={tooltip(t(section.name))}
          className={ROW}
        >
          <Link
            href={pages[0].path}
            onClick={onNavigate}
            aria-current={inSection ? "page" : undefined}
          >
            {inSection && <ActiveBar />}
            <NavChip icon={section.icon} active={inSection} />
            <span>{t(section.name)}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  if (state === "collapsed" && !isMobile) {
    return (
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton isActive={inSection} aria-label={t(section.name)} className={ROW}>
              <NavChip icon={section.icon} active={inSection} />
              <span>{t(section.name)}</span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side={toward} align="start" sideOffset={12} className="min-w-52">
            <DropdownMenuLabel>{t(section.name)}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {pages.map((page) => {
              const current = page.path === activePage;
              return (
                <DropdownMenuItem key={page.path} asChild>
                  <Link
                    href={page.path}
                    aria-current={current ? "page" : undefined}
                    className={cn(current && "font-semibold text-primary")}
                  >
                    {t(page.name)}
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    );
  }

  // Unfolded, the page you are on carries the highlight; folded, the section
  // does, since none of its pages is on show to carry it.
  const rowActive = inSection && !open;

  return (
    <Collapsible asChild open={open} onOpenChange={onOpenChange} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton isActive={rowActive} className={cn(ROW, inSection && "font-semibold")}>
            {rowActive && <ActiveBar />}
            <NavChip icon={section.icon} active={inSection} />
            <span className="truncate">{t(section.name)}</span>
            <ChevronRight className="ml-auto mr-1 text-sidebar-foreground/60 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
          <SidebarMenuSub className="mx-0 mt-0.5 mb-1 ml-[21px] gap-0.5 border-white/15 pr-0 pl-3">
            {pages.map((page) => {
              const current = page.path === activePage;
              return (
                <SidebarMenuSubItem key={page.path}>
                  {current && (
                    <span
                      aria-hidden
                      className="absolute top-2 bottom-2 -left-3.5 w-[3px] rounded-full bg-sidebar-primary"
                    />
                  )}
                  <SidebarMenuSubButton
                    asChild
                    isActive={current}
                    className="h-9 rounded-lg px-3 text-sidebar-foreground/80 hover:text-sidebar-foreground"
                  >
                    <Link
                      href={page.path}
                      onClick={onNavigate}
                      aria-current={current ? "page" : undefined}
                    >
                      <span>{t(page.name)}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}
