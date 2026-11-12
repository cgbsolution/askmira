"use client";

import {
  AlignLeft,
  Bell,
  Building2,
  Check,
  ChevronDown,
  Languages,
  LayoutGrid,
  LogOut,
  Moon,
  ShieldCheck,
  Sun,
  UserCircle2,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AskMiraMark } from "@/components/brand/AskMiraLogo";
import { CompanyMark } from "@/components/brand/CompanyLogo";
import { PredictiveSearch, rankSuggestions, type Suggestion } from "@/components/common/PredictiveSearch";
import { HelpButton } from "@/components/help/HelpPanel";
import { useConnectorRail } from "@/components/layout/ConnectorSidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSidebar } from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useProductRoles } from "@/hooks/useProductRoles";
import { HR, NAV, railEntry, type RailEntry } from "@/lib/access";
import { get } from "@/lib/api";
import { LOCALES, useLocale, useT } from "@/lib/i18n";
import type { EmployeeSummary, Page } from "@/lib/types";
import { cn, humanizeRole, initials } from "@/lib/utils";

/**
 * Top bar: navigation toggle, people search, help for the page, theme,
 * notifications, account.
 *
 * Search predicts as you type: the pages this person can open (by name, or
 * by their section's) and the people the directory would show them. Picking
 * one opens it; Enter goes to the directory with the words applied. The bell
 * links to the inbox; the unread count is shown by the notifications work,
 * not guessed here.
 */
export function AppHeader() {
  const t = useT();
  const { toggleSidebar } = useSidebar();
  const quickAccess = useConnectorRail();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const { user, tenant, company, hasRole } = useAuth();
  const productRoles = useProductRoles();
  // Outside HR the directory is the person's own team, so that is what this searches.
  const searchesCompany = hasRole(...HR);
  const [term, setTerm] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Every page the menu would show this person, each once.
  const pages = useMemo<Suggestion[]>(() => {
    const seen = new Set<string>();
    const lines: Suggestion[] = [];
    for (const entry of NAV.map((section) => railEntry(section, user, tenant, productRoles)).filter(
      (found): found is RailEntry => found !== null,
    )) {
      for (const page of entry.pages) {
        if (seen.has(page.path)) continue;
        seen.add(page.path);
        const name = t(page.name);
        const section = t(entry.section.name);
        lines.push({
          id: `page:${page.path}`,
          label: name,
          description: name === section ? undefined : section,
          keywords: `${section} ${page.path.replaceAll("/", " ").replaceAll("-", " ")}`,
          group: t("Pages"),
          icon: page.icon ?? entry.section.icon,
          onSelect: () => router.push(page.path),
        });
      }
    }
    return lines;
  }, [user, tenant, productRoles, router, t]);

  // The people the directory would show: everyone for HR, their own circle for anybody else.
  const findPeople = useCallback(
    async (query: string): Promise<Suggestion[]> => {
      const params = new URLSearchParams({ search: query, page_size: "20" });
      const found = await get<Page<EmployeeSummary>>(`/employees?${params}`);
      const lines = found.items.map((person) => {
        const name =
          person.display_name || [person.first_name, person.last_name].filter(Boolean).join(" ") || person.work_email;
        return {
          id: `person:${person.id}`,
          label: name,
          description: [person.designation, person.work_email].filter(Boolean).join(" · ") || undefined,
          hint: person.employee_code,
          keywords: [person.employee_code, person.work_email, person.designation].filter(Boolean).join(" "),
          group: t("People"),
          leading: (
            <Avatar className="size-7">
              {person.photo_url && <AvatarImage src={person.photo_url} alt="" />}
              <AvatarFallback className="bg-brand-100 text-[11px] font-semibold text-brand-600 dark:bg-brand-800 dark:text-brand-100">
                {initials(name) || <UserRound className="size-3.5" />}
              </AvatarFallback>
            </Avatar>
          ),
          onSelect: () => router.push(`/people/${person.id}`),
        };
      });
      // The server finds the words anywhere; names that start with them come first.
      return rankSuggestions(lines, query, 6);
    },
    [router, t],
  );
  // Resolved after mount: the platform is the viewer's, and guessing it during
  // server rendering would hand the client a different string to hydrate.
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
    // A phone fits the toggle, the company's 40px mark and five 44px buttons
    // at 360px only with the tighter gap and padding; from sm up, as before.
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

      {/* Below md the rail is a drawer, so the company would otherwise vanish. */}
      <Link
        href="/"
        aria-label={`${company?.name ?? tenant?.name ?? "AskMiraa"} home`}
        className="flex min-w-0 rounded-lg md:hidden"
      >
        {tenant ? <CompanyMark company={company} fallbackName={tenant.name} /> : <AskMiraMark className="h-10" />}
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
          suggestions={(query) => rankSuggestions(pages, query, 5, { wordStart: true })}
          loadSuggestions={findPeople}
          historyKey="header"
          emptyText={t("No page or person matches. Press Enter to search the directory.")}
          submitLabel={(query) => `${t("Search the directory for")} “${query}”`}
          onSubmit={(query) => {
            router.push(query ? `/people?search=${encodeURIComponent(query)}` : "/people");
            // The directory's own search box takes the words from here, where they
            // can be refined; kept here too, the two boxes would drift apart.
            setTerm("");
            searchRef.current?.blur();
          }}
          onPick={() => {
            setTerm("");
            searchRef.current?.blur();
          }}
          placeholder={
            searchesCompany ? "Search pages and people by name, code or email" : "Search pages and your team"
          }
          aria-label={t("Search pages and people")}
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
        {/* On a phone the quick-access rail is a drawer, with no strip to click. */}
        <Button
          variant="outline"
          size="icon"
          onClick={quickAccess.toggleSidebar}
          aria-label={t("Quick access")}
          className={cn(round, "md:hidden")}
        >
          <LayoutGrid />
        </Button>

        <HelpButton className={round} />

        <Button
          variant="outline"
          size="icon"
          className={round}
          onClick={toggleTheme}
          aria-label={t(theme === "light" ? "Switch to dark theme" : "Switch to light theme")}
        >
          {theme === "light" ? <Moon /> : <Sun />}
        </Button>

        <Button variant="outline" size="icon" className={round} aria-label="Notifications" asChild>
          <Link href="/notifications">
            <Bell />
          </Link>
        </Button>

        <UserMenu />
      </div>
    </header>
  );
}

