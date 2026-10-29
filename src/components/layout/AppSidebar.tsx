"use client";

import { LogOut, MoreVertical, ShieldCheck, UserCircle2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AskMiraLogo, AskMiraMark } from "@/components/brand/AskMiraLogo";
import { CompanyLogo } from "@/components/brand/CompanyLogo";
import { RailSection } from "@/components/layout/RailSection";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/lib/i18n";
import {
  GROUP_LABEL,
  NAV,
  QUICK_ACCESS,
  railEntry,
  resolvePage,
  type NavSection,
  type RailEntry,
} from "@/lib/access";
import { humanizeRole, initials } from "@/lib/utils";

const GROUP_ORDER: NavSection["group"][] = ["main", "admin"];

/**
 * The nav rail from FRD 5.13: warm Ink with the person's own company logo on
 * top (their legal entity's, else the workspace's), Marigold on the active
 * item. The AskMira logo sits at the foot of the right-hand rail.
 *
 * One list of HR modules, the admin ones under their own heading at the foot.
 * Built from `lib/access.ts`, the same map the route guard reads. A section
 * appears only when the workspace has its module and the person can open at
 * least one of its pages. A section with one page is a link; with more, its
 * pages are listed under it — so the rail, not a bar on each page, is how you
 * move around a module. A section a linked product has taken over is one row
 * that opens the product in a new tab. The `QUICK_ACCESS` sections live on the
 * right-hand rail instead (`ConnectorSidebar`).
 */
export function AppSidebar() {
  const t = useT();
  const { user, tenant, company, logout } = useAuth();
  // Whether the company's logo is drawn on top; without it the name is drawn
  // there instead, and the box below must not repeat it.
  const [logoShown, setLogoShown] = useState(false);
  const { isMobile, setOpenMobile, state } = useSidebar();
  const pathname = usePathname();

  const resolved = resolvePage(pathname);
  const activeSection = resolved?.section?.key;
  // A page left out of the menu lights up the one it is reached from.
  const activePage = resolved?.page.parent ?? resolved?.page.path;

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
    const sections = NAV.filter((section) => !QUICK_ACCESS.includes(section.key))
      .map((section) => railEntry(section, user, tenant))
      .filter((entry): entry is RailEntry => entry !== null);
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
        <div className="flex h-[76px] shrink-0 items-center px-4 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <Link
            href="/"
            onClick={closeOnMobile}
            aria-label={`${company?.name ?? tenant?.name ?? "AskMira"} home`}
            className="flex w-full min-w-0 items-center rounded-xl outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:w-auto"
          >
            {tenant ? (
              <CompanyLogo
                company={company}
                fallbackName={tenant.name}
                className="w-full"
                onLogoShown={setLogoShown}
              />
            ) : (
              <>
                <AskMiraLogo priority className="h-10 group-data-[collapsible=icon]:hidden" />
                <AskMiraMark label="AskMira" className="hidden h-10 group-data-[collapsible=icon]:block" />
              </>
            )}
          </Link>
        </div>

        {tenant && (
          <div className="mx-3 mb-2 rounded-xl border border-white/10 px-3 py-2.5 group-data-[collapsible=icon]:hidden">
            {/* Without a logo the name is already drawn above. */}
            {logoShown && company && (
              <p className="truncate text-[13px] font-semibold">{company.name}</p>
            )}
            <p className="truncate text-[11px] uppercase tracking-wider text-sidebar-muted">
              {company && company.name !== tenant.name ? tenant.name : `${tenant.plan} workspace`}
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
            {group.key === "admin" && (
              <SidebarGroupLabel className="px-2 text-[10px] font-bold uppercase tracking-[0.15em] text-sidebar-muted">
                {t(group.label)}
              </SidebarGroupLabel>
            )}
            <SidebarMenu className="gap-0.5">
              {group.items.map(({ section, pages, launch }) => (
                <RailSection
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
                  <DropdownMenuItem asChild>
                    <Link href="/compliance/privacy" onClick={closeOnMobile}>
                      <ShieldCheck /> {t("My privacy")}
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
