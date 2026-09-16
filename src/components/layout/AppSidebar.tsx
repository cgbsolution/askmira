"use client";

import { LogOut, MoreVertical, UserCircle2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useCallback, useMemo } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";
import { useSidebar } from "@/context/SidebarContext";
import { NAV, resolvePage, visiblePages } from "@/lib/access";
import { cn, humanizeRole, initials } from "@/lib/utils";

const GROUP_LABEL: Record<string, string> = {
  me: "Me",
  company: "Company",
  operations: "Operations",
};

/**
 * The nav rail from FRD 5.13: solid Deep Teal, Marigold pill on the active item.
 *
 * Built from `lib/access.ts`, the same map the route guard reads. A section
 * appears only when the workspace has its module and the person can open at
 * least one of its pages; its link goes to the first such page.
 */
export function AppSidebar() {
  const { isExpanded, isHovered, isMobileOpen, setIsHovered, toggleMobileSidebar } = useSidebar();
  const { user, tenant, logout } = useAuth();
  const pathname = usePathname();

  const open = isExpanded || isHovered || isMobileOpen;
  const activeKey = resolvePage(pathname)?.section?.key;

  const sections = useMemo(
    () =>
      NAV.map((section) => ({ section, pages: visiblePages(section, user, tenant) })).filter(
        ({ pages }) => pages.length > 0,
      ),
    [user, tenant],
  );

  const closeOnMobile = useCallback(() => {
    if (isMobileOpen) toggleMobileSidebar();
  }, [isMobileOpen, toggleMobileSidebar]);

  const groups = (["me", "company", "operations"] as const)
    .map((group) => ({ group, items: sections.filter(({ section }) => section.group === group) }))
    .filter(({ items }) => items.length > 0);
  const settings = sections.find(({ section }) => section.group === "admin");

  const itemClass = (active: boolean) =>
    cn(
      "group relative flex items-center rounded-xl transition-colors duration-150",
      open ? "gap-2.5 px-2.5 py-2" : "mx-auto h-11 w-11 justify-center",
      active ? "nav-pill-active font-semibold" : "text-white/85 hover:bg-white/10 hover:text-white",
    );

  return (
    <aside
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "fixed left-0 top-0 z-50 flex h-screen flex-col bg-sidebar text-sidebar-foreground",
        "border-r border-sidebar-border transition-[width,transform] duration-200 ease-out",
        open ? "w-[260px]" : "w-[84px]",
        isMobileOpen ? "translate-x-0" : "-translate-x-full",
        "lg:translate-x-0",
      )}
    >
      {/* ── Brand ──────────────────────────────────────────────────────── */}
      <div className={cn("flex h-16 shrink-0 items-center px-5", !open && "lg:justify-center")}>
        <Link href="/" onClick={closeOnMobile} className="flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent text-sm font-bold text-sidebar-accent-foreground">
            A
          </span>
          {open && (
            <span className="font-display text-lg font-semibold tracking-tight">AskMira</span>
          )}
        </Link>
      </div>

      {/* ── Workspace ──────────────────────────────────────────────────── */}
      {open && tenant && (
        <div className="mx-3 mb-3 rounded-xl bg-white/8 px-3 py-2">
          <p className="truncate text-[13px] font-medium">{tenant.name}</p>
          <p className="text-[11px] uppercase tracking-wider text-sidebar-muted">
            {tenant.plan} workspace
          </p>
        </div>
      )}

      {/* ── Nav ────────────────────────────────────────────────────────── */}
      <nav aria-label="Main" className="no-scrollbar flex-1 overflow-y-auto px-3 pb-4">
        {groups.map(({ group, items }) => (
          <div key={group} className="mb-3">
            <p
              className={cn(
                "mb-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.15em] text-sidebar-muted",
                !open && "lg:text-center",
              )}
            >
              {open ? GROUP_LABEL[group] : "•••"}
            </p>
            <ul className="flex flex-col gap-0.5">
              {items.map(({ section, pages }) => {
                const Icon = section.icon;
                const active = section.key === activeKey;
                return (
                  <li key={section.key}>
                    <Link
                      href={pages[0].path}
                      onClick={closeOnMobile}
                      aria-current={active ? "page" : undefined}
                      title={!open ? section.name : undefined}
                      className={itemClass(active)}
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center">
                        <Icon className="size-[18px]" />
                      </span>
                      {open && (
                        <span className="flex-1 truncate text-sm font-medium">{section.name}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* ── Settings + account ─────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-sidebar-border p-3">
        {settings && (
          <Link
            href={settings.pages[0].path}
            onClick={closeOnMobile}
            title={!open ? "Settings" : undefined}
            aria-current={activeKey === "settings" ? "page" : undefined}
            className={cn(itemClass(activeKey === "settings"), "mb-2")}
          >
            <span className="flex size-8 shrink-0 items-center justify-center">
              <settings.section.icon className="size-[18px]" />
            </span>
            {open && <span className="text-sm font-medium">Settings</span>}
          </Link>
        )}

        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                aria-label="Account menu"
                className={cn(
                  "h-auto rounded-xl bg-white/8 font-normal text-sidebar-foreground hover:bg-white/14 hover:text-sidebar-foreground",
                  open ? "w-full justify-start gap-2.5 p-2" : "mx-auto size-11 justify-center p-0",
                )}
              >
                <Avatar className="size-8">
                  <AvatarFallback className="bg-sidebar-accent text-[11px] font-bold text-sidebar-accent-foreground">
                    {initials(user.full_name)}
                  </AvatarFallback>
                </Avatar>
                {open && (
                  <>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-[13px] font-semibold">
                        {user.full_name}
                      </span>
                      <span className="block truncate text-[11px] text-sidebar-muted">
                        {humanizeRole(user.role)}
                      </span>
                    </span>
                    <MoreVertical className="size-4 shrink-0 text-sidebar-muted" />
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" side="top" className="w-52">
              <div className="px-2 py-1.5">
                <p className="truncate text-sm font-semibold">{user.full_name}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile" onClick={closeOnMobile}>
                  <UserCircle2 /> My profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => void logout()}>
                <LogOut /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </aside>
  );
}
