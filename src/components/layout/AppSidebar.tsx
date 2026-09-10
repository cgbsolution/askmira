"use client";

import {
  BarChart3,
  Briefcase,
  CalendarClock,
  CircleDollarSign,
  FileText,
  Gift,
  Heart,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MoreVertical,
  Settings,
  Users,
  UserCircle2,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useCallback, useMemo } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";
import { useSidebar } from "@/context/SidebarContext";
import { cn, humanizeRole, initials } from "@/lib/utils";

type NavItem = {
  name: string;
  icon: LucideIcon;
  path: string;
  /** Which workspace module gates this item. Undefined = always available. */
  module?: string;
  /** Roadmap phase. Anything past V1 renders disabled with a phase chip. */
  phase?: "V1" | "V2" | "V3";
  badge?: number;
};

/**
 * The nav rail from FRD 5.13: fixed width, icon-over-label, solid Deep Teal,
 * Marigold pill on the active item.
 *
 * Items for unshipped phases stay visible but disabled, with a phase chip.
 * During pilots that makes the roadmap legible inside the product, which is
 * worth more than a tidy menu.
 */
const NAV_ITEMS: NavItem[] = [
  { name: "Home", icon: LayoutDashboard, path: "/", phase: "V1" },
  { name: "People", icon: Users, path: "/people", module: "core_hr", phase: "V1" },
  { name: "Time", icon: CalendarClock, path: "/time", module: "leave", phase: "V1" },
  { name: "Hiring", icon: Briefcase, path: "/hiring", module: "hiring", phase: "V1" },
  { name: "Culture", icon: Heart, path: "/culture", module: "culture", phase: "V1" },
  { name: "Payroll", icon: CircleDollarSign, path: "/payroll", module: "payroll", phase: "V1" },
  { name: "Docs", icon: FileText, path: "/docs", module: "core_hr", phase: "V1" },
  { name: "Tasks", icon: ListChecks, path: "/tasks", phase: "V2" },
  { name: "Analytics", icon: BarChart3, path: "/analytics", module: "analytics", phase: "V2" },
  { name: "Rewards", icon: Gift, path: "/rewards", module: "rewards", phase: "V2" },
];

export function AppSidebar() {
  const { isExpanded, isHovered, isMobileOpen, setIsHovered, toggleMobileSidebar } = useSidebar();
  const { user, tenant, logout, hasModule } = useAuth();
  const pathname = usePathname();

  const open = isExpanded || isHovered || isMobileOpen;

  const isActive = useCallback(
    (path: string) =>
      path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`),
    [pathname],
  );

  const items = useMemo(
    () =>
      NAV_ITEMS.map((item) => ({
        ...item,
        // A V1 item is live once the workspace has its module on. Later phases
        // stay disabled regardless — the module flag is not a ship date.
        enabled: item.phase === "V1" && (!item.module || hasModule(item.module)),
      })),
    [hasModule],
  );

  const closeOnMobile = useCallback(() => {
    if (isMobileOpen) toggleMobileSidebar();
  }, [isMobileOpen, toggleMobileSidebar]);

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
      <nav className="no-scrollbar flex-1 overflow-y-auto px-3 pb-4">
        <p
          className={cn(
            "mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.15em] text-sidebar-muted",
            !open && "lg:text-center",
          )}
        >
          {open ? "Menu" : "•••"}
        </p>

        <ul className="flex flex-col gap-0.5">
          {items.map((item) => {
            const Icon = item.icon;
            const active = item.enabled && isActive(item.path);
            const content = (
              <>
                <span className="relative flex size-8 shrink-0 items-center justify-center">
                  <Icon className="size-[18px]" />
                  {item.badge ? (
                    <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                      {item.badge > 9 ? "9+" : item.badge}
                    </span>
                  ) : null}
                </span>
                {open && <span className="flex-1 truncate text-sm font-medium">{item.name}</span>}
                {open && item.phase !== "V1" && (
                  <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-sidebar-muted">
                    {item.phase}
                  </span>
                )}
              </>
            );

            const shared = cn(
              "group relative flex items-center rounded-xl transition-colors duration-150",
              open ? "gap-2.5 px-2.5 py-2" : "h-11 w-11 mx-auto justify-center",
              active
                ? "nav-pill-active font-semibold"
                : item.enabled
                  ? "text-white/85 hover:bg-white/10 hover:text-white"
                  : "cursor-not-allowed text-white/35",
            );

            return (
              <li key={item.path}>
                {item.enabled ? (
                  <Link
                    href={item.path}
                    onClick={closeOnMobile}
                    aria-current={active ? "page" : undefined}
                    title={!open ? item.name : undefined}
                    className={shared}
                  >
                    {content}
                  </Link>
                ) : (
                  <span
                    aria-disabled
                    title={
                      !open
                        ? `${item.name} — ${item.phase}`
                        : `Ships in ${item.phase}`
                    }
                    className={shared}
                  >
                    {content}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── Settings + account ─────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-sidebar-border p-3">
        <Link
          href="/settings"
          onClick={closeOnMobile}
          title={!open ? "Settings" : undefined}
          className={cn(
            "mb-2 flex items-center rounded-xl text-white/85 transition-colors hover:bg-white/10 hover:text-white",
            open ? "gap-2.5 px-2.5 py-2" : "mx-auto h-11 w-11 justify-center",
          )}
        >
          <span className="flex size-8 shrink-0 items-center justify-center">
            <Settings className="size-[18px]" />
          </span>
          {open && <span className="text-sm font-medium">Settings</span>}
        </Link>

        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Account menu"
                className={cn(
                  "flex w-full items-center rounded-xl bg-white/8 transition-colors hover:bg-white/14",
                  open ? "gap-2.5 p-2" : "mx-auto size-11 justify-center",
                )}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-[11px] font-bold text-sidebar-accent-foreground">
                  {initials(user.full_name)}
                </span>
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
              </button>
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
              <DropdownMenuItem variant="destructive" onClick={logout}>
                <LogOut /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </aside>
  );
}