/** Avatar, first name and the account menu, at the right of the bar. */
function UserMenu() {
  const { user, logout, hasRole } = useAuth();
  const { locale, setLocale, t } = useLocale();
  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          aria-label={t("Account menu")}
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
        <DropdownMenuLabel className="px-1 pt-0 font-normal">
          <p className="truncate text-sm font-semibold text-foreground">{user.full_name}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{user.email}</p>
          <Badge variant="muted" className="mt-2 uppercase tracking-wider">
            {humanizeRole(user.role)}
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-2" />
        <DropdownMenuItem asChild className="gap-3 rounded-lg px-3 py-2 font-medium">
          <Link href="/profile">
            <UserCircle2 /> {t("My profile")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="gap-3 rounded-lg px-3 py-2 font-medium">
          <Link href="/compliance/privacy">
            <ShieldCheck /> {t("My privacy")}
          </Link>
        </DropdownMenuItem>
        {hasRole(...HR) ? (
          <DropdownMenuItem asChild className="gap-3 rounded-lg px-3 py-2 font-medium">
            <Link href="/operator">
              <Building2 /> {t("Client workspaces")}
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-3 rounded-lg px-3 py-2 font-medium">
            <Languages className="size-4" /> {t("Language")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {LOCALES.map((option) => (
              <DropdownMenuItem key={option.code} lang={option.code} onClick={() => setLocale(option.code)}>
                <Check className={option.code === locale ? "opacity-100" : "opacity-0"} />
                {option.label}
                {option.code !== "en" ? <span className="text-xs text-muted-foreground">{option.english}</span> : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator className="my-2" />
        <DropdownMenuItem
          variant="destructive"
          className="gap-3 rounded-lg px-3 py-2 font-medium"
          onClick={() => void logout()}
        >
          <LogOut /> {t("Sign out")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
