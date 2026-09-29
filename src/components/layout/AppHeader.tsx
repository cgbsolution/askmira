"use client";

import {
  AlignLeft,
  Bell,
  ChevronDown,
  LogOut,
  Moon,
  Search,
  Sun,
  UserCircle2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { Input } from "@/components/ui/input";
import { useSidebar } from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { humanizeRole, initials } from "@/lib/utils";

/**
 * Top bar: navigation toggle, people search, theme, notifications, account.
 *
 * Search goes to the directory with the term applied — the one search the
 * product can answer truthfully today. The bell links to the inbox; the unread
 * count is shown by the notifications work, not guessed here.
 */
export function AppHeader() {
  const { toggleSidebar } = useSidebar();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const [term, setTerm] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
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
    <header className="sticky top-0 z-40 flex h-[76px] shrink-0 items-center gap-3 border-b border-border bg-card px-4 md:px-6">
      <Button
        variant="outline"
        size="icon"
        onClick={toggleSidebar}
        aria-label="Toggle navigation"
        className="size-11 shrink-0 text-muted-foreground hover:text-foreground"
      >
        <AlignLeft className="size-5" />
      </Button>

      <form
        role="search"
        className="relative hidden w-full max-w-[430px] sm:block"
        onSubmit={(event) => {
          event.preventDefault();
          const query = term.trim();
          router.push(query ? `/people?search=${encodeURIComponent(query)}` : "/people");
        }}
      >
        <Search className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={searchRef}
          type="search"
          value={term}
          maxLength={100}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search people by name, code or email"
          className="rounded-xl pr-16 pl-12 shadow-sm"
          aria-label="Search people"
        />
        <kbd className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 rounded-lg border border-border bg-muted px-1.5 py-1 font-sans text-xs font-medium text-muted-foreground">
          {shortcut}
        </kbd>
      </form>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <Button
          variant="outline"
          size="icon"
          className={round}
          onClick={toggleTheme}
          aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
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
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          aria-label="Account menu"
          className="group h-11 gap-3 rounded-full px-0 hover:bg-transparent sm:pr-1"
        >
          <Avatar className="size-11">
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
            <UserCircle2 /> My profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="my-2" />
        <DropdownMenuItem
          variant="destructive"
          className="gap-3 rounded-lg px-3 py-2 font-medium"
          onClick={() => void logout()}
        >
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
