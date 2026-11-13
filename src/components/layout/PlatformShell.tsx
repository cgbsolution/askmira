"use client";

import {
  AlignLeft,
  Building2,
  ChevronDown,
  KeyRound,
  LogOut,
  Moon,
  MoreVertical,
  Sun,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useCallback, useEffect, useRef, useState } from "react";

import { AskMiraLogo, AskMiraMark } from "@/components/brand/AskMiraLogo";
import { PredictiveSearch, rankSuggestions, type Suggestion } from "@/components/common/PredictiveSearch";
import { HelpButton } from "@/components/help/HelpPanel";
import { ActiveBar, NavChip, ROW } from "@/components/layout/RailSection";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { PLATFORM_HOME, resolvePage, sectionByKey, type NavPage } from "@/lib/access";
import { get } from "@/lib/api";
import { humanizeRole, initials } from "@/lib/utils";

/** The console's two groups: running the platform, then the desks around it. */
const GROUPS: { label: string; paths: string[] }[] = [
  { label: "Console", paths: ["/platform", "/platform/organisations", "/platform/tools"] },
  {
    label: "Desks",
    paths: ["/platform/statutory", "/platform/demo-requests", "/platform/showcase", "/platform/deleted"],
  },
];

function platformPages(): NavPage[] {
  return sectionByKey("platform")?.pages ?? [];
}

interface OrganisationHit {
  id: string;
  name: string;
  workspace: string;
  is_active: boolean;
  city: string | null;
}

/**
 * The super admin's sidebar. They run the platform, not a company, so there are
 * no HR modules here: only the console's own pages, with the AskMiraa logo on
 * top instead of a company's.
 */
