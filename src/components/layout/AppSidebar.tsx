"use client";

import {
  ChevronRight,
  ExternalLink,
  LogOut,
  MoreVertical,
  UserCircle2,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/lib/i18n";
import {
  GROUP_LABEL,
  NAV,
  PRODUCTS,
  linkedProduct,
  resolvePage,
  roleAllows,
  visiblePages,
  type NavPage,
  type NavSection,
} from "@/lib/access";
import type { ProductKey } from "@/lib/types";
import { cn, humanizeRole, initials } from "@/lib/utils";

const GROUP_ORDER: NavSection["group"][] = ["me", "company", "operations", "admin"];

/** A top-level row: 44px, the icon in its own chip, label beside it. */
const ROW = "relative h-11 gap-3 rounded-xl px-1.5 font-medium text-sidebar-foreground/90";

/**
 * The nav rail from FRD 5.13: solid Deep Teal, Marigold on the active item.
 *
 * Built from `lib/access.ts`, the same map the route guard reads. A section
 * appears only when the workspace has its module and the person can open at
 * least one of its pages. A section with one page is a link; with more, its
 * pages are listed under it — so the rail, not a bar on each page, is how you
 * move around a module. A section a linked product has taken over is one row
 * that opens the product in a new tab.
 */
export function AppSidebar() {
  const t = useT();
  const { user, tenant, logout } = useAuth();
  const { isMobile, setOpenMobile, state } = useSidebar();
  const pathname = usePathname();

  const resolved = resolvePage(pathname);
  const activeSection = resolved?.section?.key;
  const activePage = resolved?.page.path;

  // One section unfolded at a time, and the one you are in unfolds by itself.
  // Adjusted during render rather than in an effect, so there is no frame where
  // the new section is active but still folded.
  const [openSection, setOpenSection] = useState(activeSection);
  const [trackedSection, setTrackedSection] = useState(activeSection);
  if (trackedSection !== activeSection) {
    setTrackedSection(activeSection);
    setOpenSection(activeSection);
  }

  const groups = useMemo(() => {
    const sections = NAV.map((section) => {
      const product = linkedProduct(section, tenant);
      if (product) {
        const offered = roleAllows(user, PRODUCTS[product].audience);
        return { section, pages: [] as NavPage[], launch: offered ? product : undefined };
      }
      return { section, pages: visiblePages(section, user, tenant), launch: undefined };
    }).filter(({ pages, launch }) => pages.length > 0 || launch);
    return GROUP_ORDER.map((group) => ({
      key: group,
      label: GROUP_LABEL[group],
      items: sections.filter(({ section }) => section.group === group),
    })).filter(({ items }) => items.length > 0);
  }, [user, tenant]);

  // A deep link into a long section must not leave its active row below the
  // fold. Waits out the unfold animation, so the measurement is of the final list.
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      contentRef.current
        ?.querySelector('[data-active="true"]')
        ?.scrollIntoView({ block: "nearest" });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [activePage, state]);

  const closeOnMobile = useCallback(() => {
    if (isMobile) setOpenMobile(false);
  }, [isMobile, setOpenMobile]);

  return (
    <Sidebar collapsible="icon">
      {/* ── Brand + workspace ──────────────────────────────────────────── */}
      <SidebarHeader className="gap-0 p-0">
        <div className="flex h-[72px] shrink-0 items-center px-5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <Link
            href="/"
            onClick={closeOnMobile}
            aria-label="AskMira home"
            className="flex items-center gap-2.5 rounded-lg outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary text-base font-bold text-sidebar-primary-foreground">
              A
            </span>
            <span className="font-display text-xl font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
              AskMira
            </span>
          </Link>
        </div>

        {tenant && (
          <div className="mx-3 mb-2 rounded-xl border border-white/10 px-3 py-2.5 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-[13px] font-semibold">{tenant.name}</p>
            <p className="text-[11px] uppercase tracking-wider text-sidebar-muted">
              {tenant.plan} workspace
            </p>
          </div>
        )}
      </SidebarHeader>

      {/* ── Sections ───────────────────────────────────────────────────── */}
      {/* Scrolls in icon mode too: sixteen icons do not fit a laptop screen. */}
      <SidebarContent
        ref={contentRef}
        className="no-scrollbar gap-1 pb-3 group-data-[collapsible=icon]:overflow-y-auto"
      >
        {groups.map((group) => (
          <SidebarGroup key={group.key} className="px-3 py-1">
            <SidebarGroupLabel className="px-2 text-[10px] font-bold uppercase tracking-[0.15em] text-sidebar-muted">
              {t(group.label)}
            </SidebarGroupLabel>
            <SidebarMenu className="gap-0.5">
              {group.items.map(({ section, pages, launch }) => (
                <SectionItem
                  key={section.key}
                  section={section}
                  pages={pages}
                  launch={launch}
                  inSection={section.key === activeSection}
                  activePage={activePage}
                  open={openSection === section.key}
                  onOpenChange={(open) => setOpenSection(open ? section.key : undefined)}
                  onNavigate={closeOnMobile}
                />
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* ── Account ────────────────────────────────────────────────────── */}
      {user && (
        <SidebarFooter className="border-t border-sidebar-border p-3">
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    aria-label="Account menu"
                    className="h-auto gap-3 rounded-xl bg-white/8 p-2.5 hover:bg-white/12 data-[state=open]:bg-white/12 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0.5!"
                  >
                    <Avatar className="size-9">
                      <AvatarFallback className="bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">
                        {initials(user.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="grid min-w-0 flex-1 text-left leading-tight">
                      <span className="truncate text-sm font-semibold">{user.full_name}</span>
                      <span className="truncate text-[11px] font-medium uppercase tracking-wider text-sidebar-foreground/70">
                        {humanizeRole(user.role)}
                      </span>
                    </span>
                    <MoreVertical className="ml-auto text-sidebar-foreground/60" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  side={isMobile ? "top" : "right"}
                  align="end"
                  sideOffset={8}
                  className="w-56"
                >
                  <DropdownMenuLabel className="font-normal">
                    <p className="truncate text-sm font-semibold">{user.full_name}</p>
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/profile" onClick={closeOnMobile}>
                      <UserCircle2 /> {t("My profile")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => void logout()}>
                    <LogOut /> {t("Sign out")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      )}

      <SidebarRail />
    </Sidebar>
  );
}

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
 * One section of the rail.
 *
 * Expanded, a multi-page section unfolds its pages beneath it. Collapsed to
 * icons there is no room to unfold, so the same pages fly out to the right.
 */
function SectionItem({
  section,
  pages,
  launch,
  inSection,
  activePage,
  open,
  onOpenChange,
  onNavigate,
}: {
  section: NavSection;
  pages: NavPage[];
  /** The linked product this row opens instead of listing pages. */
  launch?: ProductKey;
  inSection: boolean;
  activePage: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: () => void;
}) {
  const t = useT();
  const { state, isMobile } = useSidebar();

  if (launch) {
    const label = `${t(section.name)} · ${t(PRODUCTS[launch].name)}`;
    return (
      <SidebarMenuItem>
        <SidebarMenuButton asChild tooltip={label} className={ROW}>
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
        <SidebarMenuButton asChild isActive={inSection} tooltip={t(section.name)} className={ROW}>
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
          <DropdownMenuContent side="right" align="start" sideOffset={12} className="min-w-52">
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