export function PlatformSidebar() {
  const { user, logout } = useAuth();
  const { isMobile, setOpenMobile } = useSidebar();
  const pathname = usePathname();
  const active = resolvePage(pathname)?.page.path;
  // Real counts only: the requests waiting for a first reply.
  const waiting = useApiQuery<{ id: string }[]>("/platform/demo-requests?status_filter=new");
  const waitingCount = waiting.data?.length ?? 0;

  const closeOnMobile = useCallback(() => {
    if (isMobile) setOpenMobile(false);
  }, [isMobile, setOpenMobile]);

  const pages = platformPages();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-0 p-0">
        <div className="flex h-[76px] shrink-0 items-center px-4 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <Link
            href={PLATFORM_HOME}
            onClick={closeOnMobile}
            aria-label="Platform overview"
            className="flex w-full min-w-0 items-center rounded-xl outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:w-auto"
          >
            <AskMiraLogo priority className="h-10 group-data-[collapsible=icon]:hidden" />
            <AskMiraMark label="AskMiraa" className="hidden h-10 group-data-[collapsible=icon]:block" />
          </Link>
        </div>
        <div className="mx-3 mb-2 flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 group-data-[collapsible=icon]:hidden">
          <span className="size-2 shrink-0 rounded-full bg-sidebar-primary" aria-hidden />
          <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/85">
            Platform console
          </p>
        </div>
      </SidebarHeader>

      <SidebarContent className="no-scrollbar gap-1 pb-3">
        {GROUPS.map((group) => (
          <SidebarGroup key={group.label} className="px-3 py-1">
            <SidebarGroupLabel className="px-2 text-[10px] font-bold uppercase tracking-[0.15em] text-sidebar-muted">
              {group.label}
            </SidebarGroupLabel>
            <SidebarMenu className="gap-0.5">
              {group.paths
                .map((path) => pages.find((page) => page.path === path))
                .filter((page): page is NavPage => page !== undefined)
                .map((page) => {
                  const current = page.path === active;
                  const Icon = page.icon ?? Building2;
                  const count = page.path === "/platform/demo-requests" ? waitingCount : 0;
                  return (
                    <SidebarMenuItem key={page.path}>
                      <SidebarMenuButton
                        asChild
                        isActive={current}
                        tooltip={{ children: page.name, side: "right" }}
                        className={ROW}
                      >
                        <Link href={page.path} onClick={closeOnMobile} aria-current={current ? "page" : undefined}>
                          {current && <ActiveBar />}
                          <NavChip icon={Icon} active={current} />
                          <span className="truncate">{page.name}</span>
                        </Link>
                      </SidebarMenuButton>
                      {count > 0 && (
                        <SidebarMenuBadge
                          aria-label={`${count} new`}
                          className="top-1/2 -translate-y-1/2 rounded-full bg-sidebar-primary px-1.5 text-[11px] font-bold text-sidebar-primary-foreground"
                        >
                          {count}
                        </SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  );
                })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

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
                      {user.photo_url && <AvatarImage src={user.photo_url} alt="" />}
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
                <DropdownMenuContent side={isMobile ? "top" : "right"} align="end" sideOffset={8} className="w-56">
                  <AccountItems email={user.email} name={user.full_name} onSignOut={() => void logout()} />
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

function AccountItems({
  name,
  email,
  role,
  onSignOut,
}: {
  name: string;
  email: string;
  role?: string;
  onSignOut: () => void;
}) {
  return (
    <>
      <DropdownMenuLabel className="font-normal">
        <p className="truncate text-sm font-semibold">{name}</p>
        <p className="truncate text-xs text-muted-foreground">{email}</p>
        {role && (
          <Badge variant="muted" className="mt-2 uppercase tracking-wider">
            {role}
          </Badge>
        )}
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem asChild>
        <Link href="/change-password">
          <KeyRound /> Change password
        </Link>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="destructive" onClick={onSignOut}>
        <LogOut /> Sign out
      </DropdownMenuItem>
    </>
  );
}

/**
 * The super admin's top bar: the console's pages and every organisation are
 * one search away; help, theme and the account menu on the right. No people
 * search and no notifications bell: those belong to a company's workspace.
 */
export function PlatformHeader() {
  const { toggleSidebar } = useSidebar();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();
  const [term, setTerm] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  // Loaded on the first search, then kept: the list is short and changes rarely.
  const organisations = useRef<Promise<OrganisationHit[]> | null>(null);

  const pages: Suggestion[] = platformPages().map((page) => ({
    id: `page:${page.path}`,
    label: page.name,
    keywords: page.path.replaceAll("/", " ").replaceAll("-", " "),
    group: "Console",
    icon: page.icon,
    onSelect: () => router.push(page.path),
  }));

  const findOrganisations = useCallback(
    async (query: string): Promise<Suggestion[]> => {
      organisations.current ??= get<OrganisationHit[]>("/platform/workspaces").catch((caught) => {
        organisations.current = null;
        throw caught;
      });
      const list = await organisations.current;
      const lines = list.map((org) => ({
        id: `org:${org.id}`,
        label: org.name,
        description: [org.workspace, org.city, org.is_active ? null : "Suspended"].filter(Boolean).join(" · "),
        keywords: `${org.workspace} ${org.city ?? ""}`,
        group: "Organisations",
        icon: Building2,
        onSelect: () => router.push(`/platform/organisations?open=${org.id}`),
      }));
      return rankSuggestions(lines, query, 6);
    },
    [router],
  );

  const [shortcut, setShortcut] = useState("Ctrl K");
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform)) setShortcut("⌘K");
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const round = "size-11 rounded-full text-muted-foreground hover:text-foreground";

  return (
    <header className="sticky top-0 z-40 flex h-[76px] shrink-0 items-center gap-2 border-b border-border bg-card px-3 sm:gap-3 sm:px-4 md:px-6">
      <Button
        variant="outline"
        size="icon"
        onClick={toggleSidebar}
        aria-label="Toggle navigation"
        className="size-11 shrink-0 text-muted-foreground hover:text-foreground"
      >
        <AlignLeft className="size-5" />
      </Button>
      <Link href={PLATFORM_HOME} aria-label="Platform overview" className="flex min-w-0 rounded-lg md:hidden">
        <AskMiraMark className="h-10" />
      </Link>
      <form
        role="search"
        className="relative hidden w-full max-w-[430px] sm:block"
        onSubmit={(event) => event.preventDefault()}
      >
        <PredictiveSearch
          ref={searchRef}
          value={term}
          onValueChange={setTerm}
          maxLength={100}
          suggestions={(query) => rankSuggestions(pages, query, 4, { wordStart: true })}
          loadSuggestions={findOrganisations}
          historyKey="platform-header"
          emptyText="No organisation or page matches."
          submitLabel={(query) => `Search organisations for “${query}”`}
          onSubmit={(query) => {
            router.push(
              query ? `/platform/organisations?search=${encodeURIComponent(query)}` : "/platform/organisations",
            );
            setTerm("");
            searchRef.current?.blur();
          }}
          onPick={() => {
            setTerm("");
            searchRef.current?.blur();
          }}
          placeholder="Search organisations by name or address"
          aria-label="Search organisations and console pages"
          className="rounded-xl pr-16 pl-12 shadow-sm"
          iconClassName="left-4"
          listClassName="w-[max(var(--radix-popover-trigger-width),22rem)]"
          trailing={
            <kbd className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 rounded-lg border border-border bg-muted px-1.5 py-1 font-sans text-xs font-medium text-muted-foreground">
              {shortcut}
            </kbd>
          }
        />
      </form>
      <div className="ml-auto flex items-center gap-1 sm:gap-3">
        <HelpButton className={round} />
        <Button
          variant="outline"
          size="icon"
          className={round}
          onClick={toggleTheme}
          aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
        >
          {theme === "light" ? <Moon /> : <Sun />}
        </Button>
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                aria-label="Account menu"
                className="group h-11 gap-3 rounded-full px-0 hover:bg-transparent has-[>svg]:px-0 sm:pr-1 sm:has-[>svg]:px-3"
              >
                <Avatar className="size-11">
                  {user.photo_url && <AvatarImage src={user.photo_url} alt="" />}
                  <AvatarFallback className="bg-brand-100 text-sm font-semibold text-brand-600 dark:bg-brand-800 dark:text-brand-100">
                    {initials(user.full_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden text-sm font-medium text-foreground sm:block">
                  {user.full_name.split(" ")[0]}
                </span>
                <ChevronDown className="hidden text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180 sm:block" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={12} className="w-[260px] rounded-2xl p-3">
              <AccountItems
                email={user.email}
                name={user.full_name}
                role={humanizeRole(user.role)}
                onSignOut={() => void logout()}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
